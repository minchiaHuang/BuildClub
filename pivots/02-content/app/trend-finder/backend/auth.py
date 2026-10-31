"""Sign-in for the agency's own people: email + password, a server-side session, an HttpOnly cookie.

Passwords are never stored; only a per-user salt and a scrypt hash. Accounts are made on the
command line (server.py add-user), there is no self-service registration."""

import hashlib
import os
import secrets
import sqlite3
import threading
import time

COOKIE = "tf_session"
SESSION_SECONDS = 30 * 24 * 3600  # the cookie's Max-Age is the same
MAX_FAILURES = 10
WINDOW_SECONDS = 10 * 60
MIN_PASSWORD = 8

SCHEMA = (
    "CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, name TEXT, agency TEXT, salt BLOB, hash BLOB, created INTEGER)",
    "CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, email TEXT, expires INTEGER)",
)

_migrated: set[tuple[str, int]] = set()  # (database file, inode) already migrated in this process


def migrate(conn: sqlite3.Connection) -> None:
    """Run _migrate once per database file, not on every connection."""
    path = next((row[2] for row in conn.execute("PRAGMA database_list") if row[1] == "main"), "")
    if not path:  # in-memory database: nothing to remember it by
        _migrate(conn)
        return
    key = (path, os.stat(path).st_ino)
    if key not in _migrated:
        _migrate(conn)
        _migrated.add(key)


def _migrate(conn: sqlite3.Connection) -> None:
    """Databases made before Google sign-in have no google_sub column; add it and leave every row alone."""
    if not any(col[1] == "google_sub" for col in conn.execute("PRAGMA table_info(users)")):
        conn.execute("ALTER TABLE users ADD COLUMN google_sub TEXT")


# Failed sign-ins per normalised email, kept in memory: a restart forgives them.
failures: dict[str, list[float]] = {}
failures_lock = threading.Lock()  # sign-ins run in a thread pool


def normalise(email: str) -> str:
    return email.strip().lower()


def hash_password(pw: str, salt: bytes) -> bytes:
    return hashlib.scrypt(pw.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)


def verify_password(pw: str, salt: bytes, expected: bytes) -> bool:
    return secrets.compare_digest(hash_password(pw, salt), expected)


def create_user(conn: sqlite3.Connection, email: str, name: str, agency: str, password: str) -> None:
    email = normalise(email)
    if "@" not in email:
        raise ValueError("That doesn't look like an email address.")
    if len(password) < MIN_PASSWORD:
        raise ValueError(f"Use a password of at least {MIN_PASSWORD} characters.")
    salt = secrets.token_bytes(16)
    try:
        conn.execute("INSERT INTO users (email, name, agency, salt, hash, created) VALUES (?, ?, ?, ?, ?, ?)",
                     (email, name.strip(), agency.strip(), salt, hash_password(password, salt), int(time.time())))
    except sqlite3.IntegrityError:
        raise ValueError(f"{email} already has an account.") from None


def has_users(conn: sqlite3.Connection) -> bool:
    return conn.execute("SELECT 1 FROM users LIMIT 1").fetchone() is not None


def too_many_failures(email: str, now: float) -> bool:
    with failures_lock:
        recent = [t for t in failures.get(email, []) if t > now - WINDOW_SECONDS]
        if recent:
            failures[email] = recent
        else:
            failures.pop(email, None)
        return len(recent) >= MAX_FAILURES


def note_failure(email: str, now: float) -> None:
    with failures_lock:
        if len(failures) > 5000:  # many made-up addresses: forget the ones whose window has passed
            for key in [k for k, v in failures.items() if v[-1] <= now - WINDOW_SECONDS]:
                del failures[key]
        failures.setdefault(email, []).append(now)


def clear_failures(email: str) -> None:
    with failures_lock:
        failures.pop(email, None)


# Checked against when the address is unknown, so a miss takes as long as a wrong password.
_DUMMY_SALT = secrets.token_bytes(16)
_DUMMY_HASH = hash_password("x", _DUMMY_SALT)


def check_login(conn: sqlite3.Connection, email: str, password: str):
    """The user row (email, name, agency) when the pair is right, else None. Same work either way."""
    row = conn.execute("SELECT email, name, agency, salt, hash FROM users WHERE email = ?", (email,)).fetchone()
    if row is None:
        verify_password(password, _DUMMY_SALT, _DUMMY_HASH)
        return None
    return row[:3] if verify_password(password, row[3], row[4]) else None


def start_session(conn: sqlite3.Connection, email: str, now: float) -> str:
    token = secrets.token_urlsafe(32)
    conn.execute("DELETE FROM sessions WHERE expires <= ?", (int(now),))
    conn.execute("INSERT INTO sessions (token, email, expires) VALUES (?, ?, ?)", (token, email, int(now) + SESSION_SECONDS))
    return token


def session_user(conn: sqlite3.Connection, token: str | None, now: float):
    """(email, name, agency) for a live session; an expired one is deleted and gives None."""
    if not token:
        return None
    row = conn.execute("SELECT email, expires FROM sessions WHERE token = ?", (token,)).fetchone()
    if row is None:
        return None
    if row[1] <= now:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        return None
    return conn.execute("SELECT email, name, agency FROM users WHERE email = ?", (row[0],)).fetchone()


def end_session(conn: sqlite3.Connection, token: str | None) -> None:
    if token:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
