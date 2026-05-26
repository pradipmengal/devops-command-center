import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_valid_cron_expression():
    response = client.post("/cron/build", json={
        "minute": "0", "hour": "9", "day": "*", "month": "*", "weekday": "1"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["data"]["expression"] == "0 9 * * 1"
    assert len(data["data"]["description"]) > 0


def test_all_wildcards():
    response = client.post("/cron/build", json={
        "minute": "*", "hour": "*", "day": "*", "month": "*", "weekday": "*"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["expression"] == "* * * * *"


def test_invalid_minute_out_of_range():
    response = client.post("/cron/build", json={
        "minute": "60", "hour": "0", "day": "1", "month": "1", "weekday": "0"
    })
    assert response.status_code == 422
    data = response.json()
    assert data["status"] == "error"


def test_invalid_hour_out_of_range():
    response = client.post("/cron/build", json={
        "minute": "0", "hour": "24", "day": "1", "month": "1", "weekday": "0"
    })
    assert response.status_code == 422
    data = response.json()
    assert data["status"] == "error"


def test_invalid_day_zero():
    response = client.post("/cron/build", json={
        "minute": "0", "hour": "0", "day": "0", "month": "1", "weekday": "0"
    })
    assert response.status_code == 422
    data = response.json()
    assert data["status"] == "error"


def test_invalid_day_32():
    response = client.post("/cron/build", json={
        "minute": "0", "hour": "0", "day": "32", "month": "1", "weekday": "0"
    })
    assert response.status_code == 422
    data = response.json()
    assert data["status"] == "error"


def test_invalid_month_zero():
    response = client.post("/cron/build", json={
        "minute": "0", "hour": "0", "day": "1", "month": "0", "weekday": "0"
    })
    assert response.status_code == 422
    data = response.json()
    assert data["status"] == "error"


def test_invalid_month_13():
    response = client.post("/cron/build", json={
        "minute": "0", "hour": "0", "day": "1", "month": "13", "weekday": "0"
    })
    assert response.status_code == 422
    data = response.json()
    assert data["status"] == "error"


def test_invalid_weekday_7():
    response = client.post("/cron/build", json={
        "minute": "0", "hour": "0", "day": "1", "month": "1", "weekday": "7"
    })
    assert response.status_code == 422
    data = response.json()
    assert data["status"] == "error"


def test_description_present():
    response = client.post("/cron/build", json={
        "minute": "30", "hour": "6", "day": "15", "month": "6", "weekday": "*"
    })
    assert response.status_code == 200
    data = response.json()
    assert "description" in data["data"]
    assert len(data["data"]["description"]) > 0
