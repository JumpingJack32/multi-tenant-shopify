"""add product specs field

Revision ID: 0014
Revises: 0013
Create Date: 2026-07-19 21:20:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("products", sa.Column("specs", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "specs")
