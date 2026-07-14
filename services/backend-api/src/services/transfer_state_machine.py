from dataclasses import dataclass

VALID_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"pending", "cancelled"},
    "pending": {"in_transit", "cancelled"},
    "in_transit": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}


@dataclass
class TransferStateError(Exception):
    current_status: str
    target_status: str
    message: str


def validate_transition(current_status: str, target_status: str) -> None:
    if current_status not in VALID_TRANSITIONS:
        raise TransferStateError(
            current_status=current_status,
            target_status=target_status,
            message=f"Unknown status: {current_status}",
        )

    allowed = VALID_TRANSITIONS.get(current_status, set())

    if target_status not in allowed:
        raise TransferStateError(
            current_status=current_status,
            target_status=target_status,
            message=f"Cannot transition from '{current_status}' to '{target_status}'",
        )
