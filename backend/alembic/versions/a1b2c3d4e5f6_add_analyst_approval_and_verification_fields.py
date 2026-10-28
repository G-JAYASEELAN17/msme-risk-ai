"""add_analyst_approval_and_verification_fields

Revision ID: a1b2c3d4e5f6
Revises: f9a0b1c2d3e4
Create Date: 2026-10-14 14:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f9a0b1c2d3e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


from alembic import context

def upgrade() -> None:
    is_offline = context.is_offline_mode()
    conn = op.get_bind()
    existing_cols = set()
    existing_indices = set()
    if not is_offline and conn is not None:
        try:
            inspector = inspect(conn)
            existing_cols = {c['name'] for c in inspector.get_columns('users')}
            existing_indices = {i['name'] for i in inspector.get_indexes('users')}
        except Exception:
            existing_cols = set()
            existing_indices = set()

    cols_to_add = [
        ('phone', sa.Column('phone', sa.String(), nullable=True)),
        ('approval_status', sa.Column('approval_status', sa.String(), nullable=False, server_default='approved')),
        ('email_verified_at', sa.Column('email_verified_at', sa.DateTime(), nullable=True)),
        ('organization', sa.Column('organization', sa.String(), nullable=True)),
        ('qualifications', sa.Column('qualifications', sa.Text(), nullable=True)),
        ('experience_years', sa.Column('experience_years', sa.String(), nullable=True)),
        ('application_reason', sa.Column('application_reason', sa.Text(), nullable=True)),
        ('approved_by', sa.Column('approved_by', sa.String(), nullable=True)),
        ('approved_at', sa.Column('approved_at', sa.DateTime(), nullable=True)),
        ('rejected_by', sa.Column('rejected_by', sa.String(), nullable=True)),
        ('rejected_at', sa.Column('rejected_at', sa.DateTime(), nullable=True)),
        ('rejection_reason', sa.Column('rejection_reason', sa.Text(), nullable=True)),
        ('suspended_at', sa.Column('suspended_at', sa.DateTime(), nullable=True)),
    ]

    for col_name, col_obj in cols_to_add:
        if is_offline or (col_name not in existing_cols):
            op.add_column('users', col_obj)

    # Add index on approval_status if not present
    if is_offline or ('ix_users_approval_status' not in existing_indices):
        op.create_index('ix_users_approval_status', 'users', ['approval_status'], unique=False)


def downgrade() -> None:
    is_offline = context.is_offline_mode()
    conn = op.get_bind()
    existing_cols = set()
    existing_indices = set()
    if not is_offline and conn is not None:
        try:
            inspector = inspect(conn)
            existing_cols = {c['name'] for c in inspector.get_columns('users')}
            existing_indices = {i['name'] for i in inspector.get_indexes('users')}
        except Exception:
            existing_cols = set()
            existing_indices = set()

    if is_offline or ('ix_users_approval_status' in existing_indices):
        op.drop_index('ix_users_approval_status', table_name='users')

    cols_to_drop = [
        'phone', 'approval_status', 'email_verified_at', 'organization',
        'qualifications', 'experience_years', 'application_reason',
        'approved_by', 'approved_at', 'rejected_by', 'rejected_at',
        'rejection_reason', 'suspended_at'
    ]

    for col in cols_to_drop:
        if is_offline or (col in existing_cols):
            op.drop_column('users', col)
