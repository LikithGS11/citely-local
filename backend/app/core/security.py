"""
Authentication is currently DISABLED for this project.

Every endpoint that previously required a JWT now receives a default local
user (created on first request if the database is empty). Password hashing
is kept only because scripts/seed_data.py still stores hashed passwords.
"""
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import Depends
from app.core.database import get_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEFAULT_USER_EMAIL = "local@enterprise.ai"


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


async def get_current_user(db: AsyncSession = Depends(get_db)):
    """
    No-auth stand-in: returns the first admin user in the database, or the
    first user of any role, creating a default local admin if none exist.
    """
    from app.models.all_models import User

    result = await db.execute(select(User).where(User.role == "admin").limit(1))
    user = result.scalar_one_or_none()
    if user:
        return user

    result = await db.execute(select(User).limit(1))
    user = result.scalar_one_or_none()
    if user:
        return user

    user = User(
        email=DEFAULT_USER_EMAIL,
        hashed_password=get_password_hash("local"),
        full_name="Local User",
        role="admin",
        department="General",
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
