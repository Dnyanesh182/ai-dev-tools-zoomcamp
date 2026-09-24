"""Small database adapter used by PairPad in local and container environments."""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path


SQLITE_DB = Path(os.getenv("SQLITE_DB_PATH", Path(__file__).with_name("pairpad.db")))
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{SQLITE_DB}")


def uses_postgres() -> bool:
    return DATABASE_URL.startswith(("postgres://", "postgresql://"))


@contextmanager
def connection():
    if uses_postgres():
        import psycopg2

        db = psycopg2.connect(DATABASE_URL)
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()
    else:
        db = sqlite3.connect(SQLITE_DB)
        db.row_factory = sqlite3.Row
        try:
            yield db
            db.commit()
        finally:
            db.close()


def placeholder(sql: str) -> str:
    """Translate the SQLite placeholder syntax used by the application."""
    return sql.replace("?", "%s") if uses_postgres() else sql


def row_to_dict(cursor, row):
    if row is None:
        return None
    return dict(row) if not uses_postgres() else dict(zip((item[0] for item in cursor.description), row))
