import time
import socket
import logging
from typing import Dict, Any, Optional
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, ProgrammingError

logger = logging.getLogger("msme_risk_api.database_diagnostics")


def categorize_db_error(exc: Exception) -> Dict[str, str]:
    """
    Categorizes database connection errors into standard sanitized failure codes
    without leaking passwords, tokens, full connection strings, or internal infrastructure details.
    """
    err_str = str(exc).lower()
    
    # 1. Tenant / User Not Found (Supabase PgBouncer / Supavisor pooler)
    if "tenant" in err_str and "not found" in err_str:
        return {
            "category": "TENANT_OR_USER_NOT_FOUND",
            "message": "Database project tenant was not found on the connection pooler. The project may be paused, deleted, or located in a different region."
        }
    
    # 2. DNS Resolution Failures
    if any(term in err_str for term in ["11001", "getaddrinfo failed", "name or service not known", "gaierror"]):
        return {
            "category": "DNS_RESOLUTION_FAILURE",
            "message": "Database host could not be resolved via DNS. Check host configuration and network connectivity."
        }
        
    # 3. Authentication Failures
    if "password authentication failed" in err_str or "authentication failed" in err_str:
        return {
            "category": "AUTHENTICATION_FAILURE",
            "message": "Database authentication failed. Verify username and password credentials."
        }
        
    # 4. Connection Refused
    if any(term in err_str for term in ["connection refused", "10061", "actively refused"]):
        return {
            "category": "CONNECTION_REFUSED",
            "message": "Connection refused by the database host on the configured port."
        }
        
    # 5. Connection Timeout
    if "timed out" in err_str or "timeout" in err_str:
        return {
            "category": "CONNECTION_TIMEOUT",
            "message": "Database connection attempt timed out."
        }
        
    # 6. SSL / TLS Failures
    if "ssl" in err_str or "certificate" in err_str:
        return {
            "category": "SSL_FAILURE",
            "message": "SSL/TLS negotiation with database server failed."
        }
        
    # 7. Schema / Relation Errors
    if "does not exist" in err_str or "relation" in err_str:
        return {
            "category": "SCHEMA_ERROR",
            "message": "Database schema or table was not found. Migrations may be pending."
        }
        
    # 8. Network / Server Unreachable
    if any(term in err_str for term in ["could not connect", "network is unreachable", "host is unreachable"]):
        return {
            "category": "NETWORK_UNREACHABLE",
            "message": "Database server could not be reached over the network."
        }
        
    return {
        "category": "DATABASE_UNAVAILABLE",
        "message": "Database service is currently unreachable."
    }


def diagnose_database_connection(target_engine=None, timeout_seconds: float = 3.0) -> Dict[str, Any]:
    """
    Executes a safe lightweight `SELECT 1` query to test database readiness.
    Never exposes passwords, tokens, full connection strings, or sensitive internals.
    """
    if target_engine is None:
        from .database import engine as app_engine
        target_engine = app_engine

    t0 = time.time()
    dialect_name = getattr(target_engine.dialect, "name", "unknown") if target_engine else "unknown"
    driver_name = getattr(target_engine.dialect, "driver", "unknown") if target_engine else "unknown"
    
    if target_engine is None:
        return {
            "connected": False,
            "status": "unavailable",
            "dialect": "none",
            "latency_ms": 0.0,
            "failure_category": "ENGINE_NOT_CONFIGURED",
            "message": "Database engine is not configured."
        }

    try:
        if hasattr(target_engine, "connect"):
            with target_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        else:
            target_engine.execute(text("SELECT 1"))
        
        duration_ms = round((time.time() - t0) * 1000, 2)
        return {
            "connected": True,
            "status": "healthy",
            "dialect": dialect_name,
            "driver": driver_name,
            "latency_ms": duration_ms,
            "failure_category": None,
            "message": "Database connectivity verified successfully."
        }
    except Exception as exc:
        duration_ms = round((time.time() - t0) * 1000, 2)
        categorized = categorize_db_error(exc)
        logger.warning(
            f"Database health check failed [{categorized['category']}] ({duration_ms}ms)"
        )
        return {
            "connected": False,
            "status": "unavailable",
            "dialect": dialect_name,
            "driver": driver_name,
            "latency_ms": duration_ms,
            "failure_category": categorized["category"],
            "message": categorized["message"]
        }
