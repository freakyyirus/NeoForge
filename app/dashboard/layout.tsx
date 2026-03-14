"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  GitBranch, 
  Star, 
  Settings, 
  LogOut,
  Menu,
  X,
  Code2,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  subscription?: {
    tier: string;
  };
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/repositories", label: "Repositories", icon: GitBranch },
  { href: "/dashboard/reviews", label: "Reviews", icon: Star },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        
        // For now, allow access if session API works but returns no user
        // This is a temporary solution until auth is fully configured
        if (data.user) {
          setUser(data.user);
        } else {
          // Allow access but show as not logged in
          setUser(null);
        }
      } catch (error) {
        console.error("Failed to fetch session:", error);
        // Allow access even if session fetch fails
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [router]);

  // Allow access to dashboard for now - auth is optional until fully configured
  // Remove this check when auth is properly set up with database
  useEffect(() => {
    if (!loading) {
      // Allow access without auth for development
      setLoading(false);
    }
  }, [loading]);

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch (error) {
      console.error("Sign out error:", error);
    }
    window.location.href = "/sign-in";
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Allow access without auth for development - user can be null
  return (
    <div className="flex h-screen overflow-hidden bg-muted">
      <aside
        className={cn(
          "flex flex-col border-r-4 border-black bg-white transition-all duration-300",
          isSidebarOpen ? "w-64" : "w-0 overflow-hidden"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b-4 border-black px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded border-2 border-black bg-primary">
              <Code2 className="h-4 w-4 text-black" />
            </div>
            <span className="font-bold">NeoForge</span>
          </Link>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="rounded border-2 border-black p-1 hover:bg-muted md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ScrollArea className="flex-1 p-4">
          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border-2 border-transparent px-4 py-3 font-bold transition-all",
                    isActive
                      ? "border-4 border-black bg-primary shadow-[2px_2px_0px_0px_#000]"
                      : "hover:border-2 hover:border-black hover:bg-white"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="border-t-4 border-black p-4">
          {user ? (
            <button 
              onClick={handleSignOut}
              className="flex w-full items-center justify-start gap-2 rounded-md border-4 border-black bg-white px-4 py-3 font-bold shadow-[4px_4px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#000]"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          ) : (
            <Link 
              href="/"
              className="flex w-full items-center justify-start gap-2 rounded-md border-4 border-black bg-primary px-4 py-3 font-bold shadow-[4px_4px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#000]"
            >
              <LogOut className="h-4 w-4" />
              Sign In
            </Link>
          )}
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b-4 border-black bg-white px-6">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="rounded border-2 border-black p-2 hover:bg-muted lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div className="flex-1 lg:hidden" />

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {user?.image ? (
                <img 
                  src={user.image} 
                  alt={user.name || "User"} 
                  className="h-10 w-10 rounded-full border-2 border-black"
                />
              ) : (
                <div className="h-10 w-10 rounded-full border-2 border-black bg-secondary" />
              )}
              <div className="hidden md:block">
                <p className="font-bold">{user?.name || "Guest"}</p>
                <p className="text-sm text-muted-foreground">{user?.subscription?.tier || "Free"} Tier</p>
              </div>
            </div>
          </div>
        </header>

        <ScrollArea className="flex-1 overflow-auto p-6">
          {children}
        </ScrollArea>
      </main>
    </div>
  );
}