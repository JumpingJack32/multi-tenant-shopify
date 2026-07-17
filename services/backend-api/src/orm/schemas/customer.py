from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel as PydanticBaseModel, Field


class CustomerCreate(PydanticBaseModel):
    email: Optional[str] = Field(None, max_length=255)
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email_subscription_status: Optional[str] = Field(None, max_length=20)
    email_subscription_type: Optional[str] = Field(None, max_length=20)
    tags: dict = Field(default_factory=dict)
    notes: Optional[str] = Field(None)
    language: str = "en"
    email_marketing_consent: bool = False
    sms_marketing_consent: bool = False
    tax_exempt: bool = False
    tax_exempt_reason: Optional[str] = Field(None, max_length=255)
    # Address sub-fields — create CustomerAddress row when present
    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    address_city: Optional[str] = Field(None, max_length=100)
    address_province: Optional[str] = Field(None, max_length=100)
    address_postal_code: Optional[str] = Field(None, max_length=20)
    address_country: Optional[str] = Field(None, max_length=100)
    address_company: Optional[str] = Field(None, max_length=255)
    address_phone: Optional[str] = Field(None, max_length=50)


class CustomerUpdate(PydanticBaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    is_verified: Optional[bool] = None
    email_subscription_status: Optional[str] = Field(None, max_length=20)
    email_subscription_type: Optional[str] = Field(None, max_length=20)
    tags: Optional[dict] = None
    notes: Optional[str] = None


class CustomerResponse(PydanticBaseModel):
    id: UUID
    tenant_id: UUID
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    is_verified: bool
    total_orders: int
    total_spent: int
    last_order_at: Optional[datetime] = None
    email_subscription_status: str = "subscribed"
    email_subscription_type: str = "digital"
    tags: dict = {}
    notes: Optional[str] = None
    store_credit: int = 0
    last_synced_at: Optional[datetime] = None
    language: str = "en"
    email_marketing_consent: bool = False
    sms_marketing_consent: bool = False
    tax_exempt: bool = False
    tax_exempt_reason: Optional[str] = None

    model_config = {"from_attributes": True}


class CustomerAddressCreate(PydanticBaseModel):
    address_type: str = "shipping"
    line1: str = Field(..., max_length=255)
    line2: Optional[str] = Field(None, max_length=255)
    city: str = Field(..., max_length=100)
    province: Optional[str] = Field(None, max_length=100)
    postal_code: str = Field(..., max_length=20)
    country: str = Field(..., max_length=100)
    company: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    label: str = "Home"
    is_default_shipping: bool = False
    is_default_billing: bool = False


class CustomerAddressUpdate(PydanticBaseModel):
    address_type: Optional[str] = Field(None, max_length=20)
    line1: Optional[str] = Field(None, max_length=255)
    line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    province: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=100)
    company: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    label: Optional[str] = Field(None, max_length=50)
    is_default_shipping: Optional[bool] = None
    is_default_billing: Optional[bool] = None


class CustomerAddressResponse(PydanticBaseModel):
    id: UUID
    address_type: str
    line1: str
    line2: Optional[str] = None
    city: str
    province: Optional[str] = None
    postal_code: str
    country: str
    is_default: bool

    model_config = {"from_attributes": True}


class CustomerOrderResponse(PydanticBaseModel):
    id: UUID
    order_number: str
    total: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CustomerDetailResponse(CustomerResponse):
    average_order_value: int = 0
    addresses: list[CustomerAddressResponse] = []
    orders: list[CustomerOrderResponse] = []


class StoreCreditTransactionResponse(PydanticBaseModel):
    id: UUID
    customer_id: UUID
    amount: int
    balance_after: int
    reason: str
    created_by: Optional[UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class StoreCreditAddRequest(PydanticBaseModel):
    amount: int = Field(..., description="Amount in pence. Positive to add, negative to deduct.")
    reason: str = Field(..., max_length=500)


class TimelineEventResponse(PydanticBaseModel):
    id: UUID
    customer_id: UUID
    event_type: str
    description: str
    extra_data: dict = {}
    created_by: Optional[UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TimelineEventCreate(PydanticBaseModel):
    event_type: str = Field(..., max_length=50)
    description: str = Field(..., max_length=1000)
    extra_data: dict = Field(default_factory=dict)


class CustomerMetricsResponse(PydanticBaseModel):
    total_customers: int
    total_base: int = 0
    percentage: float = 0.0
    subscribed: int
    unsubscribed: int
    bounced: int
    with_store_credit: int
    total_store_credit: int
    avg_spent: int
