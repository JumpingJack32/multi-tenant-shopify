"""Unit tests for the PO state machine."""

import pytest

from src.services.po_state_machine import (
    POStateError,
    validate_transition,
    status_label,
)


class TestTransitions:
    def test_draft_to_pending_review(self):
        validate_transition("draft", "pending_review")

    def test_draft_to_cancelled(self):
        validate_transition("draft", "cancelled")

    def test_pending_review_to_sent(self):
        validate_transition("pending_review", "sent")

    def test_pending_review_to_cancelled(self):
        validate_transition("pending_review", "cancelled")

    def test_sent_to_confirmed(self):
        validate_transition("sent", "confirmed")

    def test_sent_to_cancelled(self):
        validate_transition("sent", "cancelled")

    def test_confirmed_to_in_transit(self):
        validate_transition("confirmed", "in_transit")

    def test_confirmed_to_cancelled(self):
        validate_transition("confirmed", "cancelled")

    def test_in_transit_to_closed(self):
        validate_transition("in_transit", "closed")

    def test_in_transit_to_cancelled(self):
        validate_transition("in_transit", "cancelled")


class TestInvalidTransitions:
    def test_draft_to_closed_raises(self):
        with pytest.raises(POStateError) as exc:
            validate_transition("draft", "closed")
        assert "Cannot transition" in exc.value.message

    def test_pending_review_to_in_transit_raises(self):
        with pytest.raises(POStateError):
            validate_transition("pending_review", "in_transit")

    def test_closed_to_anything_raises(self):
        with pytest.raises(POStateError):
            validate_transition("closed", "draft")
        with pytest.raises(POStateError):
            validate_transition("closed", "pending_review")
        with pytest.raises(POStateError):
            validate_transition("closed", "sent")

    def test_cancelled_to_anything_raises(self):
        with pytest.raises(POStateError):
            validate_transition("cancelled", "draft")
        with pytest.raises(POStateError):
            validate_transition("cancelled", "closed")

    def test_unknown_status_raises(self):
        with pytest.raises(POStateError) as exc:
            validate_transition("nonexistent", "draft")
        assert "Unknown status" in exc.value.message


class TestDropshipTransitions:
    def test_in_transit_to_partially_received_not_allowed(self):
        with pytest.raises(POStateError):
            validate_transition("in_transit", "partially_received", fulfillment_strategy="dropship")

    def test_in_transit_to_closed_allowed(self):
        validate_transition("in_transit", "closed", fulfillment_strategy="dropship")


class TestWarehouseTransitions:
    def test_in_transit_to_partially_received_allowed(self):
        validate_transition("in_transit", "partially_received", fulfillment_strategy="warehouse")

    def test_partially_received_to_received(self):
        validate_transition("partially_received", "received", fulfillment_strategy="warehouse")

    def test_received_to_closed(self):
        validate_transition("received", "closed", fulfillment_strategy="warehouse")


class TestStatusLabel:
    def test_labels(self):
        assert status_label("pending_review") == "Pending Review"
        assert status_label("in_transit") == "In Transit"
        assert status_label("partially_received") == "Partially Received"
        assert status_label("cancelled") == "Cancelled"
        assert status_label("closed") == "Closed"

    def test_unknown_status(self):
        assert status_label("something_else") == "Something Else"
