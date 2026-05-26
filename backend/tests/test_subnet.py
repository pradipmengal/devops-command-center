"""
Tests for IP Subnet Calculator endpoint.

Covers:
  - Standard /24 network
  - /32 (single host) and /0 (entire internet)
  - Private vs public IP detection
  - Loopback detection
  - IP class detection (A, B, C, D, E)
  - Invalid CIDR returns 422
  - Property: usable_hosts = total_addresses - 2 for /1 to /30
  - Property: network_address is always the first address in the block
  - Property: broadcast_address is always the last address in the block
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import ipaddress
import pytest
from hypothesis import given, settings
import hypothesis.strategies as st
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


# ── Unit tests ────────────────────────────────────────────────────────────────

def test_standard_class_c_network():
    resp = client.post("/subnet/calculate", json={"cidr": "192.168.1.0/24"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    d = data["data"]
    assert d["network_address"] == "192.168.1.0"
    assert d["broadcast_address"] == "192.168.1.255"
    assert d["subnet_mask"] == "255.255.255.0"
    assert d["prefix_length"] == 24
    assert d["total_addresses"] == 256
    assert d["usable_hosts"] == 254
    assert d["first_host"] == "192.168.1.1"
    assert d["last_host"] == "192.168.1.254"
    assert d["ip_class"] == "C"
    assert d["is_private"] is True
    assert d["is_loopback"] is False


def test_class_a_private_network():
    resp = client.post("/subnet/calculate", json={"cidr": "10.0.0.0/8"})
    assert resp.status_code == 200
    d = resp.json()["data"]
    assert d["ip_class"] == "A"
    assert d["is_private"] is True
    assert d["total_addresses"] == 2 ** 24


def test_class_b_network():
    resp = client.post("/subnet/calculate", json={"cidr": "172.16.0.0/16"})
    assert resp.status_code == 200
    d = resp.json()["data"]
    assert d["ip_class"] == "B"
    assert d["is_private"] is True


def test_loopback_network():
    resp = client.post("/subnet/calculate", json={"cidr": "127.0.0.0/8"})
    assert resp.status_code == 200
    d = resp.json()["data"]
    assert d["is_loopback"] is True


def test_public_ip():
    resp = client.post("/subnet/calculate", json={"cidr": "8.8.8.0/24"})
    assert resp.status_code == 200
    d = resp.json()["data"]
    assert d["is_private"] is False


def test_slash_32_single_host():
    resp = client.post("/subnet/calculate", json={"cidr": "192.168.1.100/32"})
    assert resp.status_code == 200
    d = resp.json()["data"]
    assert d["total_addresses"] == 1
    assert d["usable_hosts"] == 0
    # /32 has no usable hosts — first/last host are N/A
    assert d["first_host"] == "N/A"
    assert d["last_host"] == "N/A"
    assert d["network_address"] == "192.168.1.100"
    assert d["broadcast_address"] == "192.168.1.100"


def test_wildcard_mask_correct():
    resp = client.post("/subnet/calculate", json={"cidr": "10.0.0.0/8"})
    assert resp.status_code == 200
    d = resp.json()["data"]
    assert d["subnet_mask"] == "255.0.0.0"
    assert d["wildcard_mask"] == "0.255.255.255"


def test_invalid_cidr_returns_422():
    resp = client.post("/subnet/calculate", json={"cidr": "not-an-ip"})
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"
    assert "Invalid CIDR" in resp.json()["data"]["message"]


def test_invalid_cidr_out_of_range():
    resp = client.post("/subnet/calculate", json={"cidr": "256.0.0.0/24"})
    assert resp.status_code == 422
    assert resp.json()["status"] == "error"


def test_host_bits_set_strict_false():
    """192.168.1.5/24 should work (strict=False normalises to 192.168.1.0/24)."""
    resp = client.post("/subnet/calculate", json={"cidr": "192.168.1.5/24"})
    assert resp.status_code == 200
    assert resp.json()["data"]["network_address"] == "192.168.1.0"


# ── Property tests ────────────────────────────────────────────────────────────

@given(
    prefix=st.integers(min_value=1, max_value=30),
    a=st.integers(min_value=1, max_value=254),
    b=st.integers(min_value=0, max_value=255),
)
@settings(max_examples=100)
def test_usable_hosts_formula(prefix, a, b):
    """For /1 to /30, usable_hosts = total_addresses - 2."""
    cidr = f"{a}.{b}.0.0/{prefix}"
    resp = client.post("/subnet/calculate", json={"cidr": cidr})
    assert resp.status_code == 200
    d = resp.json()["data"]
    # Python's ipaddress.hosts() excludes network and broadcast for /1-/30
    assert d["usable_hosts"] == d["total_addresses"] - 2


@given(
    prefix=st.integers(min_value=1, max_value=32),
    a=st.integers(min_value=1, max_value=254),
    b=st.integers(min_value=0, max_value=255),
)
@settings(max_examples=100)
def test_network_address_is_first_in_block(prefix, a, b):
    """network_address must be the first address of the CIDR block."""
    cidr = f"{a}.{b}.0.0/{prefix}"
    resp = client.post("/subnet/calculate", json={"cidr": cidr})
    assert resp.status_code == 200
    d = resp.json()["data"]
    network = ipaddress.IPv4Network(cidr, strict=False)
    assert d["network_address"] == str(network.network_address)


@given(
    prefix=st.integers(min_value=1, max_value=32),
    a=st.integers(min_value=1, max_value=254),
    b=st.integers(min_value=0, max_value=255),
)
@settings(max_examples=100)
def test_broadcast_address_is_last_in_block(prefix, a, b):
    """broadcast_address must be the last address of the CIDR block."""
    cidr = f"{a}.{b}.0.0/{prefix}"
    resp = client.post("/subnet/calculate", json={"cidr": cidr})
    assert resp.status_code == 200
    d = resp.json()["data"]
    network = ipaddress.IPv4Network(cidr, strict=False)
    assert d["broadcast_address"] == str(network.broadcast_address)
