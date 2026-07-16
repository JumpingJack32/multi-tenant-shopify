# Category Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add single-category product filtering to the storefront PLP with admin category management.

**Architecture:** New `categories` table (migration 0004) with tenant-scoped RLS and composite unique constraint on `(tenant_id, slug)`. Products get a nullable `category_id` FK (ON DELETE SET NULL). Backend adds `?category=<slug>` filter to the public products endpoint and new category CRUD routes. Storefront adds `/shop/[category]` and `/shop/all` routes. Admin gets a category management page and product form combobox.

**Tech Stack:** FastAPI + SQLModel + Alembic, Next.js 16 + shadcn combobox, TypeScript, pnpm workspaces

---

### Task 1: Alembic Migration 0004 — Categories Table

**Files:**

- Create: `services/backend-api/alembic/versions/0004_add_categories.py`

**Interfaces:**

- Consumes: existing migration 0003
- Produces: `categories` table with RLS + `category_id` on `products`

- [ ] **Step 1: Write the migration**

```python
"""add categories table and category_id to products

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-07 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("SET app.current_tenant_id = '00000000-0000-0000-0000-000000000000'")

    op.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            description TEXT,
            image_url VARCHAR(2048),
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_categories_tenant_slug
        ON categories (tenant_id, slug)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_categories_tenant_active
        ON categories (tenant_id, is_active)
    """)
    op.execute("""
        ALTER TABLE categories ENABLE ROW LEVEL SECURITY
    """)
    op.execute("""
        CREATE POLICY tenant_isolation_categories ON categories
        AS PERMISSIVE FOR ALL
        TO public
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    """)
    op.execute("""
        ALTER TABLE products
        ADD COLUMN category_id UUID
        REFERENCES categories(id) ON DELETE SET NULL
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_products_category
        ON products (tenant_id, category_id)
    """)

    op.execute("RESET app.current_tenant_id")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_products_category")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS category_id")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_categories ON categories")
    op.execute("ALTER TABLE categories DISABLE ROW LEVEL SECURITY")
    op.execute("DROP INDEX IF EXISTS ix_categories_tenant_active")
    op.execute("DROP INDEX IF EXISTS ix_categories_tenant_slug")
    op.execute("DROP TABLE IF EXISTS categories")
```

- [ ] **Step 2: Run migration**

```bash
cd services/backend-api && alembic upgrade head
```

Expected: tables created, no errors

- [ ] **Step 3: Verify schema**

```bash
cd services/backend-api && alembic check
```

Expected: "No new revisions"

- [ ] **Step 4: Commit**

```bash
git add services/backend-api/alembic/versions/0004_add_categories.py
git commit -m "feat(db): add categories table with RLS and product FK"
```

---

### Task 2: SQLModel + Pydantic Schemas for Category

**Files:**

- Modify: `services/backend-api/src/orm/models/product.py`
- Create: `services/backend-api/src/orm/models/category.py`
- Create: `services/backend-api/src/orm/schemas/category.py`
- Modify: `services/backend-api/src/orm/models/__init__.py`
- Modify: `services/backend-api/src/orm/schemas/__init__.py`

**Interfaces:**

- Consumes: migration 0004, BaseModel, existing Product model
- Produces: `Category` SQLModel, `CategoryCreate/Update/Response` Pydantic schemas

- [ ] **Step 1: Create Category ORM model**

```python
# services/backend-api/src/orm/models/category.py
from typing import Optional
from sqlmodel import Field, Relationship
from sqlalchemy import UniqueConstraint, Index
from src.orm.base import BaseModel


class Category(BaseModel, table=True):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("tenant_id", "slug", name="uq_categories_tenant_slug"),
        Index("ix_categories_tenant_active", "tenant_id", "is_active"),
    )

    name: str = Field(max_length=255)
    slug: str = Field(max_length=255)
    description: Optional[str] = Field(default=None)
    image_url: Optional[str] = Field(default=None, max_length=2048)
    sort_order: int = Field(default=0)
    is_active: bool = Field(default=True)

    products: list["Product"] = Relationship(back_populates="category")
```

