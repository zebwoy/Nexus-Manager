# Nexus Manager
Gaming Cafe Management System

## Stack
- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Netlify Functions (serverless Node.js)
- **Database:** Neon PostgreSQL (via Netlify DB integration)

---

## Deployment Steps

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/nexus-manager.git
git push -u origin main
```

### 2. Deploy on Netlify
1. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
2. Connect your GitHub repo
3. Build settings are auto-detected from `netlify.toml`
4. Click **Deploy site**

### 3. Add Neon Database
1. In Netlify dashboard → your site → **Integrations** → **Neon Postgres**
2. Click **Enable** → Create a new database
3. Netlify auto-injects `DATABASE_URL` as an environment variable

### 4. Run the Schema
1. Go to [console.neon.tech](https://console.neon.tech)
2. Select your project → **SQL Editor**
3. Paste the contents of `nexus_manager_schema.sql` and run it

### 5. Create your owner account
After the schema is set up, run this in the Neon SQL editor:
```sql
INSERT INTO users (full_name, username, pin) VALUES ('Your Name', 'yourusername', '1234');
```
Replace with your actual name, username, and preferred PIN.

---

## Local Development
```bash
npm install
cd netlify/functions && npm install && cd ../..

# Install Netlify CLI
npm install -g netlify-cli

# Run locally (proxies functions automatically)
netlify dev
```

Add a `.env` file for local development:
```
DATABASE_URL=your_neon_connection_string
```

---

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
