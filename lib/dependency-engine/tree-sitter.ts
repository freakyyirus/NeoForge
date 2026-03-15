import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import Go from 'tree-sitter-go';
import Python from 'tree-sitter-python';

const parsers: Record<string, Parser> = {};

export function initializeParsers(): void {
  if (parsers.typescript) return;

  const tsParser = new Parser();
  tsParser.setLanguage(TypeScript.typescript);
  parsers.typescript = tsParser;

  const tsxParser = new Parser();
  tsxParser.setLanguage(TypeScript.tsx);
  parsers.tsx = tsxParser;

  const goParser = new Parser();
  goParser.setLanguage(Go);
  parsers.go = goParser;

  const pythonParser = new Parser();
  pythonParser.setLanguage(Python);
  parsers.python = pythonParser;
}

export function getParser(language: string): Parser | null {
  if (!parsers.typescript) {
    initializeParsers();
  }
  return parsers[language] || null;
}

export function parseSource(source: string, language: string): Parser.Tree | null {
  const parser = getParser(language);
  if (!parser) return null;
  
  try {
    return parser.parse(source);
  } catch {
    return null;
  }
}

export function extractNodeText(node: Parser.SyntaxNode, source: string): string {
  return source.slice(node.startIndex, node.endIndex);
}

export function findNodes(
  tree: Parser.Tree,
  predicate: (node: Parser.SyntaxNode) => boolean
): Parser.SyntaxNode[] {
  const results: Parser.SyntaxNode[] = [];
  
  function walk(node: Parser.SyntaxNode): void {
    if (predicate(node)) {
      results.push(node);
    }
    for (let i = 0; i < node.childCount; i++) {
      walk(node.child(i)!);
    }
  }
  
  walk(tree.rootNode);
  return results;
}

export function findChildNode(
  node: Parser.SyntaxNode,
  type: string
): Parser.SyntaxNode | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child?.type === type) return child;
  }
  return null;
}

export function findChildByField(
  node: Parser.SyntaxNode,
  fieldName: string
): Parser.SyntaxNode | null {
  return node.childForFieldName(fieldName) || null;
}

export const SUPPORTED_LANGUAGES = [
  'typescript',
  'tsx', 
  'go',
  'python',
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export function getLanguageFromExtension(ext: string): SupportedLanguage | null {
  const mapping: Record<string, SupportedLanguage> = {
    'ts': 'typescript',
    'tsx': 'tsx',
    'js': 'typescript',
    'jsx': 'tsx',
    'go': 'go',
    'py': 'python',
  };
  return mapping[ext] || null;
}

export function isTreeSitterLanguage(language: string): boolean {
  return SUPPORTED_LANGUAGES.includes(language as SupportedLanguage);
}
