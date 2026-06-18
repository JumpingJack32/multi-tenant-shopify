from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from src.dependencies import get_current_tenant_id
from src.orm.models.tenant import Tenant
from src.orm.schemas.tenant import TenantCreate, TenantUpdate, TenantResponse

router = APIRouter()


@router.get("/", response_model=list[TenantResponse])
async def list_tenants(
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db),
):
    stmt = select(Tenant).where(Tenant.tenant_id == tenant_id)
    results = db.exec(stmt).all()
    return results


@router.post("/", response_model=TenantResponse)
async def create_tenant(
    data: TenantCreate,
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db),
):
    tenant = Tenant(**data.model_dump())
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: str,
    db: Session = Depends(get_db),
):
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.put("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: str,
    data: TenantUpdate,
    db: Session = Depends(get_db),
):
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(tenant, key, value)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.delete("/{tenant_id}")
async def delete_tenant(
    tenant_id: str,
    db: Session = Depends(get_db),
):
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    db.delete(tenant)
    db.commit()
    return {"message": "Tenant deleted"}
