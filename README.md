# Nexus Manager
Gaming Cafe Management System

## Stack
- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Netlify Functions (serverless Node.js)
- **Database:** Neon PostgreSQL (via Netlify DB integration)

## Project Structure
```
nexus-manager/
├── netlify/functions/    # Serverless API endpoints
├── src/
│   ├── pages/            # All page components
│   ├── components/       # Shared UI components
│   ├── context/          # Auth context
│   └── lib/              # API client + helpers
├── netlify.toml          # Netlify build + redirect config
└── nexus_manager_schema.sql  # Run this once in Neon
```
