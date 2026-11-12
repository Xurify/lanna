# E5. Keep API keys out of chat (2026-10-26)

Keys go in `.env` or environment variables, never in a thread. Each key only goes to its own service and is never logged in full.
