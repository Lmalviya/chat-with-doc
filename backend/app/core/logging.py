import logging
import logging.config
import os
import sys
from contextvars import ContextVar
from pathlib import Path
from typing import Any

# Context variables for distributed request and workflow correlation
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")
conversation_id_ctx: ContextVar[str] = ContextVar("conversation_id", default="-")
user_id_ctx: ContextVar[str] = ContextVar("user_id", default="-")


class CorrelationContextFilter(logging.Filter):
    """Injects async correlation IDs (request_id, conversation_id, user_id) into every LogRecord."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get()
        record.conversation_id = conversation_id_ctx.get()
        record.user_id = user_id_ctx.get()
        return True


class ColoredConsoleFormatter(logging.Formatter):
    """Adds ANSI colors to console log levels for clear terminal visibility."""

    COLORS = {
        "DEBUG": "\033[36m",     # Cyan
        "INFO": "\033[32m",      # Green
        "WARNING": "\033[33m",   # Yellow
        "ERROR": "\033[31m",     # Red
        "CRITICAL": "\033[1;31m" # Bold Red
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, self.RESET)
        level_colored = f"{color}{record.levelname:<8}{self.RESET}"
        
        # Save original levelname to restore after formatting
        orig_levelname = record.levelname
        record.levelname = level_colored
        try:
            formatted = super().format(record)
        finally:
            record.levelname = orig_levelname
        return formatted


def setup_logging(log_dir: str | Path | None = None, default_level: str = "INFO") -> None:
    """Configures centralized structured logging with console and rotating file outputs."""
    if log_dir is None:
        # Default logs directory inside backend root
        log_dir = Path(__file__).resolve().parent.parent.parent / "logs"
    else:
        log_dir = Path(log_dir)

    log_dir.mkdir(parents=True, exist_ok=True)

    app_log_path = log_dir / "app.log"
    error_log_path = log_dir / "error.log"

    logging_config: dict[str, Any] = {
        "version": 1,
        "disable_existing_loggers": False,
        "filters": {
            "correlation_filter": {
                "()": CorrelationContextFilter,
            },
        },
        "formatters": {
            "colored_console": {
                "()": ColoredConsoleFormatter,
                "format": "%(asctime)s | %(levelname)s | [%(request_id)s] %(name)s - %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
            "file_detailed": {
                "format": "%(asctime)s | %(levelname)-8s | [req:%(request_id)s conv:%(conversation_id)s user:%(user_id)s] | %(name)s:%(funcName)s:%(lineno)d - %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
            "json": {
                "format": '{"time":"%(asctime)s","level":"%(levelname)s","req_id":"%(request_id)s","conv_id":"%(conversation_id)s","user_id":"%(user_id)s","logger":"%(name)s","func":"%(funcName)s","line":%(lineno)d,"msg":"%(message)s"}',
                "datefmt": "%Y-%m-%dT%H:%M:%SZ",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "level": default_level,
                "formatter": "colored_console",
                "filters": ["correlation_filter"],
                "stream": "ext://sys.stdout",
            },
            "app_file": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": "INFO",
                "formatter": "file_detailed",
                "filters": ["correlation_filter"],
                "filename": str(app_log_path),
                "maxBytes": 10 * 1024 * 1024,  # 10 MB per file
                "backupCount": 5,
                "encoding": "utf-8",
            },
            "error_file": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": "ERROR",
                "formatter": "file_detailed",
                "filters": ["correlation_filter"],
                "filename": str(error_log_path),
                "maxBytes": 10 * 1024 * 1024,  # 10 MB per file
                "backupCount": 5,
                "encoding": "utf-8",
            },
        },
        "loggers": {
            # Silence noisy external libraries
            "uvicorn.access": {"level": "WARNING"},
            "httpcore": {"level": "WARNING"},
            "httpx": {"level": "WARNING"},
            "google": {"level": "WARNING"},
            "urllib3": {"level": "WARNING"},
            "asyncio": {"level": "WARNING"},
        },
        "root": {
            "level": default_level,
            "handlers": ["console", "app_file", "error_file"],
        },
    }

    logging.config.dictConfig(logging_config)
    logging.getLogger("app.core.logging").info(f"Structured logging initialized (log_dir={log_dir})")


# Automatically initialize logging on import
setup_logging()