- [ ] **Step 2: Add category relationship to Product model**

In `services/backend-api/src/orm/models/product.py`, add to `Product` class:

```python
# Add after images relationship line:
category_id: Optional[UUID] = Field(default=None, foreign_key="categories.id")
category: Optional["Category"] = Relationship(back_populates="products")
```

- [ ] **Step 3: Create Pydantic schemas**

```python
# services/backend-api/src/orm/schemas/category.py
from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    name: str = Field(max_length=255)
    slug: str = Field(max_length=255)
    description: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=255)
    slug: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class CategoryResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: int
    is_active: bool
    product_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Update **init**.py files**

In `services/backend-api/src/orm/models/__init__.py`, add:

```python
from src.orm.models.category import Category
```

In `services/backend-api/src/orm/schemas/__init__.py`, add:

```python
from src.orm.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
```

- [ ] **Step 5: Type-check and verify**

```bash
cd services/backend-api && uv run mypy src/orm/models/category.py src/orm/schemas/category.py
```

Expected: no type errors

- [ ] **Step 6: Commit**

```bash
git add services/backend-api/src/orm/models/category.py services/backend-api/src/orm/schemas/category.py services/backend-api/src/orm/models/product.py services/backend-api/src/orm/models/__init__.py services/backend-api/src/orm/schemas/__init__.py
git commit -m "feat(api): add Category SQLModel and Pydantic schemas"
```

---

### Task 3: Category API Routes

**Files:**

- Create: `services/backend-api/src/routes/categories.py`
- Modify: `services/backend-api/src/routes/public.py`
- Modify: `services/backend-api/src/main.py`

**Interfaces:**

- Consumes: Category ORM + schemas, existing product routes pattern, auth dependencies
- Produces: `GET/POST/PUT/DELETE /api/v1/categories/`, `GET /api/v1/public/categories/{tenant_slug}`

- [ ] **Step 1: Write category route tests** (in `tests/test_categories.py`)

```python
# services/backend-api/tests/test_categories.py
import pytest
from httpx import AsyncClient, ASGITransport
from src.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


