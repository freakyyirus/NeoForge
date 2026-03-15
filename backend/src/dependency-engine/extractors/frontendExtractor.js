const { parseByLanguage } = require("../parsers/treeSitterSetup");

function stripQuote(value) {
  return value.replace(/^['"`]|['"`]$/g, "");
}

function pickUrlArg(callNode) {
  const args = callNode.namedChildren.find((n) => n.type === "arguments");
  if (!args || !args.namedChildren || args.namedChildren.length === 0) return null;
  return args.namedChildren[0];
}

function extractFrontendDependencies(fileMeta, source) {
  if (!["ts", "tsx", "js", "jsx"].includes(fileMeta.ext)) return [];

  const tree = parseByLanguage(source, "typescript");
  const root = tree.rootNode;
  const nodes = [];

  function walk(node) {
    if (node.type === "call_expression") {
      const fn = node.childForFieldName("function");
      const argNode = pickUrlArg(node);

      if (fn && argNode) {
        const fnText = fn.text;
        const raw = argNode.text || "";
        const url = stripQuote(raw);

        if (fnText === "fetch" || fnText.endsWith(".fetch")) {
          nodes.push({
            id: `frontend:${fileMeta.relPath}:${node.startPosition.row + 1}:fetch:${url}`,
            type: "frontend-call",
            subtype: "fetch",
            filePath: fileMeta.relPath,
            line: node.startPosition.row + 1,
            method: "UNKNOWN",
            path: url,
            language: "typescript",
          });
        }

        if (/^axios\.(get|post|put|delete|patch)$/.test(fnText)) {
          const method = fnText.split(".")[1].toUpperCase();
          nodes.push({
            id: `frontend:${fileMeta.relPath}:${node.startPosition.row + 1}:axios:${method}:${url}`,
            type: "frontend-call",
            subtype: "axios",
            filePath: fileMeta.relPath,
            line: node.startPosition.row + 1,
            method,
            path: url,
            language: "typescript",
          });
        }
      }
    }

    for (const child of node.children) {
      walk(child);
    }
  }

  walk(root);
  return nodes;
}

module.exports = {
  extractFrontendDependencies,
};
