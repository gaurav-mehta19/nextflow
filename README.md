# NextFlow

> A visual LLM workflow builder. Drag, connect, and run multi-step AI pipelines with image vision, image processing, and LLM chaining — all backed by durable background execution.

NextFlow is a clone of the [Galaxy.ai](https://galaxy.ai) workflow builder. You wire together nodes on a canvas, hit **Run**, and the workflow executes as a DAG of background tasks. Independent branches run in parallel; dependent steps wait for their inputs. Every run is persisted with full per-node input/output/error history.

The reference workflow (pre-built when you create a new workflow): take a product description + a product image → make two crops of the image → write a copy paragraph → condense it into a tweet → combine the tweet and the two crops into a final Instagram-ready marketing post.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [The sample workflow](#the-sample-workflow)
- [How a run works](#how-a-run-works)
- [Node types](#node-types)
- [API routes](#api-routes)
- [Database schema](#database-schema)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Features

| Area | What it does |
|---|---|
| **Canvas** | React Flow with dot grid, pan, zoom, fit-view, collapsible bottom-left controls, collapsible bottom-right minimap, bottom-center `+` node picker |
| **Nodes** | 4 node types — Request Inputs, Crop Image, Gemini 2.5 Pro, Response. Premium card design with gradient headers, animated purple pulse while running, calm purple ring when selected |
| **Edges** | Bezier curves colored by source-handle type (text = orange, image = blue, video = purple, audio = green, file = gray), with type-safe drop validation and DAG cycle prevention |
| **Picker** | Bottom-center `+` opens a searchable picker with categories (Recent, Image, Video, Audio, Others) — like Galaxy.ai |
| **History** | Right sidebar lists every run with status, duration, scope. Click to expand into per-node details: inputs, outputs, errors, exact start/finish times |
| **Selection** | Shift-click or lasso-select multiple nodes. A `Run selected (N)` button appears in the header and runs only the selected subgraph (plus required upstream ancestors) |
| **Undo / Redo** | Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z work everywhere — covers add, delete, drag (after release), and connect |
| **Auto-save** | Every canvas change autosaves to PostgreSQL after a 1.5 s debounce. No save button |
| **Export / Import** | Workflows can be exported as JSON from the dashboard card and re-imported via the dashboard's Import button |
| **Auth** | Clerk-protected routes. Every workflow + run is scoped to the signed-in user |
| **Inline images in responses** | When Gemini writes "(Image 1)" / "(Image 2)" in its output, NextFlow replaces those references with the actual cropped images — your final response card looks like a real marketing post |
| **Transloadit signed uploads** | Browser uploads files directly to Transloadit using a server-signed assembly — secret never touches the client |
| **Real-time UI** | Nodes pulse purple while running; status flips to green/red the instant the worker finishes |

---

## Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js 14** (App Router) | Server components, API routes, middleware, file-based routing |
| Language | **TypeScript** (strict) | Full type safety end-to-end |
| Auth | **Clerk** | Drop-in auth with middleware route protection |
| DB | **PostgreSQL via Neon** | Serverless Postgres with pooled connections |
| ORM | **Prisma 7** | Type-safe queries, schema migrations, generated client |
| Canvas | **React Flow (`@xyflow/react`) 12** | Industry-standard node-based editor with handles, pan, zoom, minimap |
| State | **Zustand 4** | Lightweight client state for the canvas and active run |
| Background jobs | **Trigger.dev v3 SDK** | Durable async execution of workflow tasks; survives serverless function timeouts |
| LLM | **Google Gemini 2.5 Pro** via `@google/generative-ai` | Multimodal model with native image vision |
| Image processing | **Transloadit** (`/image/resize` robot via FFmpeg) | Cloud image crop with public URL outputs |
| Validation | **Zod** | Runtime payload validation on all API mutations |
| Styling | **Tailwind CSS** | Utility-first |
| Icons | **Lucide React** | Consistent line-icon set |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser (Next.js client + React Flow)                           │
│  - Edit canvas, autosave nodes/edges via PATCH                   │
│  - Click Run → POST /api/workflows/:id/run                       │
│  - Poll /api/runs/:id every 2 s while a run is active            │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Next.js API routes (Clerk-protected, Zod-validated)             │
│  - workflows CRUD, runs CRUD                                      │
│  - Triggers workflowExecutorTask and returns the runId           │
│  - Signs Transloadit assemblies (secret never leaves the server) │
└────────────────────────────┬─────────────────────────────────────┘
                             │  triggerAndWait
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Trigger.dev v3 worker (long-lived, separate process)            │
│                                                                  │
│  workflowExecutorTask                                            │
│    └─ topological sort → for each DAG level:                    │
│        ├─ resolve inputs from upstream nodeOutputs               │
│        ├─ batchTriggerAndWait( cropImageTask[] )                 │
│        ├─ batchTriggerAndWait( geminiTask[] )                    │
│        └─ persist per-node status + output to Postgres           │
│                                                                  │
│  cropImageTask                                                   │
│    ├─ 30 s mandatory artificial delay                            │
│    ├─ Sign + POST assembly to Transloadit /image/resize         │
│    └─ Poll assembly, return resulting ssl_url                    │
│                                                                  │
│  geminiTask                                                      │
│    ├─ Fetch image URLs, convert to base64 multimodal parts       │
│    └─ Call gemini.generateContent, return response text          │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  PostgreSQL (Neon)                                               │
│  Workflow (user-scoped)  ─┐                                      │
│       └─ Run              ─┐                                     │
│            └─ NodeRun (per-node status/io/timing/error)          │
└──────────────────────────────────────────────────────────────────┘
```

**Why a separate Trigger.dev worker?** Crop steps have a mandatory 30 s delay (per spec) and Gemini calls can take 15-20 s. Cumulative runs easily exceed Vercel's 60 s serverless timeout. The worker runs as a long-lived process (locally in dev, or on Trigger.dev's cloud for production), so individual node executions never block the HTTP request that started the run.

---

## Quick start

You'll need **three terminals** and **five external accounts**. Each external service has a free tier sufficient for this project.

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 18 | `nvm install 18` or download from nodejs.org |
| npm | bundled with Node | — |
| A Postgres database | — | Free Neon account at [neon.tech](https://neon.tech) |
| Clerk account | — | [clerk.com](https://clerk.com) |
| Trigger.dev account | — | [cloud.trigger.dev](https://cloud.trigger.dev) |
| Google AI Studio account | — | [aistudio.google.com](https://aistudio.google.com/app/apikey) for a Gemini API key |
| Transloadit account | — | [transloadit.com](https://transloadit.com) for image processing credentials |

### Setup

```bash
# 1. Clone
git clone https://github.com/gaurav-mehta19/nextflow
cd nextflow

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and fill in every value — see "Environment variables" below

# 4. Set up the database schema on Neon
npx prisma generate
npx prisma db push
```

### Running the dev environment

You need **three terminals**, all from the project root:

**Terminal 1 — Next.js dev server**

```bash
npm run dev
```

Browse to `http://localhost:3000`.

**Terminal 2 — Trigger.dev worker** *(required; nothing executes without it)*

```bash
npm run trigger:dev
```

This runs `npx trigger.dev@3.3.17 dev` and stays running. You should see it register three tasks: `crop-image`, `gemini-inference`, `workflow-executor`. Keep this terminal open — closing it means runs stay stuck in `RUNNING` state forever.

**Terminal 3 — optional Prisma Studio for inspecting the DB**

```bash
npx prisma studio
```

Opens at `http://localhost:5555`. Useful for inspecting Workflow / Run / NodeRun rows directly.

### First-run flow

1. Open `http://localhost:3000` — Clerk redirects to `/sign-in`
2. Sign up (just an email is needed)
3. You land on `/dashboard` — empty list
4. Click **+ New Workflow** — the full sample marketing workflow appears on a canvas
5. Click **Run** in the top-right
6. Watch the right-side History panel: nodes pulse purple while running, turn green when done
7. After ~80 seconds the final Gemini emits a marketing post with both cropped images embedded inline at "(Image 1)" / "(Image 2)" references
8. Expand the run in the history panel to see per-node inputs, outputs, and timings

---

## Environment variables

Copy `.env.example` to `.env` and populate every key:

```ini
# Clerk — dashboard.clerk.com, "API Keys" page
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# PostgreSQL — Neon connection pooler URL (NOT direct)
DATABASE_URL=postgresql://user:password@host-pooler.region.aws.neon.tech/db?sslmode=require

# Trigger.dev — cloud.trigger.dev, "API Keys" on the project page
TRIGGER_SECRET_KEY=tr_dev_...

# Google Gemini — aistudio.google.com/app/apikey
GOOGLE_AI_API_KEY=AI...

# Transloadit — transloadit.com/c/template-credentials/
TRANSLOADIT_KEY=
TRANSLOADIT_SECRET=

# App URL — used by the worker to fetch the sample image; must be reachable
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Build attribution (logged once per page render)
NEXT_PUBLIC_CANDIDATE_LINKEDIN=https://www.linkedin.com/in/your-handle
```

You also need to set the **Trigger.dev project ref** in `trigger.config.ts`. After you create a project in the Trigger.dev cloud dashboard, copy the `proj_xxx` ref from the "Get setup" page and replace the existing value on line 4.

---

## The sample workflow

When you click **+ New Workflow**, this graph is pre-built and saved:

```
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Gemini 2.5    │───▶│   Gemini 2.5    │
                       │   Pro #1        │    │   Pro #2        │
                       │ (copywriter)    │    │ (tweet hook)    │
                       └────────▲────────┘    └────────┬────────┘
                                │ text                  │ text
┌─────────────────┐             │                       │
│ Request Inputs  │─────────────┘                       │
│ • text_field    │                                     ▼
│ • image_field   │             ┌─────────────────┐  ┌─────────────┐  ┌────────────┐
│  (sample        │─────image──▶│  Crop Image #1  │  │ Gemini 2.5  │  │  Response  │
│   headphones    │             │ (20/20/60/60)   │──┤  Pro #3     │─▶│            │
│   pre-filled)   │             └─────────────────┘  │ (final post)│  └────────────┘
│                 │             ┌─────────────────┐  │             │
│                 │─────image──▶│  Crop Image #2  │──┤             │
│                 │             │ (0/0/100/50)    │  │             │
│                 │             └─────────────────┘  └─────────────┘
└─────────────────┘
```

**Expected execution timeline:**

| Phase | Nodes | Time |
|---|---|---|
| Level 0 | Request-Inputs (instant) | 0 s |
| Level 1 | 2 Crops (parallel batch, 30 s each in parallel) + 1 Gemini (separate batch) | ~47 s |
| Level 2 | Gemini #2 (tweet) | ~17 s |
| Level 3 | Final Gemini (multi-image vision) | ~17 s |
| Level 4 | Response (instant) | 0 s |
| **Total** | | **~80 s** |

The mandatory 30 s Crop delay is per assignment spec — Transloadit itself returns in ~5 s, but `setTimeout(30000)` enforces the lower bound to demonstrate long-running task handling.

---

## How a run works

1. **You click Run** → browser POSTs `/api/workflows/:id/run` with the current nodes, edges, and field input values
2. **API route** validates with Zod, creates a `Run` row, creates one `PENDING` `NodeRun` per node, fires `workflowExecutorTask.trigger()`, returns `runId`
3. **Browser** stores `activeRunId` in the run store and starts polling `/api/runs/:id` every 2 seconds
4. **Trigger.dev worker** picks up the executor task and:
   - Topologically sorts nodes into DAG levels
   - For each level:
     - Resolves inputs from upstream `nodeOutputs` map
     - Updates each node's `NodeRun.status = RUNNING` and `inputData`
     - Batch-triggers Crop Image tasks (parallel within the batch)
     - Batch-triggers Gemini tasks (parallel within the batch)
     - On completion, updates each `NodeRun.status = SUCCESS/FAILED` with `outputData` or `errorMsg`
5. **Browser** polls return updated `NodeRun[]`; the run store updates per-node status; nodes pulse purple → flip to green
6. **Workflow done** → executor updates `Run.status = SUCCESS / PARTIAL / FAILED`; browser stops polling

### Selective execution

When you Shift-click multiple nodes, the **Run selected (N)** button appears. Clicking it computes the **upstream ancestors** of the selection (so dependencies still resolve) and only sends that subgraph to the executor with `scope = 'single'` (1 node) or `'partial'` (2+).

---

## Node types

### Request Inputs *(pre-placed, not deletable)*

A single node that holds user-supplied inputs. Each input is a "field" with a unique ID, a label, a type (`text_field` / `image_field` / `video_field` / `audio_field` / `file_field`), and an optional value.

- Text fields render as textareas
- Media fields show a Transloadit-signed upload button
- Each field exposes its own output handle (typed) so it can be wired to multiple downstream nodes
- The handle ID encodes the field type (e.g. `image_field-1700000000`) so type-safe drag validation works

### Crop Image *(added via + picker)*

Crops the input image to a rectangle defined by 4 percentage sliders (`X`, `Y`, `Width`, `Height` — 0-100, defaults `0/0/100/100`).

- Input: `input-image` (required)
- Output: `output-image` (public ssl_url from Transloadit)
- Backend: signs a Transloadit assembly with `/http/import` then `/image/resize` using `x1/y1/x2/y2` corner coordinates
- 30+ second mandatory artificial delay before returning (spec requirement)

### Gemini 2.5 Pro *(added via + picker — LLM)*

Calls Gemini's `generateContent` with optional multimodal inputs.

- Inputs: `prompt` (required), `system-prompt`, `image-vision` (accepts multiple connections), `video`, `audio`, `file`
- Output: `response` (text)
- Inline upload buttons for any media input not wired via handle (Transloadit-signed)
- Settings: temperature slider, max tokens
- Inline response area shows the generated text; when Gemini writes `(Image 1)` / `(Image 2)`, those references are replaced with the actual upstream images via the `tokenizeWithImages` renderer

### Response *(pre-placed, not deletable)*

Captures the final workflow output for display/export. Single `result` target handle.

- Inherits any `imageUrls` from its upstream, so the final card can render the marketing post with images inline
- No output handle (it's a terminator)

---

## API routes

All routes are Clerk-protected and user-scoped. Mutations validate input with Zod.

| Method | Path | Body schema | Purpose |
|---|---|---|---|
| `GET`    | `/api/workflows`                  | — | List user workflows (with last run status + nodes for previews) |
| `POST`   | `/api/workflows`                  | `CreateWorkflowSchema` | Create a new (empty) workflow |
| `GET`    | `/api/workflows/[id]`             | — | Get one workflow with nodes/edges |
| `PATCH`  | `/api/workflows/[id]`             | `UpdateWorkflowSchema` | Update name / nodes / edges (used by autosave) |
| `DELETE` | `/api/workflows/[id]`             | — | Delete workflow (cascades to runs and node runs) |
| `POST`   | `/api/workflows/[id]/run`         | `RunWorkflowSchema` | Trigger the workflow executor task |
| `GET`    | `/api/workflows/[id]/runs`        | — | List all runs for a workflow (with their node runs) |
| `GET`    | `/api/workflows/[id]/export`      | — | Download workflow as JSON |
| `POST`   | `/api/workflows/import`           | `ImportWorkflowSchema` | Import workflow from JSON |
| `GET`    | `/api/runs/[runId]`               | — | Get one run with its node runs (used by polling) |
| `POST`   | `/api/transloadit/sign`           | — | Server-signs a Transloadit assembly so the browser can upload directly |

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

enum RunStatus       { RUNNING SUCCESS FAILED PARTIAL }
enum RunScope        { FULL    PARTIAL SINGLE }
enum NodeRunStatus   { PENDING RUNNING SUCCESS FAILED }
```

Cascade deletes mean removing a Workflow also removes all its Runs and NodeRuns automatically.

---

## Project structure

```
nextflow/
├── prisma/
│   └── schema.prisma                  # Database models
├── public/
│   └── sample-headphones.jpg          # Pre-filled image for the sample workflow
├── src/
│   ├── app/
│   │   ├── (auth)/                    # Sign-in + sign-up pages (Clerk)
│   │   ├── (protected)/
│   │   │   ├── dashboard/             # Workflow list page
│   │   │   └── workflows/[id]/canvas/ # Workflow editor
│   │   ├── api/
│   │   │   ├── runs/[runId]/
│   │   │   ├── transloadit/sign/
│   │   │   └── workflows/...          # CRUD + run + import + export
│   │   ├── globals.css                # Tailwind + global polish
│   │   ├── icon.svg                   # Favicon (auto-served by Next.js)
│   │   ├── apple-icon.svg
│   │   ├── layout.tsx                 # Root layout with ClerkProvider
│   │   └── page.tsx                   # / → redirects based on auth state
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── nodes/                 # RequestInputsNode, CropImageNode, GeminiNode, ResponseNode
│   │   │   ├── edges/AnimatedEdge.tsx
│   │   │   ├── handles/TypedHandle.tsx
│   │   │   ├── WorkflowCanvas.tsx     # ReactFlow root
│   │   │   ├── CanvasToolbar.tsx      # Bottom-left collapsible + bottom-center + button
│   │   │   ├── MiniMapPanel.tsx       # Bottom-right collapsible minimap
│   │   │   ├── NodePicker.tsx         # Searchable categorized node picker
│   │   │   └── ResponseWithImages.tsx # Renders Gemini text with inline image replacement
│   │   ├── dashboard/
│   │   │   ├── WorkflowCard.tsx       # Card with mini-map preview + actions
│   │   │   ├── WorkflowPreview.tsx    # SVG mini-map snapshot of a workflow
│   │   │   └── CreateWorkflowButton.tsx
│   │   ├── history/
│   │   │   ├── HistoryPanel.tsx       # Right sidebar
│   │   │   └── RunRow.tsx             # Expandable run row with per-node detail
│   │   ├── ui/                        # Button, Badge, Modal, Input, Spinner
│   │   └── NextFlowAttribution.tsx    # Per-page LinkedIn console.log
│   ├── lib/
│   │   ├── dag/topological-sort.ts    # DAG sort returning execution levels
│   │   ├── db/client.ts               # Prisma client singleton
│   │   ├── store/                     # Zustand stores (canvas, run)
│   │   ├── types/                     # NodeKind, HandleType, NodeData unions
│   │   ├── utils/
│   │   │   ├── time.ts                # formatDistanceToNow
│   │   │   └── tokenize-with-images.ts # Splits Gemini text on "Image N" refs
│   │   ├── validations/               # Zod schemas
│   │   ├── sample-workflow.ts         # The pre-built marketing workflow
│   │   └── transloadit-upload.ts      # Browser-side signed upload helper
│   ├── trigger/
│   │   └── tasks/
│   │       ├── crop-image.task.ts
│   │       ├── gemini.task.ts
│   │       └── workflow-executor.task.ts
│   └── middleware.ts                  # Clerk auth middleware
├── trigger.config.ts                  # Trigger.dev project + retry config
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```
---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Runs stay in `RUNNING` forever | Trigger.dev worker isn't running | Start `npm run trigger:dev` in a second terminal |
| `gemini-3.1-pro is not found` | Stale model ID in DB | The Gemini task has an alias map that rewrites it to `gemini-2.5-pro` — but for clean UI, delete the workflow and create a new one |
| `IMAGE_RESIZE_VALIDATION: The x1 crop value is missing` | Stale crop coord format | Fixed in `crop-image.task.ts` — restart the worker so the rebuild picks up |
| `INVALID_UPLOAD_HANDLE_STEP_NAME` from Transloadit | Wrong assembly step name | Fixed — the `/upload/handle` robot needs the step name `:original`, not `stored` |
| Crops fail with `Crop Image requires an input image URL` | `image_field` is empty | Click the upload box in Request Inputs and pick an image. The sample workflow now ships with one pre-filled |
| `Project not found: galaxy-ai-xxx` from Trigger.dev CLI | `trigger.config.ts` project ref doesn't match a project on the logged-in Trigger.dev account | Get the correct `proj_xxx` from cloud.trigger.dev and update line 4 |
| Polling spam in server logs | Used to be a leaky `setInterval` in HistoryPanel — fixed | Should stop automatically when the run completes |
| Gemini returns `[503] high demand` | Free-tier model is throttled by Google | Trigger.dev now retries up to 4 times with exponential backoff. If it keeps failing, switch the model dropdown to a lighter model (e.g. `gemini-2.5-flash`) |
| Favicon shows globe instead of NextFlow chip | Browser cache | Hard-refresh with Cmd+Shift+R |

---

