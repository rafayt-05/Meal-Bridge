# MealBridge — Surplus Food → People in Need

MealBridge is a third-party web platform that connects **food donors** (restaurants, caterers,
grocers, households) with **verified NGOs** nearby, so surplus food becomes someone's next meal
instead of landfill. Donors post what they have, NGOs see live offers on a map sorted by
distance, and the platform tracks each donation from `open → accepted → collected`.

| | |
|---|---|
| **Frontend** | Vanilla HTML / CSS / JS (no framework). Leaflet + OpenStreetMap for maps. |
| **Backend**  | Node.js + Express + Sequelize (SQLite). JWT auth, bcrypt password hashing. |
| **Maps**     | Free — no Google Maps key required. |
| **Single command run** | The Express server also serves the static frontend on the same port. |

---

## 🚀 Quick start

### Easiest (Windows): one-click

**Double-click `START.bat`** in the project root. It will:
1. Check Node.js is installed (and tell you where to get it if not)
2. Run `npm install` automatically the first time
3. Start the server

Then open **http://localhost:4000/** in your browser. Done.

### Manual (any OS)

#### 1. Prerequisites
- **Node.js 18+** — download from https://nodejs.org (the LTS button)
- npm comes bundled with Node

Verify in a terminal:
```powershell
node --version
npm --version
```

#### 2. Install backend dependencies

```powershell
cd "AI-food-trackor-main/server"
npm install
```

> On Windows you may see warnings about deprecated packages — they're harmless.

#### 3. (Optional) configure environment

A working default config is built in. To override anything, copy the example file:

```powershell
copy .env.example .env
```

Then edit `.env`. The only setting you really want to change for production is `JWT_SECRET`.

#### 4. Start the server

```powershell
npm start
```

You'll see:

```
  Food Donation Connector running
  → API:      http://localhost:4000/api
  → Frontend: http://localhost:4000/
```

Open **http://localhost:4000/** in your browser. That's it — the SPA, API and database all run from one command.

### 5. Demo accounts (auto-seeded on first run)

| Role  | Email               | Password   |
|-------|---------------------|------------|
| Donor | `donor@example.com` | `demo1234` |
| NGO   | `ngo@example.com`   | `demo1234` |

The Login page has **"Try as Demo Donor / NGO"** buttons that fill these in for you.

---

## 🧭 What you can do

### As a donor
1. **Sign up** → choose `I'm a Donor`, fill in the form, **drop a pin on the map** for your default pickup location.
2. **Post an offer** on the dashboard: item name, portions, category, pickup notes, best-before time, optional photo URL. **Click the map** to set the pickup spot (or leave it to use your saved address).
3. **See nearby NGOs** ranked by distance, with their contact details.
4. **Track each offer**: `open` (waiting), `accepted` (an NGO is coming), `collected` (done).

### As an NGO
1. **Sign up** → choose `I'm an NGO`, drop a pin where your base is.
2. **Open the NGO Inbox** — open donations near you appear on a live map and in a list **sorted by distance**.
3. **Accept** offers that fit your route and capacity. The donor's phone is shown so you can call.
4. **Mark collected** once you've picked up. You'll see lifetime totals in the metric cards.

---

## 🗂 Project structure

```
AI-food-trackor-main/
├── START.bat               # Windows one-click launcher (installs deps + runs the server)
├── index.html              # SPA shell — landing, login, register, dashboards, about, FAQ
├── app.js                  # SPA logic: routing, auth, API calls, Leaflet maps, toasts
├── styles.css              # Dark theme, components, responsive layout
├── README.md
└── server/
    ├── package.json
    ├── .env.example
    └── src/
        ├── index.js        # Express bootstrap + static file serving
        ├── seed.js         # Seeds demo NGOs + demo donor + demo NGO account
        ├── middleware/
        │   └── auth.js     # JWT verifier
        ├── models/
        │   ├── index.js    # Sequelize init (SQLite at server/db/database.sqlite)
        │   ├── user.js     # Users (donor / ngo), email+password, lat/lng
        │   ├── ngo.js      # NGO directory entries (verified orgs)
        │   └── offer.js    # Food offers
        └── routes/
            ├── auth.js     # POST /api/auth/register, /login, GET/PATCH /me
            ├── offers.js   # CRUD + accept + mark-collected
            └── ngo.js      # NGO directory (with distance sort)
```

