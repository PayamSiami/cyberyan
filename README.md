# Cyberyan — LinkedIn Profile Search

Full-stack app for importing LinkedIn profile CSV exports and searching them:

- **MongoDB** — source of truth (all profile data)
- **Elasticsearch** — derived search index (full-text, facets)
- **NestJS backend** (`cberyan-backend/`) — API, CSV import, dual-store sync
- **React/Vite frontend** (`cyberyan-frontend/`) — UI

```
┌──────────────────┐  /api/* (proxy)  ┌────────────────┐  writes   ┌───────────────┐
│  Frontend :4173  │ ───────────────► │  Backend :3000 │ ────────► │ MongoDB:27017 │
│  React + Vite    │                  │  NestJS        │           │ source of     │
└──────────────────┘                  └───────┬────────┘           │ truth         │
                                              │ search/aggs        └───────┬───────┘
                                              ▼                            │ _id shared
                                       ┌────────────────┐                  │
                                       │ Elasticsearch  │ ◄── reindex ─────┘
                                       │ :9200 (index)  │
                                       └────────────────┘
```

Search requests hit Elasticsearch only; the profile id in every result is the
MongoDB `_id`, so detail views read the full document from Mongo.

---

## 1. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 22+ | `node --version` |
| pnpm | 10+ | `pnpm --version` (install: `npm i -g pnpm`) |
| Docker | any recent | `docker ps` (for MongoDB + Elasticsearch) |

## 2. Start the databases

**Elasticsearch** (8.15 matches the client):

```powershell
docker run -d --name cyberyan-es `
  -p 9200:9200 `
  -e discovery.type=single-node `
  -e xpack.security.enabled=false `
  docker.elastic.co/elasticsearch/elasticsearch:8.15.0
```

**MongoDB**:

```powershell
docker run -d --name cyberyan-mongo -p 27017:27017 mongo:7
```

Verify: <http://127.0.0.1:9200> returns JSON; `docker ps` shows both containers.

> No manual schema/index setup is needed — the backend creates the
> `profiles` ES index on startup; MongoDB collections are created lazily.

## 3. Run the backend

```powershell
cd cberyan-backend
pnpm install
pnpm run build        # compile TS -> dist/
pnpm run start:dev    # dev mode with auto-reload (recommended)
```

Or production mode: `node dist/main.js`.

Configuration lives in `.env`:

```env
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic        # only if security is enabled
ELASTICSEARCH_PASSWORD=changeme
MONGODB_URI=mongodb://127.0.0.1:27017/cyberyan?directConnection=true
PORT=3000
```

> **Startup order note:** the backend waits for MongoDB on boot and retries
> (`MongooseModule ... Retrying (n)` in the log) until it can connect. Start
> Mongo first — or start the backend first and it comes up as soon as Mongo
> appears. If Mongo is down, search still works but writes fail.

Verify: <http://127.0.0.1:3000/api/profiles/search?limit=1> returns
`{"data":[],"total":0,...}` on a fresh install.

## 4. Run the frontend

```powershell
cd cyberyan-frontend
pnpm install
```

**Option A — dev server (hot reload):**

```powershell
pnpm run dev
```

Open <http://localhost:5173>. API calls to `/api/*` are proxied to
`http://127.0.0.1:3000` (configured in `vite.config.ts`).

**Option B — production build:**

```powershell
pnpm run build
node serve.mjs        # serves dist/ on http://127.0.0.1:4173 and proxies /api
```

Open <http://127.0.0.1:4173>.

> To point the frontend at a backend on another host, set `VITE_API_URL`
> (e.g. `VITE_API_URL=http://myserver:3000` before building) — the backend has
> CORS enabled.

## 5. Use the app

1. **Import CSV** — pick a CSV file (header row expected; the bundled sample is
   `cberyan-backend/300 user linkedin.txt`) and click **Upload**. Rows are
   written to MongoDB **and** indexed into Elasticsearch. You get a report:
   - `Stored in MongoDB` — rows persisted (source of truth)
   - `Indexed (Elasticsearch)` — rows searchable
   - `Failed (mapping errors)` — ES rejected, grouped by reason
   - `Corrupt rows skipped` — broken rows (wrong column count or implausible
     shifted values), listed with row number + reason
   - `Rows repaired` — rows kept after dropping a single bad field
2. **Search profiles** — fuzzy-search name / title / company / skills,
   paginate, click a row for the full profile (read from MongoDB).
3. **Filters** (sidebar) — click a facet chip (Industry / Country / Gender) to
   filter results; counts come from the aggregations endpoint.

## 6. API reference

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/profiles/search?q=&page=&limit=&industry=&location_country=&gender=` | Paginated search (Elasticsearch) |
| `POST` | `/api/profiles/upload-csv` | multipart field `file` — parse → Mongo → ES |
| `GET` | `/api/profiles/aggregations/:field` | top-50 value counts for a field |
| `GET` | `/api/profiles/:id` | single profile (from MongoDB) |
| `POST` | `/api/profiles` | create one profile (JSON body) |
| `PUT` | `/api/profiles/:id` | update profile (Mongo + ES sync) |
| `DELETE` | `/api/profiles/:id` | delete profile (Mongo + ES sync) |
| `POST` | `/api/profiles/reindex` | wipe ES index and rebuild it from MongoDB |

Upload response shape:

```json
{
  "message": "Stored 32 profiles in MongoDB and indexed 32 into Elasticsearch",
  "stored": 32,
  "indexed": 32,
  "failed": 0,
  "errors": [],
  "invalidRows": [{ "row": 17, "reason": "expected 77 columns, got 497", "preview": "..." }],
  "invalidCount": 21,
  "repairedCount": 17
}
```

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| Backend log shows `MongooseModule ... Retrying (n)` | MongoDB isn't running — start the container (step 2). The app listens as soon as it connects. |
| `ECONNREFUSED 127.0.0.1:9200` on startup | Elasticsearch isn't running — start the container (step 2). |
| `Error: listen EADDRINUSE :::3000` | Another backend instance owns the port — kill it or set `PORT` in `.env`. |
| Upload says `Failed to store profiles in MongoDB` | Mongo is down or the URI in `.env` is wrong. |
| ES and Mongo out of sync (or legacy docs with non-ObjectId ids) | `POST /api/profiles/reindex` rebuilds ES from Mongo. |
| Upload returns `400` instantly | Not `multipart/form-data`, or the file field isn't named `file`. |
| Vite build fails in sandboxed/CI shells | Run `pnpm run build` in a normal terminal (Vite spawns workers). |

## 8. Project layout

```
cberyan-backend/
  src/main.ts                        # bootstrap, CORS, validation pipe
  src/modules/database/              # Mongoose connection (MONGODB_URI)
  src/modules/elasticsearch/         # ES client setup
  src/modules/profile/
    profile.controller.ts            # REST routes
    profile.service.ts               # CSV parse, Mongo writes, ES index, search, aggs
    profile.schema.ts                # Mongo schema (strict:false keeps all CSV fields)
    dto/search-profile.dto.ts        # query validation
  300 user linkedin.txt              # sample data (also: example of corrupt rows)
cyberyan-frontend/
  src/api.ts                         # typed API client
  src/App.tsx                        # layout + filter state
  src/UploadPanel.tsx                # CSV import + report UI
  src/SearchPanel.tsx                # search table + profile detail
  src/FacetPanel.tsx                 # aggregation filter chips
  serve.mjs                          # static server + /api proxy for dist/
```
