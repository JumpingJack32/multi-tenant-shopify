"""Purchase Order state machine with transition guards.

Lifecycle: draft → pending_review → sent → confirmed → in_transit → closed
                                                                   ↘ cancelled
Dropship path: in_transit → closed (no partial receive)
Warehouse path (Phase 2): in_transit → partially_received → received → closed
"""

from dataclasses import dataclass


VALID_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"pending_review", "cancelled"},
    "pending_review": {"sent", "cancelled"},
    "sent": {"confirmed", "cancelled"},
    "confirmed": {"in_transit", "cancelled"},
    "in_transit": {"closed", "cancelled", "partially_received"},
    "partially_received": {"received", "cancelled"},
    "received": {"closed", "cancelled"},
    "closed": set(),
    "cancelled": set(),
}

ALLOWED_DROPSHIP_TRANSITIONS: dict[str, set[str]] = {
    "in_transit": {"closed", "cancelled"},
}

ALLOWED_WAREHOUSE_TRANSITIONS: dict[str, set[str]] = {
    "in_transit": {"closed", "cancelled", "partially_received"},
    "partially_received": {"received", "cancelled"},
    "received": {"closed", "cancelled"},
}


@dataclass
class POStateError(Exception):
    current_status: str
    target_status: str
    message: str


def validate_transition(
    current_status: str,
    target_status: str,
    fulfillment_strategy: str = "dropship",
) -> None:
    if current_status not in VALID_TRANSITIONS:
        raise POStateError(
            current_status=current_status,
            target_status=target_status,
            message=f"Unknown status: {current_status}",
        )

    allowed = VALID_TRANSITIONS.get(current_status, set())

    if fulfillment_strategy == "dropship" and current_status in ALLOWED_DROPSHIP_TRANSITIONS:
        allowed = ALLOWED_DROPSHIP_TRANSITIONS[current_status]

    if fulfillment_strategy == "warehouse" and current_status in ALLOWED_WAREHOUSE_TRANSITIONS:
        allowed = ALLOWED_WAREHOUSE_TRANSITIONS[current_status]

    if target_status not in allowed:
        raise POStateError(
            current_status=current_status,
            target_status=target_status,
            message=f"Cannot transition from '{current_status}' to '{target_status}'",
        )


def status_label(status: str) -> str:
    labels = {
        "draft": "Draft",
        "pending_review": "Pending Review",
        "sent": "Sent to Supplier",
        "confirmed": "Confirmed",
        "in_transit": "In Transit",
        "partially_received": "Partially Received",
        "received": "Received",
        "closed": "Closed",
        "cancelled": "Cancelled",
    }
    return labels.get(status, status.replace("_", " ").title())
