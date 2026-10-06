import pytest
import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database.database import Base
from app.database import models
from app.routes.health import health_check

def test_database_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "healthy"
    assert "database_type" in data
    assert data["database_type"] in ["sqlite", "postgresql"]

def test_models_schema_and_updated_at(db_session):
    # Test User creation with updated_at
    user = models.User(
        uid="test_user_db_schema",
        email="schema_test@msme.com",
        name="Schema Test User"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    assert user.uid == "test_user_db_schema"
    assert user.email == "schema_test@msme.com"
    assert user.created_at is not None
    assert user.updated_at is not None
    assert isinstance(user.created_at, datetime.datetime)
    assert isinstance(user.updated_at, datetime.datetime)

    # Test Business creation with relationship to user
    biz = models.Business(
        user_id=user.uid,
        name="Apex Industrial",
        industry="Manufacturing",
        age=5,
        employees=30
    )
    db_session.add(biz)
    db_session.commit()
    db_session.refresh(biz)

    assert biz.id is not None
    assert biz.owner.uid == user.uid
    assert biz.created_at is not None
    assert biz.updated_at is not None

    # Test Assessment creation with relationship to business
    ass = models.Assessment(
        business_id=biz.id,
        annual_revenue=1000000.0,
        monthly_cash_flow=80000.0,
        monthly_expenses=45000.0,
        existing_debt=120000.0,
        digital_transactions=300,
        utility_payment_score=85.0,
        invoice_payment_score=90.0,
        previous_defaults=0
    )
    db_session.add(ass)
    db_session.commit()
    db_session.refresh(ass)

    assert ass.id is not None
    assert ass.business.id == biz.id

    # Test Prediction creation with JSON factors and unique assessment relation
    pred = models.Prediction(
        assessment_id=ass.id,
        default_probability=0.12,
        risk_level="LOW",
        confidence=0.88,
        top_factors=[{"feature": "utility_payment_score", "impact": -0.2}],
        positive_factors=["Strong utility payment discipline"],
        risk_factors=[],
        model_version="1.1.0"
    )
    db_session.add(pred)
    db_session.commit()
    db_session.refresh(pred)

    assert pred.id is not None
    assert pred.assessment.id == ass.id
    assert len(pred.top_factors) == 1
    assert len(pred.positive_factors) == 1

    # Test Report creation
    rep = models.Report(
        assessment_id=ass.id,
        report_data={"company": "Apex Industrial", "summary": "Low credit risk"}
    )
    db_session.add(rep)
    db_session.commit()
    db_session.refresh(rep)

    assert rep.id is not None
    assert rep.assessment.id == ass.id
    assert rep.report_data["company"] == "Apex Industrial"

def test_database_url_normalization():
    from app.database.database import db_url
    assert not db_url.startswith("postgres://")
