from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.tenant import TenantTaxConfig
from src.orm.schemas.tax import TaxConfigResponse, TaxConfigUpdate

router = APIRouter(tags=["settings"])


@router.get("/settings/taxes", response_model=TaxConfigResponse)
async def get_tax_config(
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(TenantTaxConfig).where(TenantTaxConfig.tenant_id == tenant_id)
    config = (await db.exec(stmt)).one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Tax config not found")
    return config


@router.put("/settings/taxes", response_model=TaxConfigResponse)
async def update_tax_config(
    body: TaxConfigUpdate,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(TenantTaxConfig).where(TenantTaxConfig.tenant_id == tenant_id)
    config = (await db.exec(stmt)).one_or_none()
    if not config:
        config = TenantTaxConfig(tenant_id=tenant_id)
        db.add(config)

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(config, key, value)

    await db.flush()
    await db.refresh(config)
    return config
