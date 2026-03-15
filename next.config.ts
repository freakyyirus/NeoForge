import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tree-sitter uses native Node.js bindings (.node files) — must not be bundled
  serverExternalPackages: [
    "tree-sitter",
    "tree-sitter-typescript",
    "tree-sitter-go",
    "tree-sitter-python",
  ],
};

export default nextConfig;
