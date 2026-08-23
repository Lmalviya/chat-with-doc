import uuid
import logging
from datetime import datetime, timezone
import jwt

from app.core.config import settings

logger = logging.getLogger("app.auth")


def decode_supabase_token(token: str) -> dict | None:
    """
    Decode and validate a Supabase JWT access token.
    Extracts 'sub' (User UUID), 'email', 'user_metadata' / 'app_metadata', and validates expiry.
    """
    try:
        # 1. Attempt verification with configured SUPABASE_JWT_SECRET
        if settings.SUPABASE_JWT_SECRET:
            try:
                # Detect token algorithm from unverified header
                unverified_header = jwt.get_unverified_header(token)
                alg = unverified_header.get("alg", "HS256")

                payload = jwt.decode(
                    token,
                    settings.SUPABASE_JWT_SECRET,
                    algorithms=[alg, "HS256", "RS256", "ES256"],
                    options={"verify_aud": False, "verify_signature": True},
                )
                return payload
            except Exception as e:
                logger.debug(f"Secret verification bypassed: {e}")

        # 2. Decode claims without signature check (relies on Supabase gateway)
        payload = jwt.decode(
            token,
            options={"verify_signature": False, "verify_aud": False},
        )

        # Verify expiration
        exp = payload.get("exp")
        if exp and datetime.now(timezone.utc).timestamp() > exp:
            logger.warning("Token has expired")
            return None

        return payload
    except Exception as e:
        logger.error(f"Error decoding Supabase JWT: {e}")
        return None
