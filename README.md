# NeoForge 🚀

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=for-the-badge&logo=postgresql)

**The AI-Powered Browser-Based IDE for Building Full-Stack Applications**

[Features](#-features) • [Architecture](#-architecture) • [Tech Stack](#-tech-stack) • [Database Schema](#-database-schema) • [Getting Started](#-getting-started) • [API Routes](#-api-routes)

</div>

---

## ✨ Features

### 🤖 AI-Powered Development
- **Intelligent Code Generation** - Describe your idea in natural language and watch NeoForge build it
- **Multi-Model Support** - Switch between Claude, Gemini, and OpenRouter AI models
- **Auto-Compile & Preview** - Full-stack apps automatically install dependencies and start dev servers
- **Smart Code Review** - AI-powered code analysis with walkthroughs and suggestions

### 🖥️ Browser-Based IDE
- **WebContainer Execution** - Run Node.js, Python, and more directly in your browser
- **Real-Time Preview** - Live application preview with hot reload
- **File Explorer** - Complete project structure management
- **Integrated Terminal** - Command execution within the browser

### 🔗 GitHub Integration
- **Repository Sync** - Clone and sync GitHub repositories
- **Automated Reviews** - AI-powered PR reviews with detailed feedback
- **Deployment Ready** - Push and deploy directly to GitHub

### 👥 Collaboration
- **Real-Time Editing** - Multi-user collaboration with live cursors
- **Shared Terminals** - Collaborative command execution
- **Chat Integration** - Team communication within projects

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NeoForge Architecture                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Next.js 16)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │   AI Chat   │  │  Code Editor│  │   Terminal  │  │    File     │      │
│  │  Component  │  │  (CodeMirror)│  │  (xterm.js) │  │  Explorer   │      │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                   │                                           │
│                          ┌────────▼────────┐                                 │
│                          │   Next.js App   │                                 │
│                          │   Router (App)  │                                 │
│                          └────────┬────────┘                                 │
└───────────────────────────────────┼───────────────────────────────────────────┘
                                    │
