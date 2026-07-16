from sqlalchemy import JSON
from sqlmodel import Column, Field

from src.orm.base import BaseModel


class SavedSegment(BaseModel, table=True):
    __tablename__ = "saved_segments"  # type: ignore

    name: str = Field(max_length=255)
    filters: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False, default=dict))
    customer_count: int = Field(default=0)
