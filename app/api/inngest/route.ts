import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { indexCodebase, generateReview, syncUserRepositories } from "@/functions/index";
import { parseDependencies } from "@/functions/parse-dependencies";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [indexCodebase, generateReview, syncUserRepositories, parseDependencies],
});
