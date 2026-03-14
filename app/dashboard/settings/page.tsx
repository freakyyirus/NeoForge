"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { User, Key, Bell, CreditCard, Github, CheckCircle, AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";

interface UserSettings {
  name: string;
  email: string;
  githubUsername: string;
  geminiApiKey: string;
  claudeApiKey: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  githubId: string | null;
  subscription?: {
    tier: string;
    status: string;
  };
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings>({
    name: "",
    email: "",
    githubUsername: "",
    geminiApiKey: "",
    claudeApiKey: "",
  });
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [userRes, settingsRes] = await Promise.all([
          fetch("/api/auth/get-session"),
          Promise.resolve({ json: () => ({}) }),
        ]);
        
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.user) {
            setUser(userData.user);
            setSettings(prev => ({
              ...prev,
              name: userData.user.name || "",
              email: userData.user.email || "",
              githubUsername: userData.user.githubUsername || "",
            }));
          }
        }
        
        const stored = localStorage.getItem("neoforge-settings");
        if (stored) {
          const parsed = JSON.parse(stored);
          setSettings(prev => ({ ...prev, ...parsed }));
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("neoforge-settings");
    if (stored) {
      const parsed = JSON.parse(stored);
      setSettings(parsed);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("neoforge-settings", JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSignIn = async () => {
    window.location.href = "/api/auth/signin/github";
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/";
  };

  const hasCustomKeys = settings.geminiApiKey || settings.claudeApiKey;

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-12">
        <Card className="border-4 border-black">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Sign In</CardTitle>
            <CardDescription>Sign in to access your NeoForge account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleSignIn} 
              className="w-full" 
              size="lg"
            >
              <Github className="mr-2 h-5 w-5" />
              Continue with GitHub
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences.</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>Update your personal information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                {user.image ? (
                  <img 
                    src={user.image} 
                    alt={user.name || "User"} 
                    className="h-20 w-20 rounded-full border-4 border-black"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full border-4 border-black bg-secondary" />
                )}
              </div>
              <Separator />
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block font-bold">Name</label>
                  <Input 
                    placeholder="Your name" 
                    value={settings.name}
                    onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-2 block font-bold">Email</label>
                  <Input 
                    placeholder="your@email.com" 
                    value={settings.email}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Github className="h-5 w-5" />
                  <span className="font-medium">
                    {user.githubId ? `Connected as @${settings.githubUsername || "github user"}` : "GitHub not connected"}
                  </span>
                </div>
                {user.githubId && (
                  <Badge variant="success">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Verified
                  </Badge>
                )}
              </div>
              <div className="flex justify-end gap-2">
                {saved && (
                  <span className="flex items-center text-sm font-bold text-green-600">
                    <CheckCircle className="mr-1 h-4 w-4" /> Saved!
                  </span>
                )}
                <Button variant="primary" onClick={handleSave}>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Use your own API keys to override the default keys. Your keys are stored locally in your browser and never sent to our servers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border-4 border-black bg-muted p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">Environment Default Keys</p>
                    <p className="text-sm text-muted-foreground">Used when no custom key is provided</p>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block font-bold">Google Gemini API Key</label>
                  <p className="mb-2 text-sm text-muted-foreground">
                    Get your key from{" "}
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline hover:text-primary"
                    >
                      Google AI Studio
                    </a>
                  </p>
                  <div className="relative">
                    <Input
                      type={showGeminiKey ? "text" : "password"}
                      placeholder="Enter your Gemini API Key"
                      value={settings.geminiApiKey}
                      onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                    >
                      {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block font-bold">Anthropic Claude API Key</label>
                  <p className="mb-2 text-sm text-muted-foreground">
                    Get your key from{" "}
                    <a 
                      href="https://console.anthropic.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline hover:text-primary"
                    >
                      Anthropic Console
                    </a>
                  </p>
                  <div className="relative">
                    <Input
                      type={showClaudeKey ? "text" : "password"}
                      placeholder="Enter your Claude API Key"
                      value={settings.claudeApiKey}
                      onChange={(e) => setSettings({ ...settings, claudeApiKey: e.target.value })}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowClaudeKey(!showClaudeKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                    >
                      {showClaudeKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {hasCustomKeys && (
                <div className="rounded-lg border-2 border-black bg-primary/20 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    <p className="font-bold">Custom keys configured</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your custom keys will be used instead of the default environment keys.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                {saved && (
                  <span className="flex items-center text-sm font-bold text-green-600">
                    <CheckCircle className="mr-1 h-4 w-4" /> Saved!
                  </span>
                )}
                <Button variant="primary" onClick={handleSave}>Save API Keys</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Subscription
              </CardTitle>
              <CardDescription>Manage your subscription and billing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border-4 border-black bg-primary/20 p-4">
                <div>
                  <p className="text-lg font-bold">{user.subscription?.tier || "Free"} Tier</p>
                  <p className="text-sm text-muted-foreground">
                    {user.subscription?.tier === "PRO" ? "Unlimited everything" : "5 repositories, 5 reviews per repo"}
                  </p>
                </div>
                <Badge variant="secondary">Current Plan</Badge>
              </div>
              <Separator />
              <div>
                <h4 className="mb-4 font-bold">Usage This Month</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Repositories</span>
                    <span className="font-bold">5 / 5</span>
                  </div>
                  <div className="h-4 rounded-full border-2 border-black bg-muted">
                    <div className="h-full w-full rounded-full bg-primary" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Reviews</span>
                    <span className="font-bold">15 / 25</span>
                  </div>
                  <div className="h-4 rounded-full border-2 border-black bg-muted">
                    <div className="h-full w-3/5 rounded-full bg-secondary" />
                  </div>
                </div>
              </div>
              <Button variant="primary" className="w-full">
                Upgrade to Pro
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>Choose how you want to be notified.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Review completed", description: "Get notified when a PR review is finished" },
                { label: "New issues detected", description: "Alert when critical issues are found" },
                { label: "Weekly summary", description: "Receive a weekly digest of activity" },
                { label: "Marketing updates", description: "News about new features and updates" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <input type="checkbox" className="h-5 w-5 rounded border-2 border-black accent-primary" defaultChecked />
                </div>
              ))}
              <div className="flex justify-end">
                <Button variant="primary">Save Preferences</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}