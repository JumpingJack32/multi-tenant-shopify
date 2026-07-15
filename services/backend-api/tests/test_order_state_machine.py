"""Unit tests for the Order status state machine."""

import pytest

from src.services.order_state_machine import (
    OrderStateError,
    VALID_TRANSITIONS,
    validate_transition,
)


class TestValidTransitions:
    def test_pending_to_confirmed(self):
        validate_transition("pending", "confirmed")

    def test_pending_to_paid(self):
        validate_transition("pending", "paid")

    def test_pending_to_cancelled(self):
        validate_transition("pending", "cancelled")

    def test_confirmed_to_paid(self):
        validate_transition("confirmed", "paid")

    def test_confirmed_to_processing(self):
        validate_transition("confirmed", "processing")

    def test_confirmed_to_shipped(self):
        validate_transition("confirmed", "shipped")

    def test_confirmed_to_cancelled(self):
        validate_transition("confirmed", "cancelled")

    def test_paid_to_processing(self):
        validate_transition("paid", "processing")

    def test_paid_to_shipped(self):
        validate_transition("paid", "shipped")

    def test_paid_to_cancelled(self):
        validate_transition("paid", "cancelled")

    def test_paid_to_refunded(self):
        validate_transition("paid", "refunded")

    def test_processing_to_shipped(self):
        validate_transition("processing", "shipped")

    def test_processing_to_cancelled(self):
        validate_transition("processing", "cancelled")

    def test_shipped_to_delivered(self):
        validate_transition("shipped", "delivered")

    def test_shipped_to_cancelled(self):
        validate_transition("shipped", "cancelled")

    def test_shipped_to_refunded(self):
        validate_transition("shipped", "refunded")

    def test_delivered_to_refunded(self):
        validate_transition("delivered", "refunded")


class TestInvalidTransitions:
    def test_pending_to_delivered_raises(self):
        with pytest.raises(OrderStateError) as exc:
            validate_transition("pending", "delivered")
        assert "Cannot transition" in exc.value.message

    def test_pending_to_refunded_raises(self):
        with pytest.raises(OrderStateError):
            validate_transition("pending", "refunded")

    def test_cancelled_to_anything_raises(self):
        for target in ["pending", "confirmed", "paid", "processing", "shipped", "delivered", "refunded"]:
            with pytest.raises(OrderStateError):
                validate_transition("cancelled", target)

    def test_refunded_to_anything_raises(self):
        for target in ["pending", "confirmed", "paid", "processing", "shipped", "delivered", "cancelled"]:
            with pytest.raises(OrderStateError):
                validate_transition("refunded", target)

    def test_delivered_to_shipped_raises(self):
        with pytest.raises(OrderStateError):
            validate_transition("delivered", "shipped")

    def test_delivered_to_cancelled_raises(self):
        with pytest.raises(OrderStateError):
            validate_transition("delivered", "cancelled")

    def test_unknown_status_raises(self):
        with pytest.raises(OrderStateError) as exc:
            validate_transition("nonexistent", "pending")
        assert "Unknown status" in exc.value.message

    def test_same_status_noop(self):
        for status in VALID_TRANSITIONS:
            if status in ("cancelled", "refunded"):
                continue
            with pytest.raises(OrderStateError):
                validate_transition(status, status)
