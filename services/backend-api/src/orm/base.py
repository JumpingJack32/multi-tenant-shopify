from sqlmodel import SQLModel, Field
from uuid import uuid4
from datetime import datetime


class BaseModel(SQLModel):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    tenant_id: str = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
