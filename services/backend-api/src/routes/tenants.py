from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_db
from src.orm.models.tenant import Tenant
from src.orm.schemas.tenant import TenantCreate, TenantResponse, TenantUpdate

router = APIRouter()


@router.get("/", response_model=list[TenantResponse])
async def list_tenants(
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Tenant).order_by(Tenant.created_at)
    result = await db.exec(stmt)
    tenants = result.all()
    return tenants


@router.post("/", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    data: TenantCreate,
    db: AsyncSession = Depends(get_db),
):
    tenant = Tenant(**data.model_dump())
    db.add(tenant)
    await db.flush()
    await db.refresh(tenant)
    await db.commit()
    return tenant


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Tenant).where(Tenant.tenant_id == tenant_id)
    result = await db.exec(stmt)
    tenant = result.one_or_none()

    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return tenant


@router.put("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: UUID,
    data: TenantUpdate,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Tenant).where(Tenant.tenant_id == tenant_id)
    result = await db.exec(stmt)
    tenant = result.one_or_none()

    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(tenant, key, value)

    await db.flush()
    await db.refresh(tenant)
    await db.commit()
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Tenant).where(Tenant.tenant_id == tenant_id)
    result = await db.exec(stmt)
    tenant = result.one_or_none()

    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    await db.delete(tenant)
    await db.flush()
