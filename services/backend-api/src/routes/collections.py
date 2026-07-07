from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select, func, delete
from src.dependencies import get_db, get_current_tenant_id
from src.orm.models.collection import Collection, ProductCollection
from src.orm.models.product import Product
from src.orm.schemas.collection import CollectionCreate, CollectionUpdate, CollectionResponse

router = APIRouter(tags=["collections"])


@router.get("/collections/", response_model=list[CollectionResponse])
async def list_collections(
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    include_inactive: bool = False,
):
    stmt = select(Collection).where(Collection.tenant_id == tenant_id)
    if not include_inactive:
        stmt = stmt.where(Collection.is_active == True)
    stmt = stmt.order_by(Collection.sort_order, Collection.name)
    collections = (await db.exec(stmt)).all()
    result = []
    for col in collections:
        count_stmt = select(func.count()).select_from(ProductCollection).where(
            ProductCollection.collection_id == col.id,
        )
        count = (await db.exec(count_stmt)).one()
        result.append(CollectionResponse(
            **col.model_dump(),
            product_count=count,
        ))
    return result


@router.post("/collections/", response_model=CollectionResponse)
async def create_collection(
    data: CollectionCreate,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    col = Collection(**data.model_dump(), tenant_id=tenant_id)
    db.add(col)
    await db.commit()
    await db.refresh(col)
    return CollectionResponse(**col.model_dump(), product_count=0)


@router.put("/collections/{collection_id}", response_model=CollectionResponse)
async def update_collection(
    collection_id: UUID,
    data: CollectionUpdate,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(Collection).where(
        Collection.id == collection_id,
        Collection.tenant_id == tenant_id,
    )
    col = (await db.exec(stmt)).one_or_none()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(col, key, value)
    await db.commit()
    await db.refresh(col)
    count_stmt = select(func.count()).select_from(ProductCollection).where(
        ProductCollection.collection_id == col.id,
    )
    count = (await db.exec(count_stmt)).one()
    return CollectionResponse(**col.model_dump(), product_count=count)


@router.delete("/collections/{collection_id}")
async def delete_collection(
    collection_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(Collection).where(
        Collection.id == collection_id,
        Collection.tenant_id == tenant_id,
    )
    col = (await db.exec(stmt)).one_or_none()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    if not col.is_active:
        return {"status": "already_inactive"}
    col.is_active = False
    await db.commit()
    return {"status": "deactivated"}


@router.get("/collections/{collection_id}/products", response_model=list[dict])
async def list_collection_products(
    collection_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    col_stmt = select(Collection).where(
        Collection.id == collection_id,
        Collection.tenant_id == tenant_id,
    )
    col = (await db.exec(col_stmt)).one_or_none()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")

    stmt = select(Product).join(ProductCollection).where(
        ProductCollection.collection_id == collection_id,
        Product.tenant_id == tenant_id,
    )
    products = (await db.exec(stmt)).all()
    return [p.model_dump() for p in products]


@router.post("/collections/{collection_id}/products")
async def add_products_to_collection(
    collection_id: UUID,
    body: dict,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    col_stmt = select(Collection).where(
        Collection.id == collection_id,
        Collection.tenant_id == tenant_id,
    )
    col = (await db.exec(col_stmt)).one_or_none()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")

    product_ids = body.get("product_ids", [])
    added = 0
    for pid in product_ids:
        existing = (await db.exec(
            select(ProductCollection).where(
                ProductCollection.collection_id == collection_id,
                ProductCollection.product_id == pid,
            )
        )).one_or_none()
        if not existing:
            link = ProductCollection(
                product_id=pid,
                collection_id=collection_id,
                tenant_id=tenant_id,
            )
            db.add(link)
            added += 1
    await db.commit()
    return {"added": added, "product_ids": product_ids}


@router.delete("/collections/{collection_id}/products/{product_id}")
async def remove_product_from_collection(
    collection_id: UUID,
    product_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    col_stmt = select(Collection).where(
        Collection.id == collection_id,
        Collection.tenant_id == tenant_id,
    )
    col = (await db.exec(col_stmt)).one_or_none()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")

    link = (await db.exec(
        select(ProductCollection).where(
            ProductCollection.collection_id == collection_id,
            ProductCollection.product_id == product_id,
        )
    )).one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Product not found in collection")

    await db.delete(link)
    await db.commit()
    return {"status": "removed"}
