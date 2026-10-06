"""A local stand-in for the Supabase APIs the site uses, for testing circles and
teacher uploads in a
browser without a real project. Development only; never deployed.

It runs the real database functions (supabase/migrations) on a local Postgres
loaded with supabase/tests/stub_supabase.sql, and fakes the rest:
  - Auth: any Israeli mobile number; the SMS code is always 123456.
  - Edge functions: create-circle (no AI check) and report-circle (no Turnstile).
  - Storage: files kept in a temp folder.

Usage: python3 tech/tools/supabase/mock_server.py --db "host=/tmp port=5433 user=postgres dbname=dev" [--port 54321]
Then point assets/js/config.js at http://localhost:54321 with any anon key.
"""
import argparse, base64, hashlib, json, os, tempfile, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

import psycopg
from psycopg import sql

ARGS = None
FILES = tempfile.mkdtemp(prefix="mock-storage-")


def b64(d):
    return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()


def make_jwt(claims):
    return b64({"alg": "HS256", "typ": "JWT"}) + "." + b64(claims) + ".mock"


def read_jwt(token):
    try:
        part = token.split(".")[1]
        return json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))
    except Exception:  # noqa: BLE001
        return None


def user_for(phone):
    uid = str(uuid.uuid5(uuid.NAMESPACE_URL, "phone:" + phone))
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return {"id": uid, "aud": "authenticated", "role": "authenticated", "phone": phone,
            "phone_confirmed_at": now, "confirmed_at": now, "created_at": now, "updated_at": now,
            "app_metadata": {"provider": "phone"}, "user_metadata": {}, "identities": []}


def session_for(phone):
    user = user_for(phone)
    exp = int(time.time()) + 3600
    claims = {"sub": user["id"], "phone": phone, "role": "authenticated", "aud": "authenticated", "exp": exp}
    return {"access_token": make_jwt(claims), "token_type": "bearer", "expires_in": 3600, "expires_at": exp,
            "refresh_token": "mock-refresh-" + phone, "user": user}


