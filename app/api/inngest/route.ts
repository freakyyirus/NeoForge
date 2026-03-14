import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { indexCodebase, generateReview, syncUserRepositories } from "@/functions/index";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [indexCodebase, generateReview, syncUserRepositories],
});
