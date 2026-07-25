"""add navigation menu models

Revision ID: 5bb927783864
Revises: 0017
Create Date: 2026-07-24 15:08:54.215275

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "5bb927783864"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "navigation_menus",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_navigation_menus_tenant_id", "navigation_menus", ["tenant_id"], unique=False
    )

    op.create_table(
        "navigation_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("menu_id", sa.Uuid(), nullable=False),
        sa.Column("parent_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("ref_id", sa.Uuid(), nullable=True),
        sa.Column("href", sa.String(length=500), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        sa.Column("open_in_new_tab", sa.Boolean(), nullable=False),
        sa.Column("is_title_link", sa.Boolean(), nullable=False),
        sa.Column("show_view_all", sa.Boolean(), nullable=False),
        sa.Column("is_featured", sa.Boolean(), nullable=False),
        sa.Column("badge", sa.String(length=100), nullable=True),
        sa.ForeignKeyConstraint(["menu_id"], ["navigation_menus.id"],),
        sa.ForeignKeyConstraint(["parent_id"], ["navigation_items.id"],),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_navigation_items_menu_id", "navigation_items", ["menu_id"], unique=False)
    op.create_index("ix_navigation_items_parent_id", "navigation_items", ["parent_id"], unique=False)
    op.create_index("ix_navigation_items_tenant_id", "navigation_items", ["tenant_id"], unique=False)
    op.create_index(
        "ix_nav_menu_parent_sort",
        "navigation_items",
        ["menu_id", "parent_id", "sort_order"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("navigation_items")
    op.drop_table("navigation_menus")
