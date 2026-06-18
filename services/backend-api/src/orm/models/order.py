from sqlmodel import Field, SQLModel
from src.orm.base import BaseModel


class Order(BaseModel, table=True):
    __tablename__ = "orders"

    customer_email: str
    status: str = Field(default="pending")
    total: int = Field(default=0, ge=0)


class OrderItem(BaseModel, table=True):
    __tablename__ = "order_items"

    order_id: str
    product_id: str
    quantity: int = Field(gt=0)
    unit_price: int = Field(ge=0)
