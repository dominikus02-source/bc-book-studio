#!/usr/bin/env python3
"""Local-only JWKS fixture. Never use with production secrets."""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
from base64 import urlsafe_b64encode

def b64(n):
    return urlsafe_b64encode(n.to_bytes((n.bit_length()+7)//8, "big")).decode().rstrip("=")

key = serialization.load_pem_private_key(open(os.environ["TEST_KEY"], "rb").read(), password=None)
nums = key.public_key().public_numbers()
jwk = {"kty":"RSA","kid":"ci-key","alg":"RS256","use":"sig","n":b64(nums.n),"e":b64(nums.e)}
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/cdn-cgi/access/certs":
            self.send_response(404); self.end_headers(); return
        body = json.dumps({"keys":[jwk]}).encode()
        self.send_response(200); self.send_header("Content-Type","application/json")
        self.send_header("Content-Length",str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self, *args): pass
import ssl
ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(os.environ["TEST_CERT"],os.environ["TEST_TLS_KEY"])
srv=ThreadingHTTPServer(("0.0.0.0",8443),Handler)
srv.socket=ctx.wrap_socket(srv.socket,server_side=True)
srv.serve_forever()
