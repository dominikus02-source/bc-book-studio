import http.client
import threading
import time
from unittest.mock import patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.exceptions import PyJWKClientError
import sys
sys.path.insert(0, "/app")
import server
from http.server import ThreadingHTTPServer

@pytest.fixture(scope="module")
def keys():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048), rsa.generate_private_key(public_exponent=65537, key_size=2048)

@pytest.fixture(scope="module")
def endpoint():
    http = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
    thread = threading.Thread(target=http.serve_forever, daemon=True)
    thread.start()
    yield http.server_port
    http.shutdown()
    http.server_close()

@pytest.fixture
def claims():
    now = int(time.time())
    return {"iss": server.ISSUER, "aud": server.AUD, "exp": now+300, "nbf": now-5, "email": "Test@Example.invalid"}

def request(port, token=None, extra=None, path="/auth"):
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=3)
    headers = dict(extra or {})
    if token is not None:
        headers["Cf-Access-Jwt-Assertion"] = token
    conn.request("GET", path, headers=headers)
    response = conn.getresponse()
    result = response.status, response.getheader("X-Access-Identity"), response.getheader("Cache-Control")
    response.read()
    conn.close()
    return result

def signed(claims, key, algorithm="RS256", kid="k1"):
    return jwt.encode(claims, key, algorithm=algorithm, headers={"kid": kid})

def verify(port, token, public_key, expected=401, extra=None):
    key = type("JWK", (), {"key": public_key})()
    with patch.object(server.JWKS, "get_signing_key_from_jwt", return_value=key):
        result = request(port, token, extra)
    assert result[0] == expected
    assert result[2] == "no-store"
    assert result[1] == ("test@example.invalid" if expected == 200 else None)

def test_valid(endpoint, claims, keys):
    verify(endpoint, signed(claims, keys[0]), keys[0].public_key(), 200)

@pytest.mark.parametrize("field,value", [
    ("aud", "wrong"), ("iss", "https://wrong.invalid"), ("exp", 1),
    ("nbf", 4102444800), ("email", ""), ("email", "not-an-email"), ("email", 123),
])
def test_invalid_claim(endpoint, claims, keys, field, value):
    verify(endpoint, signed({**claims, field:value}, keys[0]), keys[0].public_key())

@pytest.mark.parametrize("field", ["email", "exp", "iss", "aud"])
def test_missing_claim(endpoint, claims, keys, field):
    updated = dict(claims)
    del updated[field]
    verify(endpoint, signed(updated, keys[0]), keys[0].public_key())

def test_bad_signature(endpoint, claims, keys):
    verify(endpoint, signed(claims, keys[1]), keys[0].public_key())

def test_none_algorithm(endpoint, claims, keys):
    verify(endpoint, jwt.encode(claims, "", algorithm="none"), keys[0].public_key())

def test_hs256(endpoint, claims, keys):
    verify(endpoint, jwt.encode(claims, "shared-secret", algorithm="HS256"), keys[0].public_key())

@pytest.mark.parametrize("token", [None, "bad.jwt", "x"*12001])
def test_missing_malformed_oversize(endpoint, token):
    assert request(endpoint, token)[0] == 401

def test_spoofed_identity(endpoint, claims, keys):
    verify(endpoint, signed(claims, keys[0]), keys[0].public_key(), 200,
           {"X-Access-Identity": "attacker@example.invalid"})

@pytest.mark.parametrize("error", [PyJWKClientError("unknown kid"), TimeoutError("jwks unavailable")])
def test_jwks_fail_closed(endpoint, claims, keys, error):
    with patch.object(server.JWKS, "get_signing_key_from_jwt", side_effect=error):
        assert request(endpoint, signed(claims, keys[0]))[0] == 401

def test_key_rotation(endpoint, claims, keys):
    token = signed(claims, keys[0], kid="rotated")
    key = type("JWK", (), {"key": keys[0].public_key()})()
    with patch.object(server.JWKS, "get_signing_key_from_jwt", side_effect=[PyJWKClientError("unknown kid"), key]):
        assert request(endpoint, token)[0] == 401
        assert request(endpoint, token)[0] == 200

def test_negative_control_mutated_audience(endpoint, claims, keys):
    token = signed({**claims, "aud":"wrong"}, keys[0])
    verify(endpoint, token, keys[0].public_key(), 401)
    # Positive control verifies rejection is not caused by broken fixture.
    verify(endpoint, signed(claims, keys[0]), keys[0].public_key(), 200)

def test_health_and_unknown(endpoint):
    assert request(endpoint, path="/health")[0] == 200
    assert request(endpoint, path="/missing")[0] == 404
