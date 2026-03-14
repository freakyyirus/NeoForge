import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST() {
  try {
    await auth.api.signOut({
      headers: await headers(),
    });

    return NextResponse.redirect(new URL("/sign-in", process.env.NEXT_PUBLIC_URL || "http://localhost:3000"));
  } catch (error) {
    console.error("Sign out error:", error);
    return NextResponse.json(
      { error: "Failed to sign out" },
      { status: 500 }
    );
  }
}
