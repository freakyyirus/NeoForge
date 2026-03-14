import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ user: null });
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        subscription: true,
      },
    });

    if (!fullUser) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: fullUser.id,
        name: fullUser.name,
        email: fullUser.email,
        image: fullUser.image,
        githubId: fullUser.githubId,
        githubUsername: fullUser.githubId,
        subscription: fullUser.subscription ? {
          tier: fullUser.subscription.tier,
          status: fullUser.subscription.status,
        } : null,
      },
    });
  } catch (error) {
    console.error("Error getting session:", error);
    return NextResponse.json({ user: null });
  }
}
