"""Apply the versioned SQL migrations to SQLite locally or Postgres in production."""

from pathlib import Path

from backend.database import connection, placeholder


MIGRATIONS = Path(__file__).parent / "migrations"


def apply_migrations():
    with connection() as db:
        cursor = db.cursor()
        cursor.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY)"
        )
        for migration in sorted(MIGRATIONS.glob("*.sql")):
            cursor.execute(
                placeholder("SELECT version FROM schema_migrations WHERE version = ?"),
                (migration.name,),
            )
            if cursor.fetchone():
                continue
            cursor.execute(migration.read_text(encoding="utf-8"))
            cursor.execute(
                placeholder("INSERT INTO schema_migrations (version) VALUES (?)"),
                (migration.name,),
            )


if __name__ == "__main__":
    apply_migrations()
