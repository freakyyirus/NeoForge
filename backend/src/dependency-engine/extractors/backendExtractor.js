const { parseByLanguage } = require("../parsers/treeSitterSetup");

function stripQuote(value) {
  return value.replace(/^['"`]|['"`]$/g, "");
}

function normalizeMethod(value) {
  const upper = value.toUpperCase();
  const allow = ["GET", "POST", "PUT", "PATCH", "DELETE", "USE"];
  return allow.includes(upper) ? upper : "UNKNOWN";
}

function extractExpressRoutes(fileMeta, source) {
  const tree = parseByLanguage(source, "typescript");
  const routes = [];

  function walk(node) {
    if (node.type === "call_expression") {
      const fn = node.childForFieldName("function");
      const args = node.childForFieldName("arguments");
      if (fn && args && /^(app|router)\.(get|post|put|patch|delete|use)$/.test(fn.text)) {
        const firstArg = args.namedChildren[0];
        if (firstArg) {
          const method = normalizeMethod(fn.text.split(".").pop() || "");
          routes.push({
            id: `backend:${fileMeta.relPath}:${node.startPosition.row + 1}:express:${method}:${stripQuote(firstArg.text)}`,
            type: "backend-route",
            framework: "express",
            method,
            path: stripQuote(firstArg.text),
            filePath: fileMeta.relPath,
            line: node.startPosition.row + 1,
            language: "typescript",
          });
        }
      }
    }

    if (node.type === "interface_declaration" || node.type === "type_alias_declaration") {
      let p = node.parent;
      let exported = false;
      while (p) {
        if (p.type === "export_statement") {
          exported = true;
          break;
        }
        p = p.parent;
      }
      if (exported) {
        const nameNode = node.childForFieldName("name");
        if (nameNode) {
          routes.push({
            id: `backend:${fileMeta.relPath}:${node.startPosition.row + 1}:ts-type:${nameNode.text}`,
            type: "backend-route",
            framework: "typescript-export",
            method: "TYPE",
            path: nameNode.text,
            filePath: fileMeta.relPath,
            line: node.startPosition.row + 1,
            language: "typescript",
          });
        }
      }
    }

    for (const child of node.children) walk(child);
  }

  walk(tree.rootNode);
  return routes;
}

function extractGoRoutesAndStructs(fileMeta, source) {
  const tree = parseByLanguage(source, "go");
  const nodes = [];

  function walk(node) {
    if (node.type === "call_expression") {
      const fn = node.childForFieldName("function");
      const args = node.childForFieldName("arguments");
      if (fn && args && /\.(GET|POST|PUT|PATCH|DELETE)$/.test(fn.text)) {
        const firstArg = args.namedChildren[0];
        if (firstArg) {
          const method = normalizeMethod(fn.text.split(".").pop() || "");
          nodes.push({
            id: `backend:${fileMeta.relPath}:${node.startPosition.row + 1}:gin:${method}:${stripQuote(firstArg.text)}`,
            type: "backend-route",
            framework: "gin",
            method,
            path: stripQuote(firstArg.text),
            filePath: fileMeta.relPath,
            line: node.startPosition.row + 1,
            language: "go",
          });
        }
      }
    }

    if (node.type === "type_spec") {
      const nameNode = node.childForFieldName("name");
      const typeNode = node.childForFieldName("type");
      if (nameNode && typeNode && typeNode.type === "struct_type") {
        const exported = /^[A-Z]/.test(nameNode.text);
        if (exported) {
          nodes.push({
            id: `backend:${fileMeta.relPath}:${node.startPosition.row + 1}:go-struct:${nameNode.text}`,
            type: "backend-route",
            framework: "go-struct",
            method: "TYPE",
            path: nameNode.text,
            filePath: fileMeta.relPath,
            line: node.startPosition.row + 1,
            language: "go",
          });
        }
      }
    }

    for (const child of node.children) walk(child);
  }

  walk(tree.rootNode);
  return nodes;
}

function extractBackendDependencies(fileMeta, source) {
  if (["ts", "tsx", "js", "jsx"].includes(fileMeta.ext)) {
    return extractExpressRoutes(fileMeta, source);
  }
  if (fileMeta.ext === "go") {
    return extractGoRoutesAndStructs(fileMeta, source);
  }
  return [];
}

module.exports = {
  extractBackendDependencies,
};
