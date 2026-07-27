"""Multi-warehouse inventory models — nodes, stock, transfers."""

from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import Column, Index, JSON, UniqueConstraint
from sqlmodel import Field

from src.orm.base import BaseModel


class InventoryNode(BaseModel, table=True):
    __tablename__ = "inventory_nodes"  # type: ignore

    name: str = Field(max_length=200)
    type: str = Field(max_length=20)
    is_active: bool = Field(default=True)
    priority: int = Field(default=0)
    address: dict = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False, default=dict),
    )


class InventoryStock(BaseModel, table=True):
    __tablename__ = "inventory_stocks"  # type: ignore
    __table_args__ = (
        UniqueConstraint("variant_id", "node_id", name="uq_variant_node"),
        Index("ix_inventory_stocks_node", "node_id"),
    )

    variant_id: UUID = Field(foreign_key="variants.id", index=True)
    node_id: UUID = Field(foreign_key="inventory_nodes.id")
    quantity: int = Field(default=0, ge=0)
    reserved: int = Field(default=0, ge=0)


class InventoryTransfer(BaseModel, table=True):
    __tablename__ = "inventory_transfers"  # type: ignore
    __table_args__ = (
        Index("ix_inventory_transfers_from", "from_node_id"),
        Index("ix_inventory_transfers_to", "to_node_id"),
    )

    from_node_id: UUID = Field(foreign_key="inventory_nodes.id")
    to_node_id: UUID = Field(foreign_key="inventory_nodes.id")
    variant_id: UUID = Field(foreign_key="variants.id", index=True)
    quantity: int = Field(ge=1)
    status: str = Field(default="COMPLETED", max_length=20)
    reason: Optional[str] = Field(default=None, max_length=500)
