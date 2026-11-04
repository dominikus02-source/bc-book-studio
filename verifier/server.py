import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
import jwt
from jwt import PyJWKClient

TEAM = os.environ["CF_ACCESS_TEAM_DOMAIN"].strip().rstrip("/")
AUD = os.environ["CF_ACCESS_AUD"]
ISSUER = "https://" + TEAM
JWKS = PyJWKClient(ISSUER + "/cdn-cgi/access/certs", cache_jwk_set=False)

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")
            return
        if path != "/auth":
            self.send_response(404)
            self.end_headers()
            return
        token = self.headers.get("Cf-Access-Jwt-Assertion", "")
        try:
            if not token or len(token) > 12000:
                raise ValueError("missing or oversized token")
            key = JWKS.get_signing_key_from_jwt(token)
            claims = jwt.decode(token, key.key, algorithms=["RS256"], audience=AUD,
                                issuer=ISSUER, options={"require": ["exp", "iss", "aud", "email"]},
                                leeway=10)
            email = claims["email"]
            if not isinstance(email, str) or not email.strip() or "@" not in email:
                raise ValueError("invalid email")
            email = email.strip().lower()
        except Exception:
            self.send_response(401)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("X-Access-Identity", email)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
