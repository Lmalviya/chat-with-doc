import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.core.users import Users
from app.auth.security import hash_password, verify_password, create_access_token
from app.auth.schemas import UserSignupRequest, UserLoginRequest, AuthTokenResponse, UserOut


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_by_email(self, email: str) -> Users | None:
        stmt = select(Users).where(Users.email == email.strip().lower())
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_user_by_id(self, user_id: uuid.UUID) -> Users | None:
        stmt = select(Users).where(Users.id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def signup(self, payload: UserSignupRequest) -> AuthTokenResponse:
        normalized_email = payload.email.strip().lower()
        existing_user = await self.get_user_by_email(normalized_email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address already exists.",
            )

        new_user = Users(
            id=uuid.uuid4(),
            email=normalized_email,
            hashed_password=hash_password(payload.password),
            name=payload.name.strip() if payload.name else None,
        )
        self.db.add(new_user)
        await self.db.commit()
        await self.db.refresh(new_user)

        token = create_access_token(user_id=new_user.id, email=new_user.email)
        return AuthTokenResponse(
            access_token=token,
            token_type="bearer",
            user=UserOut.model_validate(new_user),
        )

    async def login(self, payload: UserLoginRequest) -> AuthTokenResponse:
        normalized_email = payload.email.strip().lower()
        user = await self.get_user_by_email(normalized_email)
        if not user or not user.hashed_password or not verify_password(payload.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = create_access_token(user_id=user.id, email=user.email)
        return AuthTokenResponse(
            access_token=token,
            token_type="bearer",
            user=UserOut.model_validate(user),
        )
