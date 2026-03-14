import Link from "next/link";
import { ArrowRight, Github, Layers, Sparkles, TerminalSquare, Zap, Users, GitBranch, Shield, Stars, FolderGit2, Cloud, Bot } from "lucide-react";

export default function Home() {
  const stats = [
    { value: "20+", label: "Languages" },
    { value: "2", label: "AI Models" },
    { value: "RAG", label: "Context Engine" },
    { value: "∞", label: "Possibilities" },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#ECECEC] text-black">
      <header className="sticky top-0 z-30 border-y-2 border-black bg-white">
        <div className="mx-auto flex h-16 w-full max-w-[1920px] items-center justify-between gap-4 px-2 sm:px-3 xl:px-4">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center border-2 border-black bg-[#FFE600] shadow-[3px_3px_0px_0px_#000]">
              <Layers className="h-5 w-5" />
            </span>
            <span className="text-[30px] font-black leading-none" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: "30px" }}>
              NeoForge
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-[22px] font-extrabold md:flex" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: "22px" }}>
            <Link href="#features" className="transition-opacity hover:opacity-70">
              Features
            </Link>
            <Link href="#pricing" className="transition-opacity hover:opacity-70">
              Pricing
            </Link>
            <Link href="/dashboard" className="transition-opacity hover:opacity-70">
              Dashboard
            </Link>
          </nav>

          <Link
            href="/sign-in"
            className="inline-flex shrink-0 items-center gap-2 border-2 border-black bg-[#FFE600] px-4 py-2 text-xs font-extrabold shadow-[4px_4px_0px_0px_#000] transition-transform hover:-translate-y-0.5 sm:px-6 sm:text-sm"
          >
            <Github className="h-4 w-4" />
            Sign in with GitHub
          </Link>
        </div>
      </header>

      <main>
        <section className="border-b-2 border-black bg-[#FFE600] bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.05)_0,rgba(0,0,0,0.05)_1px,transparent_1px,transparent_12px)]">
          <div className="mx-auto grid w-full max-w-[1680px] gap-10 px-5 pb-14 pt-10 sm:px-7 sm:pb-16 sm:pt-12 md:pb-20 md:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16 xl:px-10">
            <div>
              <div className="inline-flex items-center gap-2 border-2 border-black bg-black px-4 py-2 text-xs font-extrabold text-[#FFE600] shadow-[3px_3px_0px_0px_#000] sm:text-sm">
                <Sparkles className="h-4 w-4" />
                Now with Gemini 2.5 Flash + Claude 3.5 Sonnet
              </div>

              <h1 className="mt-7 max-w-4xl text-[40px] font-black leading-[0.95] sm:text-[56px] md:text-[72px]" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
                <span className="block">The Ultimate</span>
                <span className="mt-2 block">AI IDE &</span>
                <span className="mt-3 inline-block bg-black px-3 py-2 text-[#FFE600]">Review Engine</span>
              </h1>

              <p className="mt-8 max-w-3xl text-lg font-semibold leading-relaxed text-black/80 sm:text-2xl">
                Browser-based IDE with real-time collaboration and AI-powered GitHub PR reviews using RAG.
                Connect your repos, ship better code, faster.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/sign-in"
                  className="inline-flex items-center gap-3 border-2 border-black bg-black px-7 py-4 text-base font-extrabold text-white shadow-[5px_5px_0px_0px_#000] transition-transform hover:-translate-y-0.5"
                >
                  <Github className="h-5 w-5" />
                  Sign in with GitHub
                </Link>
                <Link
                  href="#features"
                  className="inline-flex items-center gap-3 border-2 border-black bg-[#ECECEC] px-7 py-4 text-base font-extrabold shadow-[5px_5px_0px_0px_#000] transition-transform hover:-translate-y-0.5"
                >
                  See Features
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="absolute -left-6 -top-6 h-24 w-24 border-2 border-black bg-[#1868E7]" />
              <div className="absolute -bottom-6 -right-6 h-20 w-20 border-2 border-black bg-black" />

              <div className="relative border-2 border-black bg-[#ECECEC] p-4 shadow-[8px_8px_0px_0px_#000]">
                <div className="border-2 border-black bg-black p-4 text-[#FFE600]">
                  <p className="text-xs font-black tracking-wide">LIVE WORKSPACE</p>
                  <p className="mt-1 text-2xl font-black">Instant Preview</p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="border-2 border-black bg-white p-3">
                    <p className="text-[10px] font-black text-black/60">FILES EDITED</p>
                    <p className="mt-1 text-2xl font-black">12</p>
                  </div>
                  <div className="border-2 border-black bg-white p-3">
                    <p className="text-[10px] font-black text-black/60">AI REVIEWS</p>
                    <p className="mt-1 text-2xl font-black">31</p>
                  </div>
                  <div className="col-span-2 border-2 border-black bg-[#1868E7] p-4 text-white">
                    <p className="text-[10px] font-black text-white/80">RAG CONTEXT</p>
                    <p className="mt-1 text-xl font-black">Semantic code search ready</p>
                  </div>
                </div>

                <div className="mt-4 border-2 border-black bg-[#030B1A] p-3 text-xs font-semibold leading-relaxed text-[#00E17B]">
                  <p>{">"} /src/components/button.tsx updated</p>
                  <p>{">"} Preview refreshed in 42ms</p>
                  <p>{">"} PR summary generated</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b-2 border-black bg-black py-8">
          <div className="mx-auto grid w-full max-w-[1920px] grid-cols-2 gap-y-8 px-3 sm:px-5 md:grid-cols-4 xl:px-6">
            {stats.map((item, index) => (
              <div
                key={item.label}
                className={`text-center ${index !== stats.length - 1 ? "md:border-r md:border-white/20" : ""}`}
              >
                <p className="text-4xl font-black text-[#FFE600] sm:text-5xl">{item.value}</p>
                <p className="mt-1 text-base font-semibold text-white/70 sm:text-2xl">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="border-b-2 border-black bg-[#ECECEC] py-14">
          <div className="mx-auto w-full max-w-[1920px] px-3 sm:px-5 xl:px-6">
            <div className="text-center">
              <h2 className="text-[38px] font-black leading-tight sm:text-[50px]">Built for Modern Developers</h2>
              <p className="mt-3 text-lg font-medium text-black/60 sm:text-2xl">
                Everything you need to code, collaborate, and ship better code.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              <div className="border-2 border-black bg-white p-6 shadow-[6px_6px_0px_0px_#000]">
                <TerminalSquare className="h-7 w-7 text-[#1868E7]" />
                <h3 className="mt-3 text-3xl font-black">In-Browser IDE</h3>
                <p className="mt-3 text-lg leading-relaxed text-black/60">Full-featured CodeMirror 6 editor with syntax highlighting, multi-cursor editing, and code folding.</p>
              </div>

              <div className="border-2 border-black bg-white p-6 shadow-[6px_6px_0px_0px_#000]">
                <Zap className="h-7 w-7 text-[#B300FF]" />
                <h3 className="mt-3 text-3xl font-black">Instant Execution</h3>
                <p className="mt-3 text-lg leading-relaxed text-black/60">Run your code directly in the browser with WebContainer API. No local setup required.</p>
              </div>

              <div className="border-2 border-black bg-white p-6 shadow-[6px_6px_0px_0px_#000]">
                <Users className="h-7 w-7 text-[#E0B800]" />
                <h3 className="mt-3 text-3xl font-black">Real-time Collab</h3>
                <p className="mt-3 text-lg leading-relaxed text-black/60">Code together with your team using Convex-powered real-time synchronization.</p>
              </div>

              <div className="border-2 border-black bg-white p-6 shadow-[6px_6px_0px_0px_#000]">
                <GitBranch className="h-7 w-7 text-[#FF9B00]" />
                <h3 className="mt-3 text-3xl font-black">Auto PR Reviews</h3>
                <p className="mt-3 text-lg leading-relaxed text-black/60">AI-generated code reviews with walkthroughs, sequence diagrams, and actionable suggestions.</p>
              </div>

              <div className="border-2 border-black bg-white p-6 shadow-[6px_6px_0px_0px_#000]">
                <Stars className="h-7 w-7 text-[#1868E7]" />
                <h3 className="mt-3 text-3xl font-black">RAG Code Search</h3>
                <p className="mt-3 text-lg leading-relaxed text-black/60">Semantic search across your entire codebase using Pinecone vector embeddings.</p>
              </div>

              <div className="border-2 border-black bg-white p-6 shadow-[6px_6px_0px_0px_#000]">
                <Shield className="h-7 w-7 text-[#FF3B3B]" />
                <h3 className="mt-3 text-3xl font-black">Enterprise Security</h3>
                <p className="mt-3 text-lg leading-relaxed text-black/60">GitHub OAuth, encrypted data storage, and SOC 2 compliant infrastructure.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b-2 border-black bg-[#ECECEC] py-16">
          <div className="relative mx-auto w-full max-w-[1920px] px-3 text-center sm:px-5 xl:px-6">
            <div className="pointer-events-none absolute inset-0 hidden xl:block">
              <div className="pointer-events-auto absolute left-[3%] top-[14%] flex items-center gap-2 border-2 border-black bg-white px-3 py-1 text-sm font-bold shadow-[4px_4px_0px_0px_#000] transition-transform duration-150 hover:-translate-y-0.5">
                <TerminalSquare className="h-4 w-4" />
                Terminal
              </div>
              <div className="pointer-events-auto absolute right-[4%] top-[16%] flex items-center gap-2 border-2 border-black bg-white px-3 py-1 text-sm font-bold shadow-[4px_4px_0px_0px_#000] transition-transform duration-150 hover:-translate-y-0.5">
                <Github className="h-4 w-4" />
                GitHub
              </div>
              <div className="pointer-events-auto absolute left-[6%] bottom-[26%] flex items-center gap-2 border-2 border-black bg-white px-3 py-1 text-sm font-bold shadow-[4px_4px_0px_0px_#000] transition-transform duration-150 hover:-translate-y-0.5">
                <FolderGit2 className="h-4 w-4" />
                Repo
              </div>
              <div className="pointer-events-auto absolute right-[6%] bottom-[28%] flex items-center gap-2 border-2 border-black bg-white px-3 py-1 text-sm font-bold shadow-[4px_4px_0px_0px_#000] transition-transform duration-150 hover:-translate-y-0.5">
                <Layers className="h-4 w-4" />
                IDE
              </div>
              <div className="pointer-events-auto absolute right-[10%] top-[50%] flex items-center gap-2 border-2 border-black bg-white px-3 py-1 text-sm font-bold shadow-[4px_4px_0px_0px_#000] transition-transform duration-150 hover:-translate-y-0.5">
                <Cloud className="h-4 w-4" />
                Vercel
              </div>
              <div className="pointer-events-auto absolute left-[10%] top-[50%] flex items-center gap-2 border-2 border-black bg-white px-3 py-1 text-sm font-bold shadow-[4px_4px_0px_0px_#000] transition-transform duration-150 hover:-translate-y-0.5">
                <Bot className="h-4 w-4" />
                AI
              </div>
              <div className="pointer-events-auto absolute right-[10%] bottom-[14%] flex items-center gap-2 border-2 border-black bg-white px-3 py-1 text-sm font-bold shadow-[4px_4px_0px_0px_#000] transition-transform duration-150 hover:-translate-y-0.5">
                <Bot className="h-4 w-4" />
                Anthropic
              </div>
            </div>
            <h2 className="text-[36px] font-black leading-tight sm:text-[56px] md:text-[68px]" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
              Everything you need.
              <span className="block text-[#1868E7]">Nothing you don't.</span>
            </h2>
            <p className="mx-auto mt-8 max-w-4xl text-xl font-medium leading-relaxed text-black/60 sm:text-4xl">
              NeoForge brings together the best tools for modern development into one brutal, beautiful package.
            </p>
          </div>
        </section>

        <section className="border-b-2 border-black bg-black py-14">
          <div className="mx-auto w-full max-w-[1680px] px-5 sm:px-7 xl:px-10">
            <h3 className="text-center text-[34px] font-black leading-tight text-[#FFE600] sm:text-[48px] md:text-[58px]">
              Code in the browser.
            </h3>
            <p className="mt-3 text-center text-base font-semibold text-white/60 sm:text-2xl">
              Full IDE experience with WebContainer API. No local setup required.
            </p>

            <div className="mt-8 grid gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
              <div className="overflow-hidden border-2 border-[#FFE600] bg-[#020A1A] shadow-[10px_10px_0px_0px_#FFE600]">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-3.5 w-3.5 rounded-full bg-[#FF4B55]" />
                    <span className="h-3.5 w-3.5 rounded-full bg-[#FFCC00]" />
                    <span className="h-3.5 w-3.5 rounded-full bg-[#27C93F]" />
                    <span className="ml-2 text-xs font-bold uppercase tracking-wide text-white/45">NeoForge IDE - api/server.ts</span>
                  </div>
                  <span className="border border-[#00E17B]/30 bg-[#00E17B]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#00E17B]">
                    live
                  </span>
                </div>
                <pre className="overflow-hidden whitespace-pre-wrap break-words px-5 py-5 text-[12px] leading-7 text-[#00E17B] sm:text-[13px]">{`import { createServer } from "http";

const server = createServer((req, res) => {
  const { url, method } = req;

  if (method === "GET" && url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", ai: "active" }));
    return;
  }

  // missing return type + fallback details
  res.writeHead(404);
  res.end("Not found");
});

server.listen(3000);`}</pre>
              </div>

              <div className="overflow-hidden border-2 border-[#1868E7] bg-[#F6F7FA] shadow-[10px_10px_0px_0px_#1868E7]">
                <div className="border-b-2 border-black bg-black px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-[#FFE600]">AI Review Findings</p>
                      <p className="mt-1 text-2xl font-black text-white">Potential Errors</p>
                    </div>
                    <span className="border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">2 issues</span>
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  <div className="border-2 border-black bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black">api/server.ts:11</p>
                      <span className="border border-black bg-[#FF3B3B] px-2 py-0.5 text-[10px] font-black text-white">HIGH</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-black/70">Missing explicit content-type for 404 responses can cause inconsistent client behavior.</p>
                    <p className="mt-2 text-xs font-bold text-[#1868E7]">Suggested fix: res.writeHead(404, {"{"} "Content-Type": "text/plain" {"}"});</p>
                  </div>

                  <div className="border-2 border-black bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black">api/server.ts:4</p>
                      <span className="border border-black bg-[#FF9B00] px-2 py-0.5 text-[10px] font-black text-black">MED</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-black/70">Unhandled routes are not logged, making production debugging harder.</p>
                    <p className="mt-2 text-xs font-bold text-[#1868E7]">Suggested fix: add request logging before fallback return.</p>
                  </div>

                  <div className="border-2 border-black bg-[#E8FFF2] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black">Health endpoint</p>
                      <span className="border border-black bg-[#27C93F] px-2 py-0.5 text-[10px] font-black text-black">PASS</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-black/70">GET /health returns valid JSON with status and AI metadata.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-b-2 border-black bg-[#ECECEC] py-16">
          <div className="mx-auto w-full max-w-[1920px] px-3 sm:px-5 xl:px-6">
            <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 xl:grid-cols-3">
              <div className="border-2 border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000]">
                <h4 className="text-2xl font-black">Free Tier</h4>
                <p className="mt-2 text-black/60">For solo builders</p>
                <p className="mt-4 text-4xl font-black">$0</p>
                <ul className="mt-5 space-y-2 text-base font-semibold text-black/70 sm:text-xl">
                  <li>5 repositories</li>
                  <li>5 reviews per repo</li>
                  <li>Core IDE features</li>
                  <li>Community support</li>
                </ul>
                <Link
                  href="/sign-in"
                  className="mt-6 inline-flex w-full items-center justify-center border-2 border-black bg-black px-5 py-2.5 text-sm font-extrabold text-white shadow-[4px_4px_0px_0px_#000]"
                >
                  Start Free
                </Link>
              </div>

              <div className="border-2 border-black bg-white p-5 shadow-[6px_6px_0px_0px_#1868E7]">
                <h4 className="text-2xl font-black">Pro Tier</h4>
                <p className="mt-2 text-black/60">For growing teams</p>
                <p className="mt-4 text-4xl font-black">$29</p>
                <p className="text-sm text-black/50">per month</p>
                <ul className="mt-5 space-y-2 text-base font-semibold text-black/70 sm:text-xl">
                  <li>Unlimited repositories</li>
                  <li>Unlimited AI reviews</li>
                  <li>Advanced IDE tooling</li>
                  <li>Priority support</li>
                </ul>
                <Link
                  href="/sign-in"
                  className="mt-6 inline-flex w-full items-center justify-center border-2 border-black bg-black px-5 py-2.5 text-sm font-extrabold text-[#FFE600] shadow-[4px_4px_0px_0px_#000]"
                >
                  Upgrade to Pro
                </Link>
              </div>

              <div className="border-2 border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000]">
                <h4 className="text-2xl font-black">Custom Plan</h4>
                <p className="mt-2 text-black/60">For teams with custom needs</p>
                <p className="mt-4 text-4xl font-black">Custom</p>
                <p className="text-sm text-black/50">tailored pricing</p>
                <ul className="mt-5 space-y-2 text-base font-semibold text-black/70 sm:text-xl">
                  <li>Dedicated onboarding</li>
                  <li>Custom model routing</li>
                  <li>SLA and premium support</li>
                  <li>Enterprise security controls</li>
                </ul>
                <Link
                  href="/dashboard/settings"
                  className="mt-6 inline-flex w-full items-center justify-center border-2 border-black bg-black px-5 py-2.5 text-sm font-extrabold text-white shadow-[4px_4px_0px_0px_#000]"
                >
                  Contact Sales
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b-2 border-black bg-[#1868E7] py-16">
          <div className="mx-auto w-full max-w-[1920px] px-3 text-center sm:px-5 xl:px-6">
            <h3 className="text-[36px] font-black leading-tight text-white sm:text-[54px] md:text-[64px]">
              Ready to forge the future?
            </h3>
            <p className="mx-auto mt-6 max-w-4xl text-xl font-semibold leading-relaxed text-white/70 sm:text-4xl">
              Join thousands of developers using NeoForge to write better code, faster.
            </p>
            <div className="mt-10">
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-3 border-2 border-black bg-[#FFE600] px-8 py-4 text-base font-extrabold text-black shadow-[5px_5px_0px_0px_#000]"
              >
                <Github className="h-5 w-5" />
                Sign in with GitHub
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-black py-10 text-white">
        <div className="mx-auto flex w-full max-w-[1920px] flex-col items-center justify-between gap-4 px-3 sm:flex-row sm:px-5 xl:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center border border-white bg-[#FFE600]">
              <Layers className="h-4 w-4 text-black" />
            </span>
            <span className="text-xl font-bold">NeoForge</span>
          </div>

          <p className="text-center text-sm text-white/50">© 2026 NeoForge. Built with Next.js, Convex, and AI.</p>

          <div className="flex items-center gap-8 text-sm font-bold">
            <Link href="/dashboard" className="hover:text-[#FFE600]">
              Dashboard
            </Link>
            <Link href="https://github.com/freakyyirus/NeoForge" className="hover:text-[#FFE600]">
              GitHub
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
