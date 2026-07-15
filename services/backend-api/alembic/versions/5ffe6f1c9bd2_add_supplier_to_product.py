"""add_supplier_to_product

Revision ID: 5ffe6f1c9bd2
Revises: 0006
Create Date: 2026-07-10 11:17:15.979128

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '5ffe6f1c9bd2'
down_revision: Union[str, None] = '0006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.add_column(sa.Column('supplier', sa.String(length=255), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.drop_column('supplier')
