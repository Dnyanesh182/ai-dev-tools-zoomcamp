CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    language TEXT NOT NULL CHECK (language IN ('python', 'javascript'))
);
