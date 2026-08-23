from fastapi import APIRouter, Depends
from pydantic import BaseModel
import uuid
from datetime import datetime

from app.core.dependencies import get_current_user
from app.core.users import Users

auth_router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


class UserProfileResponse(BaseModel):
    id: uuid.UUID
    email: str | None = None
    name: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


@auth_router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Get authenticated Supabase user profile",
)
async def get_me(
    current_user: Users = Depends(get_current_user),
):
    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        created_at=current_user.created_at,
    )
