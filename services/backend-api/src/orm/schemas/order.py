from pydantic import BaseModel as PydanticBaseModel


class OrderCreate(PydanticBaseModel):
    customer_email: str
    items: list[dict]


class OrderUpdate(PydanticBaseModel):
    status: str | None = None


class OrderResponse(PydanticBaseModel):
    id: str
    tenant_id: str
    customer_email: str
    status: str
    total: int
    created_at: str
    updated_at: str


class OrderItemCreate(PydanticBaseModel):
    product_id: str
    quantity: int


class OrderItemResponse(PydanticBaseModel):
    id: str
    order_id: str
    product_id: str
    tenant_id: str
    quantity: int
    unit_price: int
