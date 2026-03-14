import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  files: defineTable({
    name: v.string(),
    path: v.string(),
    content: v.string(),
    isDirectory: v.boolean(),
    parentPath: v.optional(v.string()),
    projectId: v.id("projects"),
    lastModified: v.number(),
    language: v.optional(v.string()),
  }),
  
  projects: defineTable({
    name: v.string(),
    ownerId: v.string(),
    repoId: v.optional(v.string()),
    status: v.union(
      v.literal("booting"),
      v.literal("ready"),
      v.literal("error")
    ),
    webcontainerId: v.optional(v.string()),
    createdAt: v.number(),
  }),
  
  collaboration: defineTable({
    projectId: v.id("projects"),
    filePath: v.string(),
    cursorPositions: v.array(v.object({
      userId: v.string(),
      userName: v.string(),
      line: v.number(),
      column: v.number(),
      selection: v.optional(v.object({
        startLine: v.number(),
        startColumn: v.number(),
        endLine: v.number(),
        endColumn: v.number(),
      })),
    })),
  }),
  
  chatMessages: defineTable({
    projectId: v.id("projects"),
    userId: v.string(),
    userName: v.string(),
    userImage: v.optional(v.string()),
    content: v.string(),
    context: v.optional(v.array(v.object({
      type: v.string(),
      data: v.any(),
    }))),
    createdAt: v.number(),
  }),
  
  terminals: defineTable({
    projectId: v.id("projects"),
    userId: v.string(),
    sessionId: v.string(),
    isActive: v.boolean(),
  }),
});
