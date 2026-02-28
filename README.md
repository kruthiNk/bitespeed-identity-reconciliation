# Bitespeed Identity Reconciliation

A web service that identifies and consolidates customer contact information across multiple purchases.

## Live Endpoint

```
POST https://<your-render-url>/identify
```

## How it Works

The `/identify` endpoint receives an `email` and/or `phoneNumber` and returns a consolidated view of that customer's identity, linking all related contacts under a single primary.

### Key Rules

- **No match** → Creates a new primary contact.
- **Partial match** (new info on existing contact) → Creates a secondary contact linked to primary.
- **Two separate primaries linked by new request** → Older one stays primary; newer one becomes secondary.

**Request body:**
```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```

**Response:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

### Prerequisites
- Node.js 18+
- PostgreSQL database

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/bitespeed-identity-reconciliation
cd bitespeed-identity-reconciliation

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and set your DATABASE_URL

# 4. Generate Prisma client & push schema
npx prisma generate
npx prisma db push

# 5. Run in development mode
npm run dev

# 6. Or build and run production
npm run build && npm start
```

The server starts on `http://localhost:3000`.

## Deploy to Render (Free)

1. Push code to GitHub.
2. Go to [render.com](https://render.com) → **New** → **Blueprint**.
3. Connect your GitHub repo — Render will detect `render.yaml` automatically.
4. It will provision a free PostgreSQL database and web service.
5. After deploy, your endpoint is live at `https://<service-name>.onrender.com/identify`.

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express
- **ORM:** Prisma
- **Database:** PostgreSQL
