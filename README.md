# Sprite Pipeline Monorepo (AI-first 2D character pipeline)

This repo is a **modern monorepo** that implements an **AI-first 2D character pipeline** for a Pokémon-style top-down game:
- Upload a reference image
- Generate a stylized concept
- Generate turnarounds (N/S/W/E)
- Generate action frames (idle/walk/interact, configurable)
- Segment masks
- Pack frames into sprite sheets
- Emit a game-ready manifest (JSON) with pivots + events

It’s designed to be **future-proof**: the pipeline calls **capabilities** (e.g. `stylize.img2img`, `mask.segment`) rather than hard-coding a single model.
To upgrade to new models, edit `config/model-manifest.json` — no code changes required.

## Stack

- **TypeScript** everywhere
- **Fastify** API + OpenAPI docs
- **Next.js 14** UI (App Router) + Tailwind
- **BullMQ** job queue (Redis)
- **Prisma + SQLite** job DB (swap to Postgres easily)
- Pluggable model providers: **fal.ai**, **Replicate**, or **Mock** (runs without keys)

## Quickstart (local dev)

1) Install deps
```bash
pnpm install
```

2) Start Redis
```bash
docker compose up -d
```

3) Copy env
```bash
cp .env.example .env
```

4) Init DB
```bash
pnpm db:generate
pnpm db:migrate
```

5) Run dev
```bash
pnpm dev
```

- API: `http://localhost:4000` (OpenAPI at `/docs`)
- Web: `http://localhost:3000`

### Run without model keys
Set:
```bash
PIPELINE_PROVIDER=mock
```
The pipeline will generate placeholder images for every stage so you can verify end-to-end behavior.

## How to swap models as better ones come out

Edit:
- `config/model-manifest.json` (capability -> provider model/endpoint)
- Optionally `config/pipelines/topdown2d.v1.json` (stages + action sets)

Capabilities are stable contracts, e.g.
- `stylize.img2img`
- `generate.turnaround`
- `generate.frame`
- `mask.segment`

## Repo layout

- `apps/api` – Fastify API, file hosting, SSE job events
- `apps/worker` – BullMQ worker that executes pipelines
- `apps/web` – Next UI for creating jobs + viewing outputs
- `packages/core` – pipeline engine, steps, providers, storage
- `packages/shared` – schemas + shared types

## Notes

- Authentication is out of scope for the demo (add a JWT/session layer when you deploy).
