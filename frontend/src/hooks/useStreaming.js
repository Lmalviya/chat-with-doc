import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { streamSSE } from '../api/sse.js';
import { MESSAGE_STATUS, TITLE_GENERATION_DELAY_MS } from '../utils/constants.js';
import { buildChildrenMap, switchBranch } from '../utils/messageTree.js';
import { generateTitle } from '../api/conversations.js';

/**
 * Create an optimistic message object that mirrors the DB schema.
 */
function createOptimisticMessage({
  message_id,
  conversation_id,
  parent_message_id,
  role,
  content,
  request_id,
  status = MESSAGE_STATUS.COMPLETE,
}) {
  return {
    message_id,
    id: message_id,
    conversation_id,
    parent_message_id,
    parent_id: parent_message_id,
    role,
    content,
    status,
    request_id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sources: [],
    stages: [],
    currentStage: null,
    thinking: '',
    thinkingElapsedMs: null,
    thinkingDone: false,
    isOptimistic: true,
  };
}

/**
 * useStreaming — SSE streaming state machine.
 */
export function useStreaming({
  conversationId,
  messages,
  setMessages,
  setActiveLeafMessageId,
  activeLeafMessageId,
  onNewContent,
  onTitleGenerated,
  onConversationCreated,
  isFirstExchange = false,
}) {
  const navigate = useNavigate();
  const [streamState, setStreamState] = useState('idle');
  const activeControllerRef = useRef(null);
  const activeRequestIdRef = useRef(null);
  const pendingAssistantIdRef = useRef(null);
  const currentConversationIdRef = useRef(conversationId);
  const thinkingStartTimeRef = useRef(null);

  currentConversationIdRef.current = conversationId;

  const startStream = useCallback(async ({
    content,
    parentMessageId,
    userMessageId,
    assistantMessageId,
    requestId = crypto.randomUUID(),
    isNewConversation = false,
  }) => {
    if (streamState === 'streaming') return;

    const isNew = isNewConversation || !conversationId || conversationId === 'new';
    const uid = userMessageId ?? crypto.randomUUID();
    const aid = assistantMessageId ?? crypto.randomUUID();

    thinkingStartTimeRef.current = null;

    // Determine parent message ID for the new message
    const resolvedParentId = parentMessageId !== undefined
      ? parentMessageId
      : (activeLeafMessageId || (messages.length ? (messages[messages.length - 1].message_id ?? messages[messages.length - 1].id) : null));

    // Insert optimistic user message
    const userMsg = createOptimisticMessage({
      message_id: uid,
      conversation_id: isNew ? 'temp' : conversationId,
      parent_message_id: resolvedParentId,
      role: 'user',
      content,
      request_id: requestId,
    });

    // Insert optimistic assistant placeholder
    const assistantMsg = createOptimisticMessage({
      message_id: aid,
      conversation_id: isNew ? 'temp' : conversationId,
      parent_message_id: uid,
      role: 'assistant',
      content: '',
      request_id: requestId,
      status: MESSAGE_STATUS.STREAMING,
    });

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setActiveLeafMessageId(aid);
    pendingAssistantIdRef.current = aid;
    activeRequestIdRef.current = requestId;
    setStreamState('streaming');

    const path = isNew ? '/conversations/' : `/conversations/${conversationId}/messages/`;
    const body = isNew
      ? { content }
      : {
        content,
        parent_id: resolvedParentId,
      };

    let confirmedConvId = isNew ? null : conversationId;

    const controller = streamSSE({
      path,
      body,
      requestId,
      onMeta: (meta) => {
        if (meta?.conversation_id) {
          confirmedConvId = meta.conversation_id;
          currentConversationIdRef.current = confirmedConvId;

          // Update messages in state with real conversation_id and user_message_id
          setMessages((prev) =>
            prev.map((m) => {
              if (m.role === 'user' && (m.message_id === uid || m.id === uid)) {
                return {
                  ...m,
                  id: meta.user_message_id ?? m.id,
                  message_id: meta.user_message_id ?? m.message_id,
                  conversation_id: meta.conversation_id,
                };
              }
              if (m.role === 'assistant' && (m.message_id === aid || m.id === aid)) {
                return {
                  ...m,
                  parent_id: meta.user_message_id ?? m.parent_id,
                  parent_message_id: meta.user_message_id ?? m.parent_message_id,
                  conversation_id: meta.conversation_id,
                };
              }
              if (m.conversation_id === 'temp') {
                return { ...m, conversation_id: meta.conversation_id };
              }
              return m;
            }),
          );

          // Notify parent & sidebar
          onConversationCreated?.({
            id: meta.conversation_id,
            conversation_id: meta.conversation_id,
            title: content.slice(0, 40),
            updated_at: new Date().toISOString(),
          });

          // Replace URL without keeping old router state
          navigate(`/c/${meta.conversation_id}`, { replace: true, state: null });
        }
      },
      onStatus: (statusEvent) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.message_id === aid || m.id === aid) {
              const prevStages = m.stages || [];
              const exists = prevStages.some((s) => s.content === statusEvent.content);
              const updatedStages = exists ? prevStages : [...prevStages, statusEvent];
              return {
                ...m,
                currentStage: statusEvent.content,
                stages: updatedStages,
              };
            }
            return m;
          }),
        );
        onNewContent?.();
      },
      onThink: (thinkDelta) => {
        if (!thinkingStartTimeRef.current) {
          thinkingStartTimeRef.current = Date.now();
        }
        setMessages((prev) =>
          prev.map((m) => {
            if (m.message_id === aid || m.id === aid) {
              return {
                ...m,
                thinking: (m.thinking || '') + thinkDelta,
                currentStage: null,
              };
            }
            return m;
          }),
        );
        onNewContent?.();
      },
      onToken: (token) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.message_id === aid || m.id === aid) {
              let elapsed = m.thinkingElapsedMs;
              let isThinkingDone = m.thinkingDone;
              if (m.thinking && !m.thinkingDone && thinkingStartTimeRef.current) {
                elapsed = Date.now() - thinkingStartTimeRef.current;
                isThinkingDone = true;
              }
              return {
                ...m,
                content: m.content + token,
                currentStage: null,
                thinkingDone: isThinkingDone,
                thinkingElapsedMs: elapsed,
              };
            }
            return m;
          }),
        );
        onNewContent?.();
      },
      onDone: (data) => {
        const finalConvId = confirmedConvId ?? data?.conversation_id ?? conversationId;
        const finalAssistantId = data?.message_id ?? aid;

        setMessages((prev) =>
          prev.map((m) => {
            if (m.message_id === aid || m.id === aid) {
              let elapsed = m.thinkingElapsedMs;
              if (m.thinking && !elapsed && thinkingStartTimeRef.current) {
                elapsed = Date.now() - thinkingStartTimeRef.current;
              }
              return {
                ...m,
                status: MESSAGE_STATUS.COMPLETE,
                id: finalAssistantId,
                message_id: finalAssistantId,
                currentStage: null,
                thinkingDone: true,
                thinkingElapsedMs: elapsed,
              };
            }
            return m;
          }),
        );

        // Keep activeLeafMessageId synchronized with the final server message_id
        setActiveLeafMessageId(finalAssistantId);
        setStreamState('idle');
        activeControllerRef.current = null;

        // Trigger title generation if this was the first exchange
        if (isNew || isFirstExchange) {
          setTimeout(async () => {
            if (!finalConvId || finalConvId === 'new' || finalConvId === 'temp') return;
            try {
              const result = await generateTitle(finalConvId, content);
              if (result?.title) {
                onTitleGenerated?.(result.title, finalConvId);
              }
            } catch {
              /* non-critical background task */
            }
          }, TITLE_GENERATION_DELAY_MS);
        }
      },
      onError: (err) => {
        setMessages((prev) =>
          prev.map((m) =>
            (m.message_id === aid || m.id === aid)
              ? { ...m, status: MESSAGE_STATUS.FAILED }
              : m,
          ),
        );
        setStreamState('failed');
        activeControllerRef.current = null;
        toast.error(`Generation failed: ${err.message}`);
      },
    });

    activeControllerRef.current = controller;
  }, [
    streamState,
    conversationId,
    messages,
    activeLeafMessageId,
    setMessages,
    setActiveLeafMessageId,
    navigate,
    onNewContent,
    onTitleGenerated,
    onConversationCreated,
    isFirstExchange,
  ]);

  const stopStream = useCallback(async () => {
    if (streamState !== 'streaming') return;

    activeControllerRef.current?.abort();
    activeControllerRef.current = null;

    const aid = pendingAssistantIdRef.current;

    setMessages((prev) =>
      prev.map((m) =>
        (m.message_id === aid || m.id === aid)
          ? { ...m, status: MESSAGE_STATUS.STOPPED }
          : m,
      ),
    );
    setStreamState('stopped');
  }, [streamState, setMessages]);

  const retryStream = useCallback(async (failedUserMessage) => {
    const failedId = failedUserMessage.message_id ?? failedUserMessage.id;
    setMessages((prev) =>
      prev.filter(
        (m) =>
          (m.message_id ?? m.id) !== failedId &&
          (m.parent_message_id ?? m.parent_id) !== failedId,
      ),
    );
    const requestId = crypto.randomUUID();
    await startStream({
      content: failedUserMessage.content,
      parentMessageId: failedUserMessage.parent_message_id ?? failedUserMessage.parent_id,
      requestId,
    });
  }, [startStream, setMessages]);

  const switchMessageBranch = useCallback((direction, message) => {
    const childrenMap = buildChildrenMap(messages);
    const newLeafId = switchBranch(direction, message, childrenMap);
    if (!newLeafId) return;

    setActiveLeafMessageId(newLeafId);
  }, [messages, setActiveLeafMessageId]);

  return {
    streamState,
    isStreaming: streamState === 'streaming',
    startStream,
    stopStream,
    retryStream,
    switchMessageBranch,
  };
}
