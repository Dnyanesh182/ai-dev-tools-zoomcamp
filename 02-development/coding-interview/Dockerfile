FROM node:22-bookworm-slim AS frontend-build
WORKDIR /build
COPY package*.json ./
RUN npm install
COPY frontend ./frontend
RUN npm run build

FROM python:3.14-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend ./backend
COPY --from=frontend-build /build/frontend/dist ./frontend/dist
EXPOSE 8000
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
