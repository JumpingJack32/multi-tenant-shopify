from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_db
from src.core.exchange_rates.service import RateService, get_minor_unit

router = APIRouter(prefix="/api/v1/exchange-rates", tags=["exchange-rates"])


@router.get("")
async def list_rates(
    base_currency: str = Query("USD", description="Base currency code"),
    db: AsyncSession = Depends(get_db),
):
    """Return all exchange rates for a given base currency."""
    svc = RateService()
    data = await svc.get_all_rates(base_currency.upper(), db)
    if data is None:
        raise HTTPException(
            status_code=404,
            detail=f"No exchange rates found for base currency {base_currency.upper()}",
        )
    return {
        "base_currency": data.base_currency,
        "rates": {k: str(v) for k, v in data.rates.items()},
        "timestamp": data.timestamp.isoformat(),
    }


@router.get("/{target_currency}")
async def get_rate(
    target_currency: str,
    base_currency: str = Query("USD", description="Source currency code"),
    db: AsyncSession = Depends(get_db),
):
    """Get the exchange rate between two currencies."""
    svc = RateService()
    try:
        rate = await svc.get_rate_or_db(
            base_currency.upper(), target_currency.upper(), db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {
        "base_currency": base_currency.upper(),
        "target_currency": target_currency.upper(),
        "rate": str(rate),
    }


@router.get("/convert")
async def convert_amount(
    amount: int = Query(..., description="Amount in minor units (e.g. cents)"),
    from_currency: str = Query(..., description="Source currency code"),
    to_currency: str = Query(..., description="Target currency code"),
    db: AsyncSession = Depends(get_db),
):
    """Convert an amount from one currency to another."""
    svc = RateService()
    decimal_amount = Decimal(amount) / (10 ** get_minor_unit(from_currency))
    try:
        result = await svc.convert(decimal_amount, from_currency, to_currency, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {
        "from_currency": from_currency.upper(),
        "to_currency": to_currency.upper(),
        "original_amount": amount,
        "original_currency": from_currency.upper(),
        "converted_amount": result,
        "converted_currency": to_currency.upper(),
    }
