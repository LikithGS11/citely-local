// Single source of truth for the backend API base URL.
// Configure via NEXT_PUBLIC_API_URL (see .env / docker-compose.yml).
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
