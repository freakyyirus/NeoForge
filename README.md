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

NeoForge tackles this by building a dependency graph that spans all languages in the repo:

- Parses `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, etc. and merges them into one unified graph
- Traces calls across language boundaries — e.g. if your TypeScript client calls a Python endpoint, that edge shows up
- When you change a shared interface or schema, it flags every downstream consumer across every language, not just the ones in the same file
- Code review context includes the full call chain, so if a Python type changes, the reviewer knows whether it breaks the TypeScript side too
- Visual graph view of all cross-language connections, filterable by language, service, or module

This is especially useful in monorepos and microservice setups where keeping track of "what calls what" across stacks is a constant headache.

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

---

## Architecture

```
 Browser
 ┌─────────────────────────────────────────────────┐
 │  IDE Page                                        │
 │  ┌──────────┐  ┌────────┐  ┌──────┐  ┌───────┐ │
 │  │ AI Chat  │  │ Editor │  │ Term │  │Preview│ │
 │  └────┬─────┘  └───┬────┘  └──┬───┘  └───┬───┘ │
 │       └────────────┴──────────┴───────────┘     │
 │                     │  Next.js App Router        │
 └─────────────────────┼───────────────────────────┘
                       │
          ┌────────────┼─────────────┐
          │            │             │
    API Routes      Convex        WebContainer
    /api/ai/*    (real-time      (runs Node.js
    /api/github   file state)     in browser)
    /api/reviews
          │
    ┌─────┴──────┐
    │            │
 AI Models    PostgreSQL
 Claude /     (users, repos,
 Gemini /      reviews)
 OpenRouter
          │
       Pinecone
    (code search)
```

The browser talks directly to Next.js API routes. The editor and file state live in Convex so everything stays in sync. The terminal and dev server run inside a WebContainer — no remote VM, no round trips. AI calls go server-side so API keys never touch the client.

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