def run(role, claims, query, params=()):
    with psycopg.connect(ARGS.db, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute("select set_config('request.jwt.claims', %s, false)", (json.dumps(claims or {}),))
            if role != "postgres":  # "postgres": storage bookkeeping, which Supabase does itself
                cur.execute(sql.SQL("set role {}").format(sql.Identifier(role)))
            cur.execute(query, params)
            return cur.fetchone()[0] if cur.description else None


def file_bytes(headers, raw):
    """supabase-js sends Blobs/Files as multipart/form-data; keep only the file."""
    ctype = headers.get("Content-Type") or ""
    if not ctype.startswith("multipart/form-data"):
        return raw
    from email.parser import BytesParser
    from email.policy import HTTP
    msg = BytesParser(policy=HTTP).parsebytes(b"Content-Type: " + ctype.encode() + b"\r\n\r\n" + raw)
    for part in msg.iter_parts():
        if part.get_filename() is not None or part.get_param("name", header="content-disposition") in ("", "file"):
            return part.get_payload(decode=True)
    return raw


class H(BaseHTTPRequestHandler):
    def log_message(self, fmt, *a):
        pass

    def cors(self):
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin") or "*")
        self.send_header("Access-Control-Allow-Headers", self.headers.get("Access-Control-Request-Headers") or "authorization, apikey, content-type, x-client-info, x-upsert")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Credentials", "true")

    def reply(self, status, body=None, ctype="application/json"):
        data = body if isinstance(body, (bytes, bytearray)) else json.dumps(body).encode() if body is not None else b""
        self.send_response(status)
        self.cors()
        if data:
            self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def who(self):
        tok = (self.headers.get("Authorization") or "").replace("Bearer ", "")
        c = read_jwt(tok)
        if c and c.get("role") == "authenticated":
            return "authenticated", {"sub": c["sub"], "phone": c["phone"], "role": "authenticated"}
        if c and c.get("role") == "service_role":
            return "service_role", {}
        return "anon", {}

    def do_OPTIONS(self):
        self.reply(204)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/auth/v1/user":
            role, c = self.who()
            return self.reply(200, user_for(c["phone"])) if role == "authenticated" else self.reply(401, {"msg": "no session"})
        if u.path == "/rest/v1/submissions" and self.who()[0] == "service_role":
            q = parse_qs(u.query)
            where, params = [], []
            for col in ("status", "id"):
                for v in q.get(col, []):
                    op, val = v.split(".", 1)
                    where.append(f"{col} {'=' if op == 'eq' else '<>'} %s"); params.append(val)
            query = "select coalesce(jsonb_agg(to_jsonb(s) order by created_at), '[]') from submissions s" + (" where " + " and ".join(where) if where else "")
            return self.reply(200, run("service_role", {}, query, params))
        if u.path.startswith("/storage/v1/object/") and not u.path.startswith(("/storage/v1/object/sign/", "/storage/v1/object/public/")):
            key = unquote(u.path.split("/object/", 1)[1])
            p = os.path.join(FILES, key.replace("/", "__"))
            return self.reply(200, open(p, "rb").read(), "application/octet-stream") if os.path.exists(p) else self.reply(404, {"error": "not found"})
        if u.path.startswith("/storage/v1/object/sign/") or u.path.startswith("/storage/v1/object/public/"):
            key = unquote(u.path.split("/object/", 1)[1].split("/", 1)[1])
            p = os.path.join(FILES, key.replace("/", "__"))
            if os.path.exists(p):
                return self.reply(200, open(p, "rb").read(), "application/octet-stream")
            return self.reply(404, {"error": "not found"})
        self.reply(404, {"error": "not found"})

    def do_POST(self):
        u = urlparse(self.path)
        raw = self.body()
        if u.path == "/auth/v1/otp":
            return self.reply(200, {})
        if u.path == "/auth/v1/verify":
            b = json.loads(raw or b"{}")
            phone = (b.get("phone") or "").lstrip("+")
            if b.get("token") != "123456":
                return self.reply(403, {"code": "otp_expired", "msg": "Token has expired or is invalid", "error_code": "otp_expired"})
            return self.reply(200, session_for(phone))
        if u.path == "/auth/v1/token":
            q = parse_qs(u.query)
            if q.get("grant_type") == ["refresh_token"]:
                b = json.loads(raw or b"{}")
                return self.reply(200, session_for(b.get("refresh_token", "").replace("mock-refresh-", "")))
        if u.path == "/auth/v1/logout":
            return self.reply(204)
        if u.path.startswith("/rest/v1/rpc/"):
            fn = u.path.rsplit("/", 1)[1]
            args = json.loads(raw or b"{}")
            role, c = self.who()
            q = sql.SQL("select to_jsonb(public.{}({}))").format(
                sql.Identifier(fn), sql.SQL(", ").join(sql.SQL("{} => %s").format(sql.Identifier(k)) for k in args))
            params = [json.dumps(v) if isinstance(v, (dict, list)) and k not in ("p_tags",) else v for k, v in args.items()]
            try:
                return self.reply(200, run(role, c, q, params))
            except psycopg.errors.InsufficientPrivilege as e:
                return self.reply(403, {"code": "42501", "message": str(e)})
            except psycopg.Error as e:
                return self.reply(400, {"code": e.sqlstate, "message": str(e)})
        if u.path == "/functions/v1/create-circle":
            role, c = self.who()
            if role != "authenticated":
                return self.reply(401, {"ok": False, "error": "auth"})
            p = json.loads(raw or b"{}").get("circle")
            q = "select public.create_circle_as(%s::uuid, %s, %s::jsonb, false, false)"
            return self.reply(200, run("service_role", {}, q, (c["sub"], c["phone"], json.dumps(p))))
        if u.path == "/functions/v1/report-circle":
            b = json.loads(raw or b"{}")
            h = hashlib.sha256((self.client_address[0] + (self.headers.get("X-Test-Reporter") or "")).encode()).hexdigest()
            return self.reply(200, run("service_role", {}, "select public.report_circle_as(%s::uuid, %s, %s)", (b.get("id"), h, b.get("reason"))))
        if u.path.startswith("/storage/v1/object/sign/"):
            key = u.path.split("/object/sign/", 1)[1]
            return self.reply(200, {"signedURL": "/object/sign/" + key + "?token=mock"})
        if u.path.startswith("/storage/v1/object/"):
            bucket, name = unquote(u.path.split("/object/", 1)[1]).split("/", 1)
            role, c = self.who()
            if role != "service_role" and (bucket != "submissions" or role != "authenticated" or name.split("/")[0] != c["sub"]):
                return self.reply(403, {"error": "Unauthorized", "message": "new row violates row-level security policy"})
            with open(os.path.join(FILES, (bucket + "/" + name).replace("/", "__")), "wb") as f:
                f.write(file_bytes(self.headers, raw))
            run("postgres", {}, "insert into storage.objects (bucket_id, name, owner) values (%s, %s, %s)",
                (bucket, name, c.get("sub")))
            return self.reply(200, {"Key": bucket + "/" + name, "Id": str(uuid.uuid4())})
        self.reply(404, {"error": "not found"})


def _patch(self):
    u = urlparse(self.path)
    if u.path == "/rest/v1/submissions" and self.who()[0] == "service_role":
        sid = parse_qs(u.query)["id"][0].split(".", 1)[1]
        fields = json.loads(self.body() or b"{}")
        sets = sql.SQL(", ").join(sql.SQL("{} = %s").format(sql.Identifier(k)) for k in fields)
        vals = [json.dumps(v) if isinstance(v, (dict, list)) else v for v in fields.values()]
        run("service_role", {}, sql.SQL("update submissions set {} where id = %s").format(sets), vals + [sid])
        return self.reply(204)
    self.reply(404, {"error": "not found"})


def _delete(self):
    u = urlparse(self.path)
    if u.path.startswith("/storage/v1/object/") and self.who()[0] == "service_role":
        bucket = u.path.rsplit("/", 1)[1]
        for name in json.loads(self.body() or b"{}").get("prefixes", []):
            p = os.path.join(FILES, (bucket + "/" + name).replace("/", "__"))
            if os.path.exists(p):
                os.remove(p)
        return self.reply(200, [])
    self.reply(404, {"error": "not found"})


H.do_PATCH = _patch
H.do_DELETE = _delete

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--port", type=int, default=54321)
    ARGS = ap.parse_args()
    print(f"mock Supabase on http://localhost:{ARGS.port} (files in {FILES})")
    ThreadingHTTPServer(("127.0.0.1", ARGS.port), H).serve_forever()
