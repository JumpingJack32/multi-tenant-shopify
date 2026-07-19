"""Order status state machine with transition guards.

Lifecycle:
  pending → confirmed → paid → processing → shipped → delivered
     ↓          ↓          ↓         ↓            ↓
  cancelled   cancelled  cancelled  cancelled   cancelled → refunded
                          → refunded              refunded
"""

from dataclasses import dataclass

from src.orm.models.order import OrderStatus

VALID_TRANSITIONS: dict[str, set[str]] = {
    # Checkout flow
    OrderStatus.PENDING_PAYMENT.value: {OrderStatus.PAYMENT_PROCESSING.value, OrderStatus.PAID.value, OrderStatus.PAYMENT_FAILED.value},
    OrderStatus.PAYMENT_PROCESSING.value: {OrderStatus.PAID.value, OrderStatus.PAYMENT_FAILED.value},
    OrderStatus.PAYMENT_FAILED.value: {OrderStatus.PENDING_PAYMENT.value},
    # Fulfillment flow (existing)
    OrderStatus.PENDING.value: {OrderStatus.CONFIRMED.value, OrderStatus.PAID.value, OrderStatus.CANCELLED.value},
    OrderStatus.CONFIRMED.value: {OrderStatus.PAID.value, OrderStatus.PROCESSING.value, OrderStatus.SHIPPED.value, OrderStatus.CANCELLED.value},
    OrderStatus.PAID.value: {OrderStatus.PROCESSING.value, OrderStatus.SHIPPED.value, OrderStatus.CANCELLED.value, OrderStatus.REFUNDED.value},
    OrderStatus.PROCESSING.value: {OrderStatus.SHIPPED.value, OrderStatus.CANCELLED.value},
    OrderStatus.SHIPPED.value: {OrderStatus.DELIVERED.value, OrderStatus.CANCELLED.value, OrderStatus.REFUNDED.value},
    OrderStatus.DELIVERED.value: {OrderStatus.REFUNDED.value},
    OrderStatus.CANCELLED.value: set(),
    OrderStatus.REFUNDED.value: set(),
}


@dataclass
class OrderStateError(Exception):
    current_status: str
    target_status: str
    message: str


def validate_transition(current_status: str, target_status: str) -> None:
    if current_status not in VALID_TRANSITIONS:
        raise OrderStateError(
            current_status=current_status,
            target_status=target_status,
            message=f"Unknown status: {current_status}",
        )

    allowed = VALID_TRANSITIONS.get(current_status, set())

    if target_status not in allowed:
        raise OrderStateError(
            current_status=current_status,
            target_status=target_status,
            message=f"Cannot transition from '{current_status}' to '{target_status}'",
        )
