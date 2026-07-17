"""Tax calculation service — half-up rounding, inclusive/exclusive support."""


def _round_half_up(value: int, divisor: int) -> int:
    """Integer division with half-up rounding."""
    return (value + divisor // 2) // divisor


def calculate_tax(
    subtotal: int,
    tax_rate: int,
    tax_inclusive: bool,
) -> tuple[int, int]:
    """Calculate tax amount and adjusted subtotal.

    Args:
        subtotal: Line or order subtotal in pence.
        tax_rate: Rate × 10000 (e.g. 825 = 8.25%).
        tax_inclusive: True if subtotal already includes tax.

    Returns:
        (tax_amount_in_pence, adjusted_subtotal_in_pence)
    """
    if tax_inclusive:
        divisor = 10_000 + tax_rate
        base = _round_half_up(subtotal * 10_000, divisor)
        tax = subtotal - base
        return tax, base
    else:
        tax = _round_half_up(subtotal * tax_rate, 10_000)
        return tax, subtotal
