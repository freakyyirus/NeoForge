const Parser = require("tree-sitter");
const tsLang = require("tree-sitter-typescript").typescript;
const goLang = require("tree-sitter-go");
const pyLang = require("tree-sitter-python");
const sqlLang = require("tree-sitter-sql");

function createParser(language) {
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}

const parsers = {
  typescript: createParser(tsLang),
  go: createParser(goLang),
  python: createParser(pyLang),
  sql: createParser(sqlLang),
};

function parseByLanguage(source, language) {
  const parser = parsers[language];
  if (!parser) {
    throw new Error(`Unsupported language: ${language}`);
  }
  return parser.parse(source);
}

module.exports = {
  parsers,
  parseByLanguage,
};
