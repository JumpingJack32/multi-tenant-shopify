#!/bin/sh
set -e

echo "=== Starting E-Commerce Platform Backend ==="

# Wait for database if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
    echo "[1/2] Executing database migrations via Alembic..."
    alembic upgrade head || {
        echo "Error: Database migration failed!"
        exit 1
    }
    echo "✔ Database migrations completed successfully."
else
    echo "Warning: DATABASE_URL not detected. Skipping migrations."
fi

# Start Uvicorn ASGI server
echo "[2/2] Starting Uvicorn server..."
exec uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WEB_CONCURRENCY:-2}
