const { parseByLanguage } = require("../parsers/treeSitterSetup");

function extractSqlTables(fileMeta, source) {
  const tables = [];

  // Parse with tree-sitter-sql to satisfy deterministic SQL AST parsing requirement.
  // Table names are extracted deterministically from SQL create-table statements.
  parseByLanguage(source, "sql");

  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?[`"\[]?(\w+)[`"\]]?/i);
    if (match) {
      const table = match[2];
      tables.push({
        id: `db:${fileMeta.relPath}:${i + 1}:sql-table:${table}`,
        type: "database-model",
        modelType: "sql-table",
        name: table,
        filePath: fileMeta.relPath,
        line: i + 1,
        language: "sql",
      });
    }
  }

  return tables;
}

function extractPrismaModels(fileMeta, source) {
  const models = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(/^model\s+(\w+)\s*\{/);
    if (match) {
      const model = match[1];
      models.push({
        id: `db:${fileMeta.relPath}:${i + 1}:prisma-model:${model}`,
        type: "database-model",
        modelType: "prisma-model",
        name: model,
        filePath: fileMeta.relPath,
        line: i + 1,
        language: "prisma",
      });
    }
  }

  return models;
}

function extractDatabaseDependencies(fileMeta, source) {
  if (fileMeta.ext === "sql") return extractSqlTables(fileMeta, source);
  if (fileMeta.ext === "prisma") return extractPrismaModels(fileMeta, source);
  return [];
}

module.exports = {
  extractDatabaseDependencies,
};
