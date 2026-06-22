# NextFlow

> A visual LLM workflow builder. Drag, connect, run. Background execution streamed live to your browser — no polling, no page reloads.

NextFlow is a clone of [Galaxy.ai](https://galaxy.ai)'s workflow editor. You wire up nodes on a canvas, hit **Run**, and the graph executes as a recursive DAG of Trigger.dev tasks. Independent branches run in parallel. Each node only waits on its **direct** upstream dependencies — when a fast branch finishes, its downstream proceeds immediately without blocking on slower siblings. Every run is persisted with full per-node history.

```text
   ┌────────┐         ┌──────────┐         ┌──────────┐
   │ Canvas │ ─POST─▶ │  Next.js │ ─run──▶ │ Trigger  │
   │ React  │         │  API     │         │   .dev   │
   │  Flow  │ ◀─SSE── │  Realtime│ ◀─meta─ │  Worker  │
   └────────┘         └──────────┘         └──────────┘
       ▲                    ▲                    │
       └── pulse / status ──┘                    │
                                                 ▼
                                          ┌──────────┐
                                          │ Postgres │
                                          │  (Neon)  │
                                          └──────────┘
```

## Table of contents

- [Highlights](#highlights)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [The execution model](#the-execution-model)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [The sample workflow](#the-sample-workflow)
- [Node types](#node-types)
- [API routes](#api-routes)
- [Database schema](#database-schema)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## Highlights

- **No polling.** Every UI update — node pulses, history list, run completion — streams from Trigger.dev over SSE via `useRealtimeRunsWithTag`. There is no `setInterval` anywhere in the runtime path.
- **Direct-upstream-only DAG.** A node never waits on unrelated siblings. If `A → C` and `B → D` are independent branches, finishing `A` does not block on `B`.
- **Single-execution diamonds.** When two downstreams share an upstream (`A → B`, `A → C`), `A` runs exactly once thanks to idempotency keys (`nodeRun:${runId}:${nodeId}`).
- **Checkpointed delays.** The mandatory 30 s Crop delay uses `wait.for({ seconds: 30 })` — Trigger.dev checkpoints, so the task consumes zero compute while waiting.
- **State machine with single ownership.** Orchestrator pre-marks level-1 nodes RUNNING; node-runners own the RUNNING→SUCCESS/FAILED transition for their own work. The Zustand store dedups redundant writes so React never sees stale re-renders.
- **DB is history, not coordination.** All Trigger.dev tasks `return` their outputs to their parent. Postgres is written via lifecycle hooks (`onFailure`) and inline writes — never polled.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Auth | Clerk |
| Database | PostgreSQL (Neon) |
| ORM | Prisma 7 |
| Canvas | React Flow (`@xyflow/react` v12) |
| State | Zustand 4 |
| Background jobs | Trigger.dev v4 SDK |
| Realtime UI | `@trigger.dev/react-hooks` (SSE) |
| LLM | Google Gemini via `@google/generative-ai` |
| Image processing | Transloadit (`/image/resize` robot) |
| Validation | Zod |
| Styling | Tailwind CSS |
| Icons | Lucide React |

---

## Architecture

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                                 │
│  Next.js client + React Flow                                             │
│    • Canvas autosave (PATCH /api/workflows/[id], 1.5 s debounce)         │
│    • Click Run → POST /api/workflows/[id]/run                            │
│    • Mint Trigger.dev access token (scoped to workflow_${id})            │
│    • useRealtimeRunsWithTag(workflow_X) streams over SSE                 │
│      ─ pushes per-node metadata into the run.store                       │
│      ─ merges into history sidebar in-place                              │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  NEXT.JS API (Clerk-protected, Zod-validated)                            │
│    • workflows CRUD                                                      │
│    • POST /run → triggers workflowExecutorTask with                      │
│      tags [workflow_${id}, run_${dbRunId}] at trigger time               │
│    • GET /realtime-token → auth.createPublicToken (1 h, tag-scoped)      │
│    • Transloadit assembly signing (secret never leaves server)           │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  TRIGGER.DEV WORKER (v4)                                                 │
│                                                                          │
│  workflowExecutorTask  (orchestrator, thin)                              │
│    ├─ Resolve Request-Inputs locally (no Trigger task)                   │
│    ├─ Pre-mark every level-1 executable RUNNING in metadata at T=0       │
│    ├─ batchTriggerAndWait nodeRunnerTask for SINK executables only       │
│    │     (idempotencyKey: nodeRun:${runId}:${nodeId})                    │
│    │     Sinks recurse into their direct upstreams — strict parent-child │
│    │     chains avoid sibling-trigger races on metadata propagation      │
│    ├─ Resolve Response nodes locally                                     │
│    └─ Finalize Run.status = SUCCESS | PARTIAL | FAILED                   │
│                                                                          │
│  nodeRunnerTask  (per executable node, recursive)                        │
│    ├─ For each direct upstream:                                          │
│    │     • Request-Inputs → pull from payload                            │
│    │     • Executable → batchTriggerAndWait with same idempotency key    │
│    │       (dedups to the existing run from the orchestrator's batch)   │
│    ├─ markRunning (DB) + metaSetRunning (root metadata)                  │
│    ├─ Dispatch by kind:                                                  │
│    │     • CROP_IMAGE  → runCropImage   (wait.for 30 s + Transloadit)    │
│    │     • GEMINI      → runGemini      (image fetch + generateContent)  │
│    ├─ markSuccess + metaSetSuccess                                       │
│    └─ Return outputData (consumed by parent's batchTriggerAndWait)       │
│                                                                          │
│  onFailure hook → markFailedByNode + metaSetFailed                       │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  POSTGRES (Neon)                                                         │
│  Workflow ─┐                                                             │
│       └─ Run ─┐                                                          │
│            └─ NodeRun  (per-node status / I/O / timing / error)          │
│  DB is the history-of-record. Coordination happens in Trigger.dev,       │
│  not in the database.                                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### Why recursive instead of wave-based?

A wave-based topological executor stalls fast branches behind slow siblings. If `A` finishes in 5 s but its wave-mate `B` takes 30 s, `A`'s downstream `C` can't start until the whole wave clears.

With recursive node-runners, each node only `batchTriggerAndWait`s on its **direct** upstreams. `C` proceeds the instant `A` is done. Idempotency keys keep diamond DAGs honest — shared upstreams still run exactly once.

### Why Realtime instead of polling?

Polling burns Vercel function invocations and creates the wrong abstraction — the source of truth is Trigger.dev, and it already streams state. `useRealtimeRunsWithTag` opens a single SSE connection per workflow; node pulses, run completion, and history updates all flow from one channel.

---

## The execution model

The mandatory execution semantics, with the sample workflow:

```text
                            ┌─────────────┐         ┌─────────────┐
                            │  Gemini #1  │ ──text─▶│  Gemini #2  │
                            │ (copywriter)│         │   (tweet)   │
                            └─────▲───────┘         └──────┬──────┘
                                  │                        │ text
┌─────────────────┐               │                        │
│  Request Inputs │ ──text────────┘                        │
│  • text         │                                        ▼
│  • image (URL)  │     ┌────────────────┐         ┌───────────────┐    ┌──────────┐
│                 │ ───▶│   Crop #1      │ ──image▶│ Final Gemini  │ ──▶│ Response │
│                 │     │  (20/20/60/60) │         │  (final post) │    └──────────┘
│                 │     └────────────────┘         │               │
│                 │     ┌────────────────┐         │               │
│                 │ ───▶│   Crop #2      │ ──image▶│               │
│                 │     │  (0/0/100/50)  │         │               │
│                 │     └────────────────┘         └───────────────┘
└─────────────────┘
```

### The contract

1. **Crop #1, Crop #2, Gemini #1** all start at T = 0 (same DAG level → concurrent fan-out).
2. **Gemini #2** starts the instant Gemini #1 finishes — it must not wait for the Crops.
3. **Final Gemini** starts only when all of its upstream dependencies (both Crops + Gemini #2) have completed.
4. **Single-node and multi-select** runs execute only the targeted nodes plus their transitive upstream ancestors.

All four are guaranteed by the recursive-with-idempotency model.

---

## Quick start

You need three terminals and five external accounts. Every external service has a free tier sufficient for this project.

### Prerequisites

| Tool | Version | Where |
| --- | --- | --- |
| Node.js | ≥ 18 | nodejs.org |
| Postgres | — | [neon.tech](https://neon.tech) |
| Clerk | — | [clerk.com](https://clerk.com) |
| Trigger.dev | — | [cloud.trigger.dev](https://cloud.trigger.dev) |
| Google AI Studio | — | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| Transloadit | — | [transloadit.com](https://transloadit.com) |

### Setup

```bash
git clone https://github.com/gaurav-mehta19/nextflow
cd nextflow
npm install
cp .env.example .env
# Fill in every value — see "Environment variables" below

npx prisma generate
npx prisma db push
```

### Three terminals to run everything

```bash
# Terminal 1 — Next.js
npm run dev

# Terminal 2 — Trigger.dev worker  (required; nothing executes without it)
npm run trigger:dev

# Terminal 3 — optional: Prisma Studio
npx prisma studio
```

You should see the Trigger.dev worker register exactly **two tasks**: `workflow-executor` and `node-runner`. Keep that terminal open — closing it means runs stay stuck in `RUNNING`.

### First run

1. Open `http://localhost:3000` — Clerk redirects to `/sign-in`.
2. Sign up with an email.
3. On the dashboard, click **✨ Sample Workflow**. The marketing pipeline is pre-built.
4. Hit **Run**. The canvas streams live updates over SSE — Crop #1, Crop #2, and Gemini #1 pulse together at T=0.
5. After ~50 s the final Gemini emits a marketing post with both cropped images embedded inline.
6. Expand any row in the history sidebar to inspect per-node inputs, outputs, and timings.

---

## Environment variables

Copy `.env.example` to `.env` and populate every key:

```ini
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Postgres (Neon pooled URL)
DATABASE_URL=postgresql://user:pass@host-pooler.region.aws.neon.tech/db?sslmode=require

# Trigger.dev (cloud.trigger.dev → API Keys)
TRIGGER_SECRET_KEY=tr_dev_...

# Gemini
GOOGLE_AI_API_KEY=AI...

# Transloadit
TRANSLOADIT_KEY=
TRANSLOADIT_SECRET=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Build attribution (one console.log per page render)
NEXT_PUBLIC_CANDIDATE_LINKEDIN=https://www.linkedin.com/in/your-handle
```

You also need to set the **Trigger.dev project ref** in `trigger.config.ts` (line 4). Copy the `proj_xxx` value from the Trigger.dev dashboard after you create a project.

---

## The sample workflow

Clicking **✨ Sample Workflow** on the dashboard pre-builds the marketing pipeline shown in [The execution model](#the-execution-model). The image URL is pre-filled with a stock product shot from Unsplash; the text input describes a wireless headphones product.

The mandatory 30 s Crop delay (per assignment spec) uses `await wait.for({ seconds: 30 })`. Because Trigger.dev checkpoints any wait over 5 s, both the orchestrator and the Crop tasks consume **zero compute** during the wait — only the actual Transloadit call costs anything.

---

## Node types

### Request Inputs *(pre-placed, not deletable, local-only)*

A single node holding user-supplied inputs. Each field has a unique UUID, label, type (`text_field` / `number_field` / `image_field` / `video_field` / `audio_field` / `file_field`), and an optional value.

- Text fields render as textareas.
- Number fields render as numeric inputs with a pink output handle — connect one to a Crop axis to drive it remotely.
- Media fields show a Transloadit-signed upload button.
- Handle IDs encode the field type (`image_field-<uuid>`, `number_field-<uuid>`) so drag validation works via the centralized `inferHandleType()` helper.

### Crop Image *(added via + picker — Trigger.dev task)*

Crops the input image to a rectangle defined by four percentage sliders (X / Y / Width / Height, 0-100).

- **Inputs:** `input-image` (blue, required) + `input-x-number` / `input-y-number` / `input-w-number` / `input-h-number` (pink) — connect a number field to drive an axis remotely.
- **Output:** `output-image` (public ssl_url from Transloadit).
- **Backend:** `src/lib/trigger/handlers/crop-image.ts`. Signs a Transloadit assembly, uses `wait.for({ seconds: 30 })` for the mandatory delay, then `wait.for({ seconds: 2 })` between assembly status polls.

### Gemini *(added via + picker — Trigger.dev task)*

Calls Gemini's `generateContent` with optional multimodal inputs.

- **Inputs:** `prompt` (required), `system-prompt`, `image-vision` (accepts multiple connections).
- **Output:** `response` (text).
- Inline upload buttons appear for any media input not wired via handle.
- When Gemini writes `(Image 1)` / `(Image 2)`, those references are replaced inline with the actual upstream images in the rendered response card (via `tokenizeWithImages`).

### Response *(pre-placed, not deletable, local-only)*

Captures the final workflow output. **Not a Trigger.dev task** — resolved in the orchestrator after the upstream node-runners finish.

- Inherits `imageUrls` from its upstream so the final card can render the marketing post with images inline.
- Single `result` target handle. No output handle (terminator).

### Sticky Note

A yellow free-form annotation. **Not part of the DAG** — filtered out before runs.

---

## API routes

All routes are Clerk-protected and user-scoped. Mutations validate input with Zod.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/workflows` | List user workflows with last-run status |
| POST | `/api/workflows` | Create a new (empty) workflow |
| GET | `/api/workflows/[id]` | Get one workflow with nodes/edges |
| PATCH | `/api/workflows/[id]` | Update name / nodes / edges (autosave) |
| DELETE | `/api/workflows/[id]` | Delete workflow (cascades to runs) |
| POST | `/api/workflows/[id]/run` | Trigger executor with tags |
| GET | `/api/workflows/[id]/runs` | Historical runs snapshot |
| GET | `/api/workflows/[id]/realtime-token` | Mint scoped Trigger.dev access token |
| GET | `/api/workflows/[id]/export` | Download workflow as JSON |
| POST | `/api/workflows/import` | Import workflow from JSON |
| GET | `/api/runs/[runId]` | Get one run with its node runs |
| POST | `/api/transloadit/sign` | Server-sign a Transloadit assembly |

---

## Database schema

```prisma
model Workflow {
  id        String   @id @default(cuid())
  userId    String
  name      String   @default("New Workflow")
  nodes     Json
  edges     Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  runs      Run[]
}

model Run {
  id         String    @id @default(cuid())
  workflowId String
  workflow   Workflow  @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  status     RunStatus @default(RUNNING)
  scope      RunScope  @default(FULL)
  startedAt  DateTime  @default(now())
  finishedAt DateTime?
  nodeRuns   NodeRun[]
}

model NodeRun {
  id         String        @id @default(cuid())
  runId      String
  run        Run           @relation(fields: [runId], references: [id], onDelete: Cascade)
  nodeId     String
  nodeType   String
  status     NodeRunStatus @default(PENDING)
  inputData  Json?
  outputData Json?
  startedAt  DateTime?
  finishedAt DateTime?
  errorMsg   String?
}

enum RunStatus     { RUNNING SUCCESS FAILED PARTIAL }
enum RunScope      { FULL PARTIAL SINGLE }
enum NodeRunStatus { PENDING RUNNING SUCCESS FAILED }
```

---

## Project structure

```text
nextflow/
├── prisma/
│   └── schema.prisma
├── public/
│   └── sample-headphones.jpg
└── src/
    ├── app/
    │   ├── (auth)/                          — sign-in + sign-up (Clerk)
    │   ├── (protected)/
    │   │   ├── dashboard/                   — workflow list
    │   │   └── workflows/[id]/canvas/       — editor (mounts RealtimeRunListener)
    │   ├── api/
    │   │   ├── workflows/
    │   │   │   ├── route.ts                 — list / create
    │   │   │   ├── import/                  — import-from-JSON
    │   │   │   └── [id]/
    │   │   │       ├── route.ts             — get / patch / delete
    │   │   │       ├── run/                 — POST: trigger with tags
    │   │   │       ├── runs/                — GET: historical snapshot
    │   │   │       ├── realtime-token/      — GET: scoped public access token
    │   │   │       └── export/              — GET: download as JSON
    │   │   ├── runs/[runId]/
    │   │   └── transloadit/sign/
    │   └── layout.tsx                       — root (ClerkProvider + NextFlowAttribution)
    │
    ├── components/
    │   ├── sidebar/Sidebar.tsx
    │   ├── canvas/
    │   │   ├── nodes/                       — RequestInputs / CropImage / Gemini / Response / StickyNote
    │   │   ├── edges/AnimatedEdge.tsx
    │   │   ├── handles/TypedHandle.tsx
    │   │   ├── WorkflowCanvas.tsx
    │   │   ├── CanvasToolbar.tsx
    │   │   ├── CanvasBottomBar.tsx
    │   │   ├── MiniMapPanel.tsx
    │   │   ├── NodePicker.tsx
    │   │   └── ResponseWithImages.tsx
    │   ├── dashboard/                       — WorkflowCard / WorkflowPreview / CreateWorkflowButton
    │   ├── history/
    │   │   ├── HistoryPanel.tsx             — SSE-driven, merges realtime into list in-place
    │   │   ├── RunRow.tsx
    │   │   └── merge-realtime.ts            — pure merger (testable)
    │   ├── realtime/
    │   │   ├── useRealtimeToken.ts          — fetches per-workflow public access token
    │   │   └── RealtimeRunListener.tsx      — pipes per-node metadata into run.store
    │   ├── ui/                              — Button / Badge / Modal / Input / Spinner
    │   └── NextFlowAttribution.tsx          — per-page LinkedIn console.log
    │
    ├── lib/
    │   ├── dag/                             — topological-sort + auto-arrange
    │   ├── db/client.ts
    │   ├── store/                           — Zustand (canvas / run / sidebar)
    │   ├── trigger/                         — pure helpers used by Trigger.dev tasks
    │   │   ├── tags.ts                      — workflowTag / runTag / nodeTag / kindTag
    │   │   ├── db-hooks.ts                  — NodeRun + Run Prisma writers
    │   │   ├── metadata-keys.ts             — metaSetRunning / Success / Failed
    │   │   └── handlers/
    │   │       ├── types.ts
    │   │       ├── input-resolver.ts        — directUpstreamIds, hasNoExecutableUpstream
    │   │       ├── crop-image.ts            — runCropImage (wait.for 30 s + Transloadit)
    │   │       ├── gemini.ts                — runGemini
    │   │       └── dispatch.ts              — kind → handler
    │   ├── types/                           — NodeKind / HandleType / NodeData
    │   ├── utils/                           — time / tokenize-with-images
    │   ├── validations/                     — Zod schemas
    │   ├── sample-workflow.ts
    │   └── transloadit-upload.ts
    │
    ├── trigger/
    │   ├── index.ts                         — exports both tasks
    │   └── tasks/
    │       ├── workflow-executor.task.ts    — thin orchestrator
    │       └── node-runner.task.ts          — per-node recursive runner
    │
    └── middleware.ts                        — Clerk auth
```

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Runs stay in `RUNNING` forever | Trigger.dev worker not running | Start `npm run trigger:dev` in a second terminal |
| Canvas pulses are static or only update on reload | Trigger code changed but worker not restarted | The Trigger.dev dev CLI does **not** hot-reload task code. Restart `npm run trigger:dev` after editing anything under `src/trigger/` or `src/lib/trigger/` |
| `403 Forbidden` on `api.trigger.dev/realtime/v1/runs` | Token tag scope mismatch | Token is scoped to `workflow_${id}`; the subscription must query the same tag. Filter by `run_${dbId}` client-side using each run's `tags` array — already implemented in `RealtimeRunListener.tsx` |
| `gemini-3.1-pro is not found` | Free-tier alias confusion | The alias map in `gemini.ts` rewrites `gemini-3.1-pro` → `gemini-2.5-pro` |
| `Crop Image requires an input image URL` | Image field empty in Request-Inputs | Click the upload box and pick an image. The sample workflow ships with one pre-filled |
| `Project not found: proj_xxx` from Trigger.dev CLI | `trigger.config.ts` ref doesn't match account | Copy the correct `proj_xxx` from cloud.trigger.dev and update line 4 |
| Gemini returns `503 high demand` | Free-tier throttle | Trigger.dev auto-retries up to 4× with exponential backoff. If it keeps failing, switch to `gemini-2.5-flash` in the node settings |

---
