import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Terminal, 
  GitBranch, 
  Zap, 
  Shield, 
  Users, 
  Code2, 
  Sparkles,
  ArrowRight,
  Github,
  CheckCircle,
  Star
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b-4 border-black">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border-4 border-black bg-primary shadow-[4px_4px_0px_0px_#000]">
              <Code2 className="h-6 w-6 text-black" />
            </div>
            <span className="text-2xl font-bold tracking-tight">NeoForge</span>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="#features" className="font-bold hover:text-secondary">Features</Link>
            <Link href="#pricing" className="font-bold hover:text-secondary">Pricing</Link>
            <Link href="/dashboard" className="font-bold hover:text-secondary">Dashboard</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button variant="primary" asChild>
              <Link href="/sign-in">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden py-20 md:py-32">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(#FFE600_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />
          <div className="container mx-auto px-6">
            <div className="mx-auto max-w-4xl text-center">
              <Badge variant="secondary" className="mb-6">
                <Sparkles className="mr-1 h-3 w-3" />
                Now with Gemini 2.5 & Claude 3.5
              </Badge>
              <h1 className="mb-6 text-5xl font-bold leading-tight md:text-7xl">
                The Ultimate
                <span className="block text-primary">AI IDE</span>
                & Code Review Engine
              </h1>
              <p className="mx-auto mb-8 max-w-2xl text-xl text-muted-foreground">
                Browser-based IDE with real-time collaboration and automated GitHub PR reviews 
                powered by RAG and vector embeddings.
              </p>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button variant="primary" size="lg" asChild>
                <Link href="/sign-in">
                  Start Coding Free <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="#demo">
                    Watch Demo
                  </Link>
                </Button>
              </div>
              <div className="mt-8 flex items-center justify-center gap-6 text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Github className="h-5 w-5" />
                  GitHub OAuth
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-success" />
                  No credit card required
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-t-4 border-black bg-muted py-20">
          <div className="container mx-auto px-6">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-4xl font-bold">Built for Modern Developers</h2>
              <p className="text-xl text-muted-foreground">
                Everything you need to code, collaborate, and ship better code.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <Terminal className="mb-2 h-8 w-8 text-secondary" />
                  <CardTitle>In-Browser IDE</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Full-featured CodeMirror 6 editor with syntax highlighting, 
                    multi-cursor editing, and code folding.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Zap className="mb-2 h-8 w-8 text-accent" />
                  <CardTitle>Instant Execution</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Run your code directly in the browser with WebContainer API. 
                    No local setup required.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Users className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle>Real-time Collab</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Code together with your team using Convex-powered 
                    real-time synchronization.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <GitBranch className="mb-2 h-8 w-8 text-warning" />
                  <CardTitle>Auto PR Reviews</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    AI-generated code reviews with walkthroughs, sequence 
                    diagrams, and actionable suggestions.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Sparkles className="mb-2 h-8 w-8 text-secondary" />
                  <CardTitle>RAG Code Search</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Semantic search across your entire codebase using 
                    Pinecone vector embeddings.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Shield className="mb-2 h-8 w-8 text-destructive" />
                  <CardTitle>Enterprise Security</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    GitHub OAuth, encrypted data storage, and 
                    SOC 2 compliant infrastructure.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-t-4 border-black py-20">
          <div className="container mx-auto px-6">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-4xl font-bold">Simple Pricing</h2>
              <p className="text-xl text-muted-foreground">
                Start free, upgrade when you need more.
              </p>
            </div>
            <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
              <Card className="border-4 border-black shadow-[6px_6px_0px_0px_#000]">
                <CardHeader>
                  <CardTitle className="text-2xl">Free Tier</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 text-4xl font-bold">$0</div>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-success" />
                      5 Repositories
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-success" />
                      5 Reviews per repo
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-success" />
                      Basic IDE features
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-success" />
                      Community support
                    </li>
                  </ul>
                  <Button variant="outline" className="mt-6 w-full">
                    Get Started
                  </Button>
                </CardContent>
              </Card>
              <Card className="relative border-4 border-black bg-primary/10 shadow-[6px_6px_0px_0px_#000]">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge variant="secondary" className="px-4 py-1">
                    <Star className="mr-1 h-3 w-3" />
                    Most Popular
                  </Badge>
                </div>
                <CardHeader>
                  <CardTitle className="text-2xl">Pro Tier</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 text-4xl font-bold">$29</div>
                  <p className="mb-4 text-sm text-muted-foreground">per month</p>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-success" />
                      Unlimited Repositories
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-success" />
                      Unlimited Reviews
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-success" />
                      Advanced IDE features
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-success" />
                      Priority support
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-success" />
                      Custom AI models
                    </li>
                  </ul>
                  <Button variant="primary" className="mt-6 w-full">
                    Upgrade Now
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="border-t-4 border-black bg-primary py-16">
          <div className="container mx-auto px-6 text-center">
            <h2 className="mb-4 text-3xl font-bold text-black">
              Ready to transform your workflow?
            </h2>
            <p className="mb-8 text-lg text-black/70">
              Join thousands of developers using NeoForge.
            </p>
            <Button variant="secondary" size="lg" asChild>
            <Link href="/sign-in">
              Start Free Today <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t-4 border-black bg-black py-12 text-white">
        <div className="container mx-auto px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded border-2 border-white bg-primary">
                <Code2 className="h-4 w-4 text-black" />
              </div>
              <span className="text-xl font-bold">NeoForge</span>
            </div>
            <div className="flex gap-6">
              <Link href="#" className="hover:text-primary">Terms</Link>
              <Link href="#" className="hover:text-primary">Privacy</Link>
              <Link href="#" className="hover:text-primary">Docs</Link>
              <Link href="#" className="hover:text-primary">Support</Link>
            </div>
            <p className="text-sm text-gray-400">
              © 2026 NeoForge. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
