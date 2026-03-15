const fg = require("fast-glob");
const path = require("path");

const DEFAULT_PATTERNS = [
  "**/*.ts",
  "**/*.tsx",
  "**/*.js",
  "**/*.jsx",
  "**/*.go",
  "**/*.py",
  "**/*.sql",
  "**/*.prisma",
];

const DEFAULT_IGNORE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.next/**",
  "**/dist/**",
  "**/build/**",
  "**/.turbo/**",
  "**/coverage/**",
];

async function scanProjectFiles(projectRoot, options = {}) {
  const patterns = options.patterns || DEFAULT_PATTERNS;
  const ignore = options.ignore || DEFAULT_IGNORE;

  const files = await fg(patterns, {
    cwd: projectRoot,
    ignore,
    absolute: true,
    onlyFiles: true,
    dot: false,
    unique: true,
  });

  return files.map((absPath) => ({
    absPath,
    relPath: path.relative(projectRoot, absPath).replace(/\\/g, "/"),
    ext: path.extname(absPath).slice(1).toLowerCase(),
  }));
}

module.exports = {
  scanProjectFiles,
  DEFAULT_PATTERNS,
  DEFAULT_IGNORE,
};
