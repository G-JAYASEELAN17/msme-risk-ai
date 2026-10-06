"""initial_schema

Revision ID: 1a2b3c4d5e6f
Revises: 
Create Date: 2026-10-01 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = '1a2b3c4d5e6f'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = set(inspector.get_table_names())

    # 1. users
    if "users" not in existing_tables:
        op.create_table(
            "users",
            sa.Column("uid", sa.String(), primary_key=True, index=True),
            sa.Column("email", sa.String(), unique=True, index=True, nullable=False),
            sa.Column("name", sa.String(), nullable=True),
            sa.Column("role", sa.String(), server_default="user", nullable=False),
            sa.Column("settings", sa.JSON(), server_default="{}", nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )

    # 2. businesses
    if "businesses" not in existing_tables:
        op.create_table(
            "businesses",
            sa.Column("id", sa.Integer(), primary_key=True, index=True, autoincrement=True),
            sa.Column("user_id", sa.String(), sa.ForeignKey("users.uid", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("name", sa.String(), nullable=False, index=True),
            sa.Column("industry", sa.String(), nullable=False),
            sa.Column("location", sa.String(), server_default="United States", nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("age", sa.Integer(), nullable=False),
            sa.Column("employees", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )

    # 3. assessments
    if "assessments" not in existing_tables:
        op.create_table(
            "assessments",
            sa.Column("id", sa.Integer(), primary_key=True, index=True, autoincrement=True),
            sa.Column("business_id", sa.Integer(), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("annual_revenue", sa.Float(), nullable=False),
            sa.Column("monthly_cash_flow", sa.Float(), nullable=False),
            sa.Column("monthly_expenses", sa.Float(), nullable=False),
            sa.Column("existing_debt", sa.Float(), nullable=False),
            sa.Column("digital_transactions", sa.Integer(), nullable=False),
            sa.Column("utility_payment_score", sa.Float(), nullable=False),
            sa.Column("invoice_payment_score", sa.Float(), nullable=False),
            sa.Column("previous_defaults", sa.Integer(), nullable=False),
            sa.Column("review_status", sa.String(), server_default="pending", nullable=False),
            sa.Column("review_notes", sa.Text(), nullable=True),
            sa.Column("additional_comments", sa.Text(), nullable=True),
            sa.Column("reviewed_by", sa.String(), nullable=True),
            sa.Column("reviewed_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )

    # 4. predictions
    if "predictions" not in existing_tables:
        op.create_table(
            "predictions",
            sa.Column("id", sa.Integer(), primary_key=True, index=True, autoincrement=True),
            sa.Column("assessment_id", sa.Integer(), sa.ForeignKey("assessments.id", ondelete="CASCADE"), unique=True, nullable=False, index=True),
            sa.Column("default_probability", sa.Float(), nullable=False),
            sa.Column("risk_level", sa.String(), nullable=False),
            sa.Column("confidence", sa.Float(), nullable=False),
            sa.Column("top_factors", sa.JSON(), nullable=False),
            sa.Column("positive_factors", sa.JSON(), server_default="[]", nullable=False),
            sa.Column("risk_factors", sa.JSON(), server_default="[]", nullable=False),
            sa.Column("model_version", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )

    # 5. reports
    if "reports" not in existing_tables:
        op.create_table(
            "reports",
            sa.Column("id", sa.Integer(), primary_key=True, index=True, autoincrement=True),
            sa.Column("assessment_id", sa.Integer(), sa.ForeignKey("assessments.id", ondelete="CASCADE"), unique=True, nullable=False, index=True),
            sa.Column("report_data", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )

    # 6. documents
    if "documents" not in existing_tables:
        op.create_table(
            "documents",
            sa.Column("id", sa.Integer(), primary_key=True, index=True, autoincrement=True),
            sa.Column("user_id", sa.String(), sa.ForeignKey("users.uid", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("business_id", sa.Integer(), sa.ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("filename", sa.String(), nullable=False),
            sa.Column("original_filename", sa.String(), nullable=False),
            sa.Column("file_size", sa.Integer(), nullable=False),
            sa.Column("mime_type", sa.String(), nullable=False),
            sa.Column("file_path", sa.String(), nullable=False),
            sa.Column("status", sa.String(), server_default="uploaded", nullable=False),
            sa.Column("extracted_data", sa.JSON(), server_default="{}", nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )

    # 7. notifications
    if "notifications" not in existing_tables:
        op.create_table(
            "notifications",
            sa.Column("id", sa.Integer(), primary_key=True, index=True, autoincrement=True),
            sa.Column("user_id", sa.String(), sa.ForeignKey("users.uid", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("message", sa.String(), nullable=False),
            sa.Column("type", sa.String(), server_default="info", nullable=False),
            sa.Column("is_read", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("link", sa.String(), nullable=True),
            sa.Column("related_assessment_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )

    # 8. alert_rules
    if "alert_rules" not in existing_tables:
        op.create_table(
            "alert_rules",
            sa.Column("id", sa.Integer(), primary_key=True, index=True, autoincrement=True),
            sa.Column("user_id", sa.String(), sa.ForeignKey("users.uid", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("rule_type", sa.String(), nullable=False),
            sa.Column("threshold", sa.Float(), nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )

    # 9. audit_logs
    if "audit_logs" not in existing_tables:
        op.create_table(
            "audit_logs",
            sa.Column("id", sa.Integer(), primary_key=True, index=True, autoincrement=True),
            sa.Column("user_id", sa.String(), sa.ForeignKey("users.uid", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("action", sa.String(), nullable=False),
            sa.Column("resource_type", sa.String(), nullable=False),
            sa.Column("resource_id", sa.String(), nullable=True),
            sa.Column("details", sa.JSON(), server_default="{}", nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = set(inspector.get_table_names())
    for tbl in [
        "audit_logs", "alert_rules", "notifications", "documents",
        "reports", "predictions", "assessments", "businesses", "users"
    ]:
        if tbl in existing_tables:
            op.drop_table(tbl)
