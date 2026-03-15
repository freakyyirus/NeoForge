# NeoForge

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=for-the-badge&logo=postgresql)

A browser-based IDE with AI that actually writes code for you — not just suggests it.

</div>

---

## What is this?

NeoForge is a full-stack IDE that runs entirely in the browser. You describe what you want to build, and the AI writes the files directly into the editor. No copy-pasting. No "click Apply". It just works like Lovable or Replit — except you own the whole thing.

Built for developers who want a faster inner loop: idea → code → running app, without leaving the browser.

---

## Mapping Cross-Language Dependencies in Polyglot Codebases

Most real projects aren't written in one language. You might have a TypeScript frontend, a Python API, a Go service, and a Rust WASM module — all talking to each other through REST, gRPC, or shared schemas. The problem is that no single tool understands the full picture.

NeoForge ships a **Polyglot Dependency Intelligence Engine** — a deterministic, AST-driven system that maps cross-language dependencies without relying on an LLM to guess at them.

**How it works:**

It uses [tree-sitter](https://tree-sitter.github.io) to parse TypeScript, Go, and Python source files into concrete syntax trees, then extracts specific nodes — `fetch`/axios calls, Express and Gin route definitions, exported types and structs, Prisma models, and SQL `CREATE TABLE` statements. From those nodes it builds a directed dependency graph in memory, inferring edges by matching URL patterns across languages (so a `fetch("/api/users")` in TypeScript gets linked to `router.GET("/api/users", ...)` in Go), linking route handlers to the types they use, and wiring Prisma models to their SQL table counterparts.

**What you can do with it:**

- `POST /api/dependencies/graph` — returns the full directed dependency graph in a format ready for D3.js force-directed rendering
- `POST /api/dependencies/impact` — give it any node ID (a file path, a route, a type) and it runs a BFS traversal to return every upstream and downstream component that would break if that node changes — the "blast radius"

In the IDE graph panel, you can switch between:

- **FULL** mode: raw dependency graph (keeps cycles visible)
- **DAG** mode: cycle-collapsed graph (strongly connected components are merged into super-nodes)

DAG mode also shows which files were collapsed into each cycle node in hover and selection details.

This is all static analysis. No AI involved in the graph construction — the edges are structural, not guessed.

**Implementation:**

```
lib/dependency-engine/
  types.ts        — DependencyNode, DependencyEdge, DependencyGraph, ImpactResult
  ast-parser.ts   — tree-sitter setup + per-language extractors
  dag.ts          — DAG class, edge inference, BFS impact traversal, D3 output
  scanner.ts      — walks a project directory, builds and caches the DAG

app/api/dependencies/
  graph/route.ts  — POST /api/dependencies/graph
  impact/route.ts — POST /api/dependencies/impact
```

**Example — blast radius check:**

```bash
curl -X POST http://localhost:3000/api/dependencies/impact \
  -H "Content-Type: application/json" \
  -d '{ "projectRoot": "/path/to/project", "nodeId": "go:/src/handlers/users.go:struct:User" }'
```

Returns every TypeScript type, fetch call, and API route that transitively depends on that Go struct.

---

## Features

**AI that writes code directly to the editor**
Type a prompt. The AI generates files and writes them straight into your project. You see the file tree update in real time, and can preview the running app immediately after.

**In-browser execution**
The terminal and runtime run inside the browser using WebContainers. No server needed. You can `npm install`, run dev servers, and see live output — all locally.

**GitHub integration**
Connect a repo and NeoForge will pull it in, let you edit, and push back. It also runs automated AI code reviews on PRs with real line-level feedback.

**Multi-model AI**
Switch between Claude, Gemini, and OpenRouter models. The chat, code generation, and review features all use the same model selection.

**Semantic code search**
Repos get indexed into Pinecone so you can search by meaning, not just text. Useful for asking "where do we handle auth errors?" across a large codebase.

**Interactive dependency graph (FULL + DAG)**
Visualize cross-language dependencies with curved wire links between nodes, smooth zoom controls, and instant tab switching in the IDE panel. Toggle to DAG mode to collapse cycles and inspect grouped files per cycle node.

---

## Architecture

```
╔══════════════════════════════════════════════════════════════════════════╗
║                          USER'S BROWSER                                  ║
║                                                                          ║
║  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  ║
║  │   AI Chat   │  │ Code Editor  │  │   Terminal   │  │   Preview   │  ║
║  │  (prompts,  │  │ (CodeMirror) │  │  (xterm.js)  │  │  (iframe /  │  ║
║  │   replies)  │  │              │  │              │  │  dev server)│  ║
║  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  └─────────────┘  ║
║         │                │                 │                             ║
║         └────────────────┴──────────┬──────┘                            ║
║                                     │                                    ║
║              ┌──────────────────────▼──────────────────────┐            ║
║              │           Next.js App Router                 │            ║
║              │        app/(ide)/[projectId]/page.tsx        │            ║
║              └──────────────────────┬───────────────────────┘            ║
║                                     │                                    ║
║              ┌──────────────────────▼──────────────────────┐            ║
║              │              WebContainer API                │            ║
║              │   Node.js runtime running inside the tab     │            ║
║              │   npm install · dev servers · file I/O       │            ║
║              └─────────────────────────────────────────────┘            ║
╚══════════════════════════════════════════════════════════════════════════╝
                                     │
                      HTTPS  (API routes)
                                     │
╔══════════════════════════════════════════════════════════════════════════╗
║                         NEXT.JS SERVER                                   ║
║                                                                          ║
║   /api/ai/chat ──────────────────────────────► AI Provider               ║
║   /api/ai/edit                                  Claude · Gemini           ║
║   /api/ai/complete                              OpenRouter                ║
║                                                                          ║
║   /api/github/repos ─────────────────────────► GitHub API                ║
║   /api/github/webhook                           (repos, PRs, commits)    ║
║                                                                          ║
║   /api/reviews ──────────────────────────────► Inngest                   ║
║                                                 (background jobs:        ║
║                                                  review generation,      ║
║                                                  repo indexing)          ║
║                                                                          ║
║   /api/pinecone/index ────────────────────────► Pinecone                 ║
║   /api/pinecone/search                          (vector search over      ║
║                                                  indexed codebase)       ║
║                                                                          ║
║   /api/auth/* ───────────────────────────────► Better Auth               ║
║                                                 GitHub OAuth 2.0         ║
╚══════════════════════════════════════════════════════════════════════════╝
                          │                    │
            ┌─────────────▼──────┐   ┌─────────▼──────────┐
            │    PostgreSQL       │   │      Convex         │
            │    (via Prisma)     │   │   (real-time sync)  │
            │                    │   │                     │
            │  User              │   │  files              │
            │  Repository        │   │  projects           │
            │  Review            │   │  chatMessages       │
            │  Subscription      │   │  terminals          │
            └────────────────────┘   └─────────────────────┘
```

**How a request flows:**

1. User types a prompt in AI Chat
2. The IDE page sends it to `/api/ai/chat` with file context
3. Server calls the AI model (Claude/Gemini/OpenRouter) — keys never leave the server
4. Response comes back as a structured file diff
5. Files are written directly into the editor and synced to Convex
6. WebContainer picks up the changes and hot-reloads the preview in the same tab

Everything that runs code — the terminal, the dev server, `npm install` — happens inside the WebContainer in the browser. No remote VM, no SSH, no round trips for execution.

---

## Tech Stack

- **Next.js 16** (App Router) + React 19
- **CodeMirror 6** for the editor
- **xterm.js** for the terminal
- **WebContainer API** for in-browser Node.js execution
- **Convex** for real-time file/project state
- **PostgreSQL** via Prisma for users, repos, reviews
- **Pinecone** for vector search
- **Better Auth** for GitHub OAuth
- **Inngest** for background jobs (indexing, review generation)
- **Claude / Gemini / OpenRouter** for AI

---

## Getting Started

You'll need Node 18+, PostgreSQL, and API keys for GitHub OAuth and at least one AI provider.

```bash
git clone https://github.com/yourusername/neoforge.git
cd neoforge
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/neoforge"
BETTER_AUTH_SECRET="any-long-random-string"
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
ANTHROPIC_API_KEY="..."        # or GOOGLE_GEMINI_API_KEY / OPENROUTER_API_KEY
PINECONE_API_KEY="..."
NEXT_PUBLIC_CONVEX_URL="..."
INNGEST_EVENT_KEY="..."
INNGEST_SIGNING_KEY="..."
```

Then:

```bash
npx prisma generate
npx prisma db push
npm run dev
```

App runs at `http://localhost:3000`. For GitHub OAuth to work locally, set the callback URL in your GitHub OAuth app to `http://localhost:3000/api/auth/callback/github`.

---

## Project Structure

```
app/
  (ide)/[projectId]/   — the actual IDE page
  api/ai/              — chat, completion, edit endpoints
  api/github/          — repo sync, webhooks, reviews
  api/pinecone/        — index + search
  dashboard/           — repo list, review history, settings
components/
  ai-chat/             — the AI chat panel
  editor/              — CodeMirror wrapper
  terminal/            — xterm.js terminal
  file-explorer/       — file tree
lib/
  ai.ts                — AI provider abstraction
  github.ts            — GitHub API helpers
  pinecone.ts          — vector store helpers
prisma/schema.prisma   — User, Repo, Review, Subscription models
convex/schema.ts       — real-time files, projects, chat
```

---

## API Routes

| Route | What it does |
|---|---|
| `POST /api/ai/chat` | AI chat with project context |
| `POST /api/ai/edit` | Apply an AI edit to a file |
| `GET /api/github/repos` | List connected repos |
| `POST /api/github/webhook` | Handle GitHub events |
| `POST /api/webcontainer/start` | Boot a WebContainer session |
| `POST /api/webcontainer/exec` | Run a command in it |
| `POST /api/pinecone/index` | Index a repo |
| `POST /api/pinecone/search` | Semantic search |
| `GET/POST /api/reviews` | List or create code reviews |

---

## License

MIT. Do whatever you want with it.