The SQLite database file is auto-created at `server/db/database.sqlite` on first run.
To reset everything (clear all users/offers and re-seed): stop the server, **delete that file**,
restart `npm start`.

---

## 🛰 API reference

All routes are under `/api`. Authenticated routes need an `Authorization: Bearer <jwt>` header.

| Method | Path                       | Auth | Description |
|--------|----------------------------|------|-------------|
| POST   | `/auth/register`           | —    | Create account (donor or ngo) |
| POST   | `/auth/login`              | —    | Returns `{ token, user }` |
| GET    | `/auth/me`                 | ✓    | Current user |
| PATCH  | `/auth/me`                 | ✓    | Update name / phone / address / lat / lng |
| GET    | `/offers?lat=&lng=&status=`| —    | List offers, optionally sorted by distance |
| GET    | `/offers/mine`             | ✓ donor | Offers I posted |
| GET    | `/offers/accepted`         | ✓ ngo   | Offers I've claimed |
| POST   | `/offers`                  | ✓ donor | Create an offer |
| DELETE | `/offers/:id`              | ✓ donor (owner) | Remove an offer |
| POST   | `/offers/:id/accept`       | ✓ ngo   | Claim an offer |
| POST   | `/offers/:id/collected`    | ✓ ngo (acceptor) | Mark as collected |
| GET    | `/ngos?lat=&lng=`          | —    | NGO directory, sorted by distance if coords given |

---

## 🗺 About the map

We use **Leaflet** with **OpenStreetMap** tiles — totally free, no API key, no quotas.
The dark look is achieved with a CSS filter on the tiles. You can swap to any other tile provider
(MapTiler, Mapbox, Stadia) by changing the `L.tileLayer(...)` URL in `app.js`.

If you'd rather use **real Google Maps**, replace the Leaflet calls with `google.maps.Map` —
the data model (lat/lng on users, offers and NGOs) is already in place.

---

## 🧯 Troubleshooting

**`'npm' is not recognized as the name of a cmdlet`** → Node.js isn't installed (or its PATH didn't load).
Install it from https://nodejs.org/, **close and reopen** your terminal, then try again.

**`Error: listen EADDRINUSE :::4000`** → Port 4000 is already in use. Either stop the other process, or
set a different port:
```powershell
$env:PORT=5000; npm start
```

**Map tiles aren't loading** → The map uses OpenStreetMap over HTTPS. If you're behind a corporate
proxy/firewall that blocks `*.tile.openstreetmap.org`, the map will be blank — try another network.

**I broke the data and want a fresh start** → Stop the server, delete `server/db/database.sqlite`, restart.
On boot the seed script re-creates the demo NGOs and demo accounts.

**Forgot the demo password** → It's `demo1234` for both `donor@example.com` and `ngo@example.com`.

---

## 🛠 Production notes

This is a working prototype, not a hardened production deployment. Before going live:

- [ ] Change `JWT_SECRET` to a long random value
- [ ] Move from SQLite to Postgres (Sequelize supports it; update `models/index.js`)
- [ ] Put the app behind HTTPS (reverse proxy: nginx / Caddy / Cloudflare)
- [ ] Add rate-limiting on `/auth/*` (e.g. `express-rate-limit`)
- [ ] Implement NGO verification workflow (manual review + admin panel)
- [ ] Add real photo uploads (S3 or similar) instead of URL-only
- [ ] Email/SMS notifications when an offer is accepted (Nodemailer / Twilio)
- [ ] Background job to auto-cancel offers past their `expiry` time

---

## 📜 License

Built as a not-for-profit prototype. Use it, fork it, deploy it — just don't charge donors or NGOs for it.
