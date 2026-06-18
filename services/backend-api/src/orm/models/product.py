from sqlmodel import Field
from src.orm.base import BaseModel


class Product(BaseModel, table=True):
    __tablename__ = "products"

    name: str
    description: str | None = None
    price: int = Field(ge=0)
    sku: str | None = None
    status: str = Field(default="draft")
