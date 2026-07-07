# Category Filtering — Implementation Roadmap

```
Task 1: Alembic Migration 0004
   (categories table + category_id on products)
              │
              ▼
Task 2: Pydantic Schemas + SQLModel
   (CategoryCreate/Update/Response, Category ORM model)
              │
              ▼
Task 3: Category API Routes
   (admin CRUD + public endpoint)
              │
       ┌──────┴──────┐
       ▼             ▼
Task 4: Public      Task 6: Admin
Products Filter     Category Page
(?category=slug)    (table + modal)
       │             │
       ▼             ▼
Task 5: Storefront  Task 7: Product Form
Routes + ProductGrid Combobox Select
(/shop/all, /shop/   (type-to-filter)
[category])           │
       │             │
       └──────┬──────┘
              ▼
       ┌──────┴──────┐
       ▼             ▼
Task 8: Seed Data   Task 9: Tests
(categories +       (all layers +
product assignment)  orphan cleanup)
```

## Dependencies

- 1 → 2 → 3 → 4 → 5
- 3 → 6 → 7
- 2 → 8
- 4, 5, 6, 7, 8 → 9
