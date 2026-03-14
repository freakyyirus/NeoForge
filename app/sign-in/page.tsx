"use client";

import { Suspense } from "react";
import SignInContent from "./sign-in-content";

export const dynamic = 'force-dynamic';

function SignInLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <div className="w-full max-w-md border-4 border-black shadow-[8px_8px_0px_0px_#000] bg-white p-8">
        <div className="animate-pulse">
          <div className="h-12 w-12 bg-muted rounded-lg mx-auto mb-4 border-2 border-black" />
          <div className="h-8 bg-muted rounded mb-4" />
          <div className="h-4 bg-muted rounded mb-8" />
          <div className="h-14 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInLoading />}>
      <SignInContent />
    </Suspense>
  );
}