┌───────────────────────────────────┼───────────────────────────────────────────┐
│                                   │           SERVER SIDE                     │
├───────────────────────────────────┼───────────────────────────────────────────┤
│                          ┌────────▼────────┐                                 │
│                          │   API Routes   │                                 │
│                          │  /api/ai/*     │                                 │
│                          │  /api/github/* │                                 │
│                          │  /api/webcont.*│                                 │
│                          └────────┬────────┘                                 │
│                                   │                                           │
│    ┌──────────────────────────────┼──────────────────────────────┐         │
│    │                              │                              │         │
│ ┌──▼──────────┐    ┌─────────────▼─────────────┐    ┌───────────▼─────┐  │
│  │  Convex    │    │      WebContainer         │    │    Pinecone     │  │
│  │ (Real-time │    │   (Browser Runtime)        │    │  (Vector Store) │  │
│  │  Database) │    │                            │    │                 │  │
│  └────────────┘    └────────────────────────────┘    └─────────────────┘  │
│                                                                             │
│    ┌────────────────┐         ┌────────────────┐                           │
│    │   Inngest      │         │  Better Auth   │                           │
│    │ (Background    │         │ (Authentication│                           │
│    │  Jobs)         │         │  & Sessions)   │                           │
│    └────────────────┘         └────────────────┘                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────┼───────────────────────────────────────────┐
│                          ┌────────▼────────┐                                 │
│                          │   PostgreSQL   │                                 │
│                          │   (Prisma ORM) │                                 │
│                          └─────────────────┘                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Components

| Component | Description | Technology |
|-----------|-------------|------------|
| **IDE Core** | Main browser-based code editor | CodeMirror 6 |
| **AI Chat** | Natural language code generation | Claude/Gemini API |
| **Runtime** | Browser-based execution environment | WebContainer API |
| **Real-time** | Live updates and collaboration | Convex |
| **Search** | Semantic code search | Pinecone |
| **Auth** | User authentication | Better Auth |
| **Database** | Persistent data storage | PostgreSQL + Prisma |

---

## 🛠️ Tech Stack

### Frontend
- **Framework** - Next.js 16 (App Router)
- **UI Library** - React 19
- **Styling** - Tailwind CSS 4
- **Code Editor** - CodeMirror 6
- **Terminal** - xterm.js
- **Icons** - Lucide React

### Backend
- **Runtime** - Node.js (WebContainer)
- **Database** - PostgreSQL (Prisma ORM)
- **Real-time** - Convex
- **Vector Search** - Pinecone
- **Authentication** - Better Auth
- **Background Jobs** - Inngest

### AI Integration
- **Claude** - Anthropic Claude API
- **Gemini** - Google Gemini API
- **OpenRouter** - Multi-provider aggregation

---

## 📊 Database Schema

### PostgreSQL (Prisma)

```prisma
// Core Models
User
├── Account          (OAuth providers)
├── Session          (Auth sessions)
├── Repository       (GitHub repos)
├── Review           (Code reviews)
└── Subscription     (Pro/Free tier)

// Repository Models
Repository
├── Review           (PR reviews)
└── IndexedFile      (Searchable files)

// Subscription Models
Subscription
└── User             (One-to-one)
```

### Convex (Real-time)

```typescript
// Tables
files          // Project files with content
projects       // Project metadata & status
collaboration // Real-time cursor positions
chatMessages   // Project chat history
terminals      // Active terminal sessions
```

### Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐
│    User      │       │  Subscription│
└──────┬───────┘       └──────┬───────┘
       │                     │
       │ 1:N                  │ 1:1
       ▼                     │
┌──────────────┐             │
│  Repository  │◄────────────┘
└──────┬───────┘
       │
       │ 1:N
       ▼
┌──────────────┐       ┌──────────────┐
│    Review    │       │  IndexedFile │
└──────────────┘       └──────────────┘
```

---

## 🚦 API Routes

### AI Endpoints
| Route | Method | Description |
|-------|--------|-------------|
| `/api/ai/chat` | POST | AI chat with context |
| `/api/ai/complete` | POST | Code completion |
| `/api/ai/edit` | POST | Code editing |

### GitHub Integration
| Route | Method | Description |
|-------|--------|-------------|
| `/api/github/repos` | GET | List user repositories |
| `/api/github/sync` | POST | Sync repository |
| `/api/github/commit` | POST | Commit changes |
| `/api/github/webhook` | POST | GitHub webhook handler |

### WebContainer
| Route | Method | Description |
|-------|--------|-------------|
| `/api/webcontainer/start` | POST | Boot WebContainer |
| `/api/webcontainer/exec` | POST | Execute command |
| `/api/webcontainer/run-file` | POST | Run code file |

### Code Review
| Route | Method | Description |
|-------|--------|-------------|
| `/api/reviews` | GET/POST | List/Create reviews |
| `/api/reviews/[id]` | GET/PATCH | Get/Update review |

### Vector Search
| Route | Method | Description |
|-------|--------|-------------|
| `/api/pinecone/index` | POST | Index repository |
| `/api/pinecone/search` | POST | Semantic search |

---

## 🔧 Getting Started

### Prerequisites

```bash
Node.js 18+
PostgreSQL 14+
npm or yarn
```

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/neoforge.git
cd neoforge
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env.local
```

Required variables:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/neoforge"

# Authentication
AUTH_SECRET="your-auth-secret"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# AI Providers
ANTHROPIC_API_KEY="your-anthropic-key"
GOOGLE_GEMINI_API_KEY="your-gemini-key"
OPENROUTER_API_KEY="your-openrouter-key"

# Pinecone
PINECONE_API_KEY="your-pinecone-key"

# Inngest
INNGEST_EVENT_KEY="your-inngest-key"
INNGEST_SIGNING_KEY="your-inngest-signing-key"
```

4. **Setup database**
```bash
npx prisma generate
npx prisma db push
```

5. **Run development server**
```bash
npm run dev
```

6. **Open browser**
```
http://localhost:3000
```

---

## 📁 Project Structure

```
neoforge/
├── app/                          # Next.js App Router
│   ├── (ide)/[projectId]/       # Main IDE page
│   │   └── page.tsx             # IDE implementation
│   ├── api/                     # API routes
│   │   ├── ai/                  # AI endpoints
│   │   ├── github/              # GitHub integration
│   │   ├── webcontainer/       # Browser execution
│   │   └── pinecone/            # Vector search
│   ├── dashboard/               # User dashboard
│   └── auth/                    # Authentication
├── components/
│   ├── ai-chat/                 # AI chat component
│   ├── editor/                  # Code editor
│   ├── file-explorer/           # File tree
│   ├── terminal/                # Terminal
│   └── ui/                      # Reusable UI
├── lib/                         # Utilities
├── prisma/                      # Database schema
└── convex/                      # Real-time backend
```

---

## 🔐 Security

- **Authentication** - Secure sessions with Better Auth
- **OAuth** - GitHub OAuth 2.0 integration
- **API Keys** - Server-side API key handling
- **Input Sanitization** - XSS prevention in AI responses
- **Rate Limiting** - API request throttling

---

## 📄 License

MIT License - feel free to use this project for your own purposes.

---

<div align="center">

**Built with ❤️ using Next.js, React, and WebContainer API**

*[Star us on GitHub](https://github.com/yourusername/neoforge) • [Report Bug](https://github.com/yourusername/neoforge/issues)*

</div>