async def test_create_category(client):
    response = await client.post(
        "/api/v1/categories/",
        json={"name": "Outerwear", "slug": "outerwear"},
        headers={"X-Tenant-ID": "00000000-0000-0000-0000-000000000001"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Outerwear"
    assert data["slug"] == "outerwear"
    assert data["is_active"] is True


async def test_list_categories(client):
    response = await client.get(
        "/api/v1/categories/",
        headers={"X-Tenant-ID": "00000000-0000-0000-0000-000000000001"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0


async def test_public_categories(client):
    response = await client.get(
        "/api/v1/public/categories/test-tenant"
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


async def test_delete_category_orphans_products(client):
    # Create category
    cat_resp = await client.post(
        "/api/v1/categories/",
        json={"name": "Footwear", "slug": "footwear"},
        headers={"X-Tenant-ID": "00000000-0000-0000-0000-000000000001"},
    )
    cat_id = cat_resp.json()["id"]

    # Delete category
    del_resp = await client.delete(
        f"/api/v1/categories/{cat_id}",
        headers={"X-Tenant-ID": "00000000-0000-0000-0000-000000000001"},
    )
    assert del_resp.status_code == 200

    # Products should still exist (category_id = NULL)
    public_resp = await client.get("/api/v1/public/products/test-tenant")
    assert public_resp.status_code == 200
```

- [ ] **Step 2: Write category CRUD routes**

```python
# services/backend-api/src/routes/categories.py
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select, func
from sqlalchemy.orm import joinedload
from src.orm.models.category import Category
from src.orm.models.product import Product
from src.orm.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from src.dependencies import get_db, get_current_tenant_id

router = APIRouter(tags=["categories"])


@router.get("/categories/", response_model=list[CategoryResponse])
async def list_categories(
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    include_inactive: bool = False,
):
    stmt = select(Category).where(Category.tenant_id == tenant_id)
    if not include_inactive:
        stmt = stmt.where(Category.is_active == True)
    stmt = stmt.order_by(Category.sort_order, Category.name)
    categories = (await db.exec(stmt)).all()
    result = []
    for cat in categories:
        count_stmt = select(func.count()).select_from(Product).where(
            Product.category_id == cat.id,
            Product.tenant_id == tenant_id,
        )
        count = (await db.exec(count_stmt)).one()
        result.append(CategoryResponse(
            **cat.model_dump(),
            product_count=count,
        ))
    return result


@router.post("/categories/", response_model=CategoryResponse)
async def create_category(
    data: CategoryCreate,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    cat = Category(**data.model_dump(), tenant_id=tenant_id)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return CategoryResponse(**cat.model_dump(), product_count=0)


@router.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: UUID,
    data: CategoryUpdate,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(Category).where(
        Category.id == category_id,
        Category.tenant_id == tenant_id,
    )
    cat = (await db.exec(stmt)).one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(cat, key, value)
    await db.commit()
    await db.refresh(cat)
    count_stmt = select(func.count()).select_from(Product).where(
        Product.category_id == cat.id,
        Product.tenant_id == tenant_id,
    )
    count = (await db.exec(count_stmt)).one()
    return CategoryResponse(**cat.model_dump(), product_count=count)


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(Category).where(
        Category.id == category_id,
        Category.tenant_id == tenant_id,
    )
    cat = (await db.exec(stmt)).one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(cat)
    await db.commit()
    return {"ok": True}
```

- [ ] **Step 3: Add public categories endpoint**

In `services/backend-api/src/routes/public.py`, add:

```python
from src.orm.models.category import Category
from src.orm.schemas.category import CategoryResponse

# After the existing public products endpoint
@router.get("/public/categories/{tenant_slug}", response_model=list[CategoryResponse])
async def public_categories(
    tenant_slug: str,
    db=Depends(get_db),
):
    tenant = await resolve_tenant(db, tenant_slug)
    stmt = select(Category).where(
        Category.tenant_id == tenant.tenant_id,
        Category.is_active == True,
    ).order_by(Category.sort_order, Category.name)
    categories = (await db.exec(stmt)).all()
    result = []
    for cat in categories:
        count_stmt = select(func.count()).select_from(Product).where(
            Product.category_id == cat.id,
            Product.tenant_id == tenant.tenant_id,
        )
        count = (await db.exec(count_stmt)).one()
        result.append(CategoryResponse(
            **cat.model_dump(),
            product_count=count,
        ))
    return result
```

- [ ] **Step 4: Register routes in main.py**

In `services/backend-api/src/main.py`, add imports:

```python
from src.routes.categories import router as categories_router
```

Add include:

```python
app.include_router(categories_router, prefix="/api/v1")
```

- [ ] **Step 5: Add ?category filter to public products endpoint**

In `services/backend-api/src/routes/public.py`, modify the existing `public_products` function:

```python
@router.get("/public/products/{tenant_slug}")
async def public_products(
    tenant_slug: str,
    category: Optional[str] = None,
    db=Depends(get_db),
):
    tenant = await resolve_tenant(db, tenant_slug)
    stmt = select(Product).where(
        Product.tenant_id == tenant.tenant_id,
        Product.is_active == True,
    )

    if category:
        stmt = stmt.join(Category, Product.category_id == Category.id).where(
            Category.slug == category,
            Category.is_active == True,
        )

    stmt = stmt.order_by(Product.created_at.desc())
    products = (await db.exec(stmt)).all()
    return products
```

- [ ] **Step 6: Run tests**

```bash
cd services/backend-api && uv run pytest tests/test_categories.py -v
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add services/backend-api/src/routes/categories.py services/backend-api/src/routes/public.py services/backend-api/src/main.py services/backend-api/tests/test_categories.py
git commit -m "feat(api): add category CRUD routes and public products filter"
```

---

### Task 4: Storefront Routes — `/shop/all` and `/shop/[category]`

**Files:**

- Create: `apps/storefront/src/app/[tenant]/shop/all/page.tsx`
- Create: `apps/storefront/src/app/[tenant]/shop/[category]/page.tsx`
- Modify: `apps/storefront/src/lib/api.ts`
- Modify: `apps/storefront/src/app/[tenant]/page.tsx`

**Interfaces:**

- Consumes: existing `fetchProducts` style, ProductGrid (new), API with `?category=` filter
- Produces: working PLP routes with category filtering

- [ ] **Step 1: Update API client**

In `apps/storefront/src/lib/api.ts`, add category support:

```typescript
export async function fetchProductsByCategory(
  tenantSlug: string,
  categorySlug?: string,
): Promise<Product[]> {
  const url = new URL(`${API_BASE}/api/v1/public/products/${tenantSlug}`);
  if (categorySlug) {
    url.searchParams.set("category", categorySlug);
  }
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  return res.json();
}
```

- [ ] **Step 2: Create `/shop/all` page**

```typescript
// apps/storefront/src/app/[tenant]/shop/all/page.tsx
import { fetchProductsByCategory } from "@/lib/api";
import { ProductGrid } from "@/components/storefront/product-grid";

export default async function ShopAllPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const products = await fetchProductsByCategory(tenant);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">All Products</h1>
      <ProductGrid products={products} />
    </div>
  );
}
```

- [ ] **Step 3: Create `/shop/[category]` page**

```typescript
// apps/storefront/src/app/[tenant]/shop/[category]/page.tsx
import { fetchProductsByCategory } from "@/lib/api";
import { ProductGrid } from "@/components/storefront/product-grid";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ tenant: string; category: string }>;
}) {
  const { tenant, category } = await params;
  const products = await fetchProductsByCategory(tenant, category);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 capitalize">
        {category.replace(/-/g, " ")}
      </h1>
      {products.length === 0 ? (
        <p className="text-muted-foreground">No products in this category.</p>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create ProductGrid component**

```typescript
// apps/storefront/src/components/storefront/product-grid.tsx
import { ProductCard } from "./product-card";
import type { Product } from "@repo/tenant-orm/types";

interface ProductGridProps {
  products: Product[];
}

export function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
        No products found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Type-check**

```bash
cd apps/storefront && pnpm typecheck
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add apps/storefront/src/app/\[tenant\]/shop/all/page.tsx apps/storefront/src/app/\[tenant\]/shop/\[category\]/page.tsx apps/storefront/src/lib/api.ts apps/storefront/src/components/storefront/product-grid.tsx
git commit -m "feat(storefront): add /shop/all and /shop/[category] routes with ProductGrid"
```

---

### Task 5: Admin Category Management Page

**Files:**

- Create: `apps/admin/src/app/(app)/categories/page.tsx`
- Create: `apps/admin/src/components/categories/categories-table.tsx`
- Create: `apps/admin/src/components/categories/category-modal.tsx`

**Interfaces:**

- Consumes: admin layout pattern from Orders/Products pages
- Produces: working category CRUD UI

- [ ] **Step 1: Create category management page**

```typescript
// apps/admin/src/app/(app)/categories/page.tsx
import { CategoriesTable } from "@/components/categories/categories-table";

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
      </div>
      <CategoriesTable />
    </div>
  );
}
```

- [ ] **Step 2: Create categories table component**

```typescript
// apps/admin/src/components/categories/categories-table.tsx
"use client";

import { useState, useEffect } from "react";
import { CategoryModal } from "./category-modal";

interface Category {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  product_count: number;
}

export function CategoriesTable() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Category | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetch("/api/v1/categories/")
      .then((r) => r.json())
      .then(setCategories);
  }, []);

  async function handleDelete(id: string, productCount: number) {
    if (productCount > 0) {
      const ok = window.confirm(
        `This category has ${productCount} product(s). Deleting will unassign them. Continue?`,
      );
      if (!ok) return;
    }
    await fetch(`/api/v1/categories/${id}`, { method: "DELETE" });
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <>
      <button
        onClick={() => { setEditing(null); setShowModal(true); }}
        className="mb-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Add Category
      </button>

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm font-medium text-muted-foreground">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Products</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id} className="border-b last:border-0">
                <td className="px-4 py-2 text-sm font-medium">{cat.name}</td>
                <td className="px-4 py-2 text-sm text-muted-foreground font-mono">{cat.slug}</td>
                <td className="px-4 py-2 text-sm">
                  {cat.is_active ? "ACTIVE" : "INACTIVE"}
                </td>
                <td className="px-4 py-2 text-sm text-right">{cat.product_count} items</td>
                <td className="px-4 py-2 text-sm text-right space-x-2">
                  <button
                    onClick={() => { setEditing(cat); setShowModal(true); }}
                    className="text-primary hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id, cat.product_count)}
                    className="text-destructive hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CategoryModal
          category={editing}
          onClose={() => setShowModal(false)}
          onSaved={(cat) => {
            setCategories((prev) =>
              editing
                ? prev.map((c) => (c.id === cat.id ? cat : c))
                : [...prev, cat],
            );
            setShowModal(false);
          }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Create category modal**

```typescript
// apps/admin/src/components/categories/category-modal.tsx
"use client";

import { useState } from "react";

interface CategoryModalProps {
  category: { id?: string; name?: string; slug?: string } | null;
  onClose: () => void;
  onSaved: (cat: any) => void;
}

export function CategoryModal({ category, onClose, onSaved }: CategoryModalProps) {
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const method = category?.id ? "PUT" : "POST";
    const url = category?.id
      ? `/api/v1/categories/${category.id}`
      : "/api/v1/categories/";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug }),
    });
    const data = await res.json();
    setLoading(false);
    onSaved(data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
        <h2 className="text-lg font-bold mb-4">
          {category?.id ? "Edit Category" : "Add Category"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/app/\(app\)/categories/page.tsx apps/admin/src/components/categories/categories-table.tsx apps/admin/src/components/categories/category-modal.tsx
git commit -m "feat(admin): add category management page with table and modal"
```

---

### Task 6: Product Form Category Combobox

**Files:**

- Modify: `apps/admin/src/components/products/product-form.tsx`

**Interfaces:**

- Consumes: existing product form, category endpoint
- Produces: category assignment on product create/update

- [ ] **Step 1: Add category fetching to product form**

In `apps/admin/src/components/products/product-form.tsx`, add before the form return:

```typescript
const [categories, setCategories] = useState<{ id: string; name: string }[]>(
  [],
);
const [search, setSearch] = useState("");

useEffect(() => {
  fetch("/api/v1/categories/")
    .then((r) => r.json())
    .then(setCategories);
}, []);
```

- [ ] **Step 2: Add category combobox field**

After the weight fields, add:

```tsx
<div className="space-y-2">
  <label htmlFor="category" className="text-sm font-medium">
    Category
  </label>
  <div className="relative">
    <input
      id="category"
      type="text"
      placeholder="Search categories..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
    />
    {search && (
      <div className="absolute z-10 mt-1 w-full rounded-lg border bg-background shadow-lg">
        {categories
          .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
          .map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setSearch(c.name);
                // set category_id value
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
            >
              {c.name}
            </button>
          ))}
      </div>
    )}
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/products/product-form.tsx
git commit -m "feat(admin): add category combobox to product form"
```

---

### Task 7: Seed Data Update

**Files:**

- Modify: `services/backend-api/seed_database.py`

**Interfaces:**

- Consumes: Category model, existing Product model
- Produces: categories assigned to seeded products

- [ ] **Step 1: Add deterministic slug helper**

```python
def slugify(text: str) -> str:
    return text.lower().strip().replace(" ", "-")
```

- [ ] **Step 2: Add category seeding**

After creating tenants but before creating products, add:

```python
categories_data = [
    {"name": "Outerwear", "slug": "outerwear", "sort_order": 1},
    {"name": "Footwear", "slug": "footwear", "sort_order": 2},
    {"name": "Accessories", "slug": "accessories", "sort_order": 3},
    {"name": "Bottoms", "slug": "bottoms", "sort_order": 4},
    {"name": "Tops", "slug": "tops", "sort_order": 5},
]

all_categories = {}
for tenant_meta in tenant_metas:
    tenant_categories = []
    for cat_data in categories_data:
        cat = Category(
            tenant_id=tenant_meta["tenant_id"],
            name=cat_data["name"],
            slug=cat_data["slug"],
            sort_order=cat_data["sort_order"],
        )
        db.add(cat)
        tenant_categories.append(cat)
    all_categories[tenant_meta["slug"]] = tenant_categories
```

- [ ] **Step 3: Assign products to categories**

When creating products, assign `category_id`:

```python
import random
cats = all_categories[tenant_meta["slug"]]
category_id = random.choice(cats).id

product = Product(
    tenant_id=tenant_meta["tenant_id"],
    name=..., slug=..., category_id=category_id,
    ...
)
```

- [ ] **Step 4: Verify seed**

```bash
cd services/backend-api && uv run python seed_database.py
```

Expected: runs without integrity errors, products have categories

- [ ] **Step 5: Commit**

```bash
git add services/backend-api/seed_database.py
git commit -m "feat(seed): add categories and assign products"
```

---

### Task 8: TypeScript Types + Zod Schemas

**Files:**

- Modify: `packages/tenant-orm/src/types.ts`
- Modify: `packages/tenant-orm/src/schemas/tenant.ts`

**Interfaces:**

- Consumes: existing Product type
- Produces: Category TypeScript type, updated Product type with category_id

- [ ] **Step 1: Add Category type**

In `packages/tenant-orm/src/types.ts`:

```typescript
export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  product_count: number;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Update Product type**

Add `category_id?: string | null;` to the `Product` interface.

- [ ] **Step 3: Add Zod schemas**

In `packages/tenant-orm/src/schemas/tenant.ts`:

```typescript
export const CategorySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
  product_count: z.number().int().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CategoryCreateSchema = CategorySchema.omit({
  id: true,
  tenant_id: true,
  is_active: true,
  product_count: true,
  created_at: true,
  updated_at: true,
});

export const CategoryUpdateSchema = CategoryCreateSchema.partial();
```

- [ ] **Step 4: Type-check**

```bash
cd packages/tenant-orm && pnpm typecheck
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add packages/tenant-orm/src/types.ts packages/tenant-orm/src/schemas/tenant.ts
git commit -m "feat(types): add Category type and Zod schema"
```

---

### Task 9: Navigation + Tests

**Files:**

- Create: `apps/storefront/src/components/storefront/__tests__/product-grid.test.tsx`
- Modify: `apps/storefront/src/app/[tenant]/layout.tsx`

- [ ] **Step 1: Write ProductGrid test**

```typescript
// apps/storefront/src/components/storefront/__tests__/product-grid.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductGrid } from "../product-grid";
import type { Product } from "@repo/tenant-orm/types";

const mockProduct: Product = {
  id: "1", tenant_id: "t1", name: "Test", slug: "test",
  description: null, sku: null, status: "published",
  weight: null, weight_unit: "g", is_active: true,
  price: 2999, specs: null, images: null,
  created_at: "2024-01-01", updated_at: "2024-01-01",
};

describe("ProductGrid", () => {
  it("renders products", () => {
    render(<ProductGrid products={[mockProduct]} />);
    expect(screen.getByText("Test")).toBeDefined();
  });

  it("shows empty state", () => {
    render(<ProductGrid products={[]} />);
    expect(screen.getByText("No products found.")).toBeDefined();
  });
});
```

- [ ] **Step 2: Add category navigation to tenant layout**

In `apps/storefront/src/app/[tenant]/layout.tsx`, add nav links for categories:

```typescript
import { fetchCategories } from "@/lib/api";

// In layout component:
const categories = await fetchCategories(tenant);

// In JSX, add nav:
<nav className="flex gap-4">
  <Link href={`/${tenant}/shop/all`}>All</Link>
  {categories.map((cat) => (
    <Link key={cat.id} href={`/${tenant}/shop/${cat.slug}`}>
      {cat.name}
    </Link>
  ))}
</nav>
```

- [ ] **Step 3: Run tests**

```bash
pnpm vitest run
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add apps/storefront/src/components/storefront/__tests__/product-grid.test.tsx apps/storefront/src/app/\[tenant\]/layout.tsx
git commit -m "feat(storefront): add category nav and ProductGrid tests"
```
