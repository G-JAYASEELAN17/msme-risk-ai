import pytest
import io
from fastapi.testclient import TestClient

def test_document_upload_and_extraction(client: TestClient, test_user_headers: dict):
    # 1. Create a dummy CSV file
    file_content = b"Month,Revenue,Expenses,Debt\nJan,100000,80000,50000\nFeb,120000,85000,45000\n"
    files = {"file": ("income_statement.csv", io.BytesIO(file_content), "text/csv")}

    res = client.post("/api/documents/upload", files=files, headers=test_user_headers)
    assert res.status_code == 201
    doc_data = res.json()
    doc_id = doc_data["id"]
    assert doc_data["original_filename"] == "income_statement.csv"

    # 2. List documents
    res = client.get("/api/documents", headers=test_user_headers)
    assert res.status_code == 200
    docs = res.json()
    assert any(d["id"] == doc_id for d in docs)

    # 3. Trigger extraction
    res = client.post(f"/api/documents/{doc_id}/extract", headers=test_user_headers)
    assert res.status_code == 200
    ext = res.json()
    assert "extracted_data" in ext
    assert ext["status"] == "processed"

    # 4. Delete document
    res = client.delete(f"/api/documents/{doc_id}", headers=test_user_headers)
    assert res.status_code == 204

def test_document_upload_unsupported_type_fails(client: TestClient, test_user_headers: dict):
    files = {"file": ("malicious.exe", io.BytesIO(b"fake binary"), "application/x-msdownload")}
    res = client.post("/api/documents/upload", files=files, headers=test_user_headers)
    assert res.status_code == 400
