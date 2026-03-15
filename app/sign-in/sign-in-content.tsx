"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Github, Loader2, Code2 } from "lucide-react";
import { createAuthClient } from "better-auth/client";

const resolvedBaseUrl =
  process.env.NEXT_PUBLIC_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

const authClient = createAuthClient({
  baseURL: resolvedBaseUrl,
});

export default function SignInContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGitHubSignIn = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: authError } = await authClient.signIn.social({
        provider: "github",
        callbackURL: "/dashboard",
      });

      if (authError) {
        setError(authError.message || "Failed to sign in with GitHub");
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to initiate sign in");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md border-4 border-black shadow-[8px_8px_0px_0px_#000]">
        <CardHeader className="border-b-4 border-black bg-primary/20">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border-4 border-black bg-primary shadow-[2px_2px_0px_0px_#000]">
              <Code2 className="h-7 w-7 text-black" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Welcome to NeoForge</CardTitle>
          <CardDescription className="text-center">
            Sign in to access your AI-powered IDE and code reviews
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {error && (
            <div className="p-3 border-2 border-destructive bg-destructive/10 text-destructive font-medium">
              {error}
            </div>
          )}
          
          <Button
            onClick={handleGitHubSignIn}
            disabled={loading}
            className="w-full h-14 text-lg border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#000] bg-black text-white"
          >
            {loading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Github className="mr-2 h-5 w-5" />
            )}
            Continue with GitHub
          </Button>
          
          <div className="text-center text-sm text-muted-foreground">
            <p>By signing in, you agree to our Terms of Service and Privacy Policy</p>
          </div>
          
          <div className="pt-4 border-t-2 border-black/10">
            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="w-full border-2 border-black"
            >
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
