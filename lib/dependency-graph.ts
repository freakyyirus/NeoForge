export type Language = 'javascript' | 'typescript' | 'python' | 'go' | 'rust' | 'java' | 'cpp' | 'csharp' | 'ruby' | 'php' | 'unknown';

export interface Dependency {
  name: string;
  version?: string;
  type: 'prod' | 'dev' | 'import';
}

export interface FileDependency {
  filePath: string;
  language: Language;
  dependencies: Dependency[];
  imports: ImportStatement[];
}

export interface ImportStatement {
  source: string;
  local: boolean;
  type: 'import' | 'require' | 'from' | 'use' | 'include' | 'import.meta';
}

export interface CrossBoundaryCall {
  sourceFile: string;
  targetFile: string;
  type: 'api' | 'schema' | 'function' | 'variable';
}

export interface DependencyNode {
  id: string;
  name: string;
  language: Language;
  filePath: string;
  dependencies: string[];
}

export interface DependencyEdge {
  source: string;
  target: string;
  type: 'dependency' | 'import' | 'cross-boundary';
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  languages: Language[];
  crossBoundaryCalls: CrossBoundaryCall[];
}

const LANGUAGE_EXTENSIONS: Record<string, Language> = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.c': 'cpp',
  '.h': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
};

const IMPORT_PATTERNS: Record<Language, RegExp[]> = {
  javascript: [
    /import\s+.*?from\s+['"](.+?)['"]/g,
    /import\s*\(\s*['"](.+?)['"]\s*\)/g,
    /require\s*\(\s*['"](.+?)['"]\s*\)/g,
    /import\s+['"](.+?)['"]/g,
  ],
  typescript: [
    /import\s+.*?from\s+['"](.+?)['"]/g,
    /import\s*\(\s*['"](.+?)['"]\s*\)/g,
    /require\s*\(\s*['"](.+?)['"]\s*\)/g,
    /import\s+['"](.+?)['"]/g,
    /import\s+type\s+.*?from\s+['"](.+?)['"]/g,
  ],
  python: [
    /^import\s+(\S+)/gm,
    /^from\s+(\S+)\s+import/gm,
  ],
  go: [
    /import\s+["'](.+?)["']/g,
    /import\s+\(\s*["'](.+?)["']/g,
  ],
  rust: [
    /use\s+(\S+)(?:\s*::\S+)?;/g,
    /extern\s+crate\s+(\S+)/g,
  ],
  java: [
    /import\s+([^;]+);/g,
  ],
  cpp: [
    /#include\s+["<](.+?)[>"]/g,
  ],
  csharp: [
    /using\s+([^;]+);/g,
  ],
  ruby: [
    /require\s+['"](.+?)['"]/g,
    /require_relative\s+['"](.+?)['"]/g,
  ],
  php: [
    /require(?:_once)?\s+['"](.+?)['"]/g,
    /use\s+([^;]+);/g,
  ],
  unknown: [],
};

// ─── AST-level node extraction patterns for logical edge inference ───────────

interface ASTNode {
  id: string;
  kind: 'fetch_call' | 'axios_call' | 'api_route' | 'go_handler' | 'exported_type' | 'go_struct' | 'prisma_model' | 'sql_table';
  filePath: string;
  line: number;
  language: Language;
  detail: string; // URL pattern, type name, table name, etc.
}

function extractASTNodes(filePath: string, content: string): ASTNode[] {
  const nodes: ASTNode[] = [];
  const language = detectLanguage(filePath);
  const lines = content.split('\n');

  // ── fetch() and axios calls ─────────────────────────────────────────
  const fetchPattern = /\bfetch\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let match: RegExpExecArray | null;
  while ((match = fetchPattern.exec(content)) !== null) {
    const url = match[1];
    const line = content.substring(0, match.index).split('\n').length;
    nodes.push({
      id: `ast:${filePath}:fetch:${url}:${line}`,
      kind: 'fetch_call',
      filePath,
      line,
      language,
      detail: url,
    });
  }

  const axiosPattern = /\baxios\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  while ((match = axiosPattern.exec(content)) !== null) {
    const url = match[2];
    const line = content.substring(0, match.index).split('\n').length;
    nodes.push({
      id: `ast:${filePath}:axios:${url}:${line}`,
      kind: 'axios_call',
      filePath,
      line,
      language,
      detail: url,
    });
  }

  // ── Express-style routes: app.get("/route", ...) or router.post(...) ─
  const expressPattern = /\b(?:app|router)\.(get|post|put|delete|patch|use)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  while ((match = expressPattern.exec(content)) !== null) {
    const url = match[2];
    const line = content.substring(0, match.index).split('\n').length;
    nodes.push({
      id: `ast:${filePath}:route:${url}:${line}`,
      kind: 'api_route',
      filePath,
      line,
      language,
      detail: url,
    });
  }

  // ── Go Gin/Chi handlers: r.GET("/path", handler) ────────────────────
  const goHandlerPattern = /\w+\.(GET|POST|PUT|DELETE|PATCH|Handle|HandleFunc)\s*\(\s*"([^"]+)"/g;
  if (language === 'go') {
    while ((match = goHandlerPattern.exec(content)) !== null) {
      const url = match[2];
      const line = content.substring(0, match.index).split('\n').length;
      nodes.push({
        id: `ast:${filePath}:gohandler:${url}:${line}`,
        kind: 'go_handler',
        filePath,
        line,
        language,
        detail: url,
      });
    }
  }

  // ── Exported TypeScript interfaces / type aliases ────────────────────
  const tsTypePattern = /export\s+(?:interface|type)\s+(\w+)/g;
  if (language === 'typescript' || language === 'javascript') {
    while ((match = tsTypePattern.exec(content)) !== null) {
      const name = match[1];
      const line = content.substring(0, match.index).split('\n').length;
      nodes.push({
        id: `ast:${filePath}:type:${name}`,
        kind: 'exported_type',
        filePath,
        line,
        language,
        detail: name,
      });
    }
  }

  // ── Go exported structs: type Foo struct { ... } ────────────────────
  const goStructPattern = /type\s+([A-Z]\w*)\s+struct\s*\{/g;
  if (language === 'go') {
    while ((match = goStructPattern.exec(content)) !== null) {
      const name = match[1];
      const line = content.substring(0, match.index).split('\n').length;
      nodes.push({
        id: `ast:${filePath}:struct:${name}`,
        kind: 'go_struct',
        filePath,
        line,
        language,
        detail: name,
      });
    }
  }

  // ── SQL CREATE TABLE ────────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const tableMatch = lines[i].match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"\[]?(\w+)[`"\]]?/i);
    if (tableMatch) {
      nodes.push({
        id: `ast:${filePath}:table:${tableMatch[1]}`,
        kind: 'sql_table',
        filePath,
        line: i + 1,
        language: 'unknown',
        detail: tableMatch[1],
      });
    }
  }

  // ── Prisma model blocks ─────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const modelMatch = lines[i].match(/^model\s+(\w+)\s*\{/);
    if (modelMatch) {
      nodes.push({
        id: `ast:${filePath}:model:${modelMatch[1]}`,
        kind: 'prisma_model',
        filePath,
        line: i + 1,
        language: 'unknown',
        detail: modelMatch[1],
      });
    }
  }

  return nodes;
}

// ─── Normalise URL for matching (/api/users/:id → /api/users/{param}) ────────

function normaliseUrl(url: string): string {
  return url
    .replace(/:[\w]+/g, '{param}')   // Express :id
    .replace(/\{[\w]+\}/g, '{param}') // OpenAPI {id}
    .replace(/\*$/, '')
    .split('?')[0]                    // strip query string
    .toLowerCase()
    .replace(/\/+$/, '');             // trailing slash
}

// ─── Logical edge inference: 4 heuristics ────────────────────────────────────

function inferLogicalEdges(
  astNodes: ASTNode[],
  edges: DependencyEdge[],
) {
  const callers = astNodes.filter(n => n.kind === 'fetch_call' || n.kind === 'axios_call');
  const routes = astNodes.filter(n => n.kind === 'api_route' || n.kind === 'go_handler');
  const structs = astNodes.filter(n => n.kind === 'exported_type' || n.kind === 'go_struct');
  const prismaModels = astNodes.filter(n => n.kind === 'prisma_model');
  const sqlTables = astNodes.filter(n => n.kind === 'sql_table');

  // 1. fetch/axios → API route (URL pattern matching)
  for (const caller of callers) {
    const callerUrl = normaliseUrl(caller.detail);
    for (const route of routes) {
      const routeUrl = normaliseUrl(route.detail);
      if (callerUrl === routeUrl || callerUrl.startsWith(routeUrl + '/')) {
        edges.push({
          source: caller.filePath,
          target: route.filePath,
          type: 'cross-boundary',
        });
      }
    }
  }

  // 2. Route → Type/Struct (same file — route handler likely uses the type)
  for (const struct of structs) {
    for (const route of routes) {
      if (route.filePath === struct.filePath) {
        edges.push({
          source: route.filePath,
          target: struct.filePath,
          type: 'cross-boundary',
        });
      }
    }
  }

  // 3. Prisma model → SQL table (match by case-insensitive name)
  for (const model of prismaModels) {
    for (const table of sqlTables) {
      if (model.detail.toLowerCase() === table.detail.toLowerCase()) {
        edges.push({
          source: model.filePath,
          target: table.filePath,
          type: 'cross-boundary',
        });
      }
    }
  }

  // 4. API route → Prisma model (match route last segment to model name)
  for (const route of routes) {
    const segments = route.detail.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || '';
    // Singularise: "users" → "user"
    const singular = lastSegment.endsWith('s') ? lastSegment.slice(0, -1) : lastSegment;
    for (const model of prismaModels) {
      if (
        model.detail.toLowerCase() === singular.toLowerCase() ||
        model.detail.toLowerCase() === lastSegment.toLowerCase()
      ) {
        edges.push({
          source: route.filePath,
          target: model.filePath,
          type: 'cross-boundary',
        });
      }
    }
  }
}

function detectLanguage(filePath: string): Language {
  const ext = filePath.match(/\.[^.]+$/)?.[0] || '';
  return LANGUAGE_EXTENSIONS[ext.toLowerCase()] || 'unknown';
}

function parsePackageJson(content: string): Dependency[] {
  try {
    const pkg = JSON.parse(content);
    const deps: Dependency[] = [];
    
    if (pkg.dependencies) {
      for (const [name, version] of Object.entries(pkg.dependencies)) {
        deps.push({ name, version: version as string, type: 'prod' });
      }
    }
    if (pkg.devDependencies) {
      for (const [name, version] of Object.entries(pkg.devDependencies)) {
        deps.push({ name, version: version as string, type: 'dev' });
      }
    }
    if (pkg.peerDependencies) {
      for (const [name, version] of Object.entries(pkg.peerDependencies)) {
        deps.push({ name, version: version as string, type: 'prod' });
      }
    }
    
    return deps;
  } catch {
    return [];
  }
}

function parseRequirementsTxt(content: string): Dependency[] {
  const deps: Dependency[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue;
    
    const match = trimmed.match(/^([a-zA-Z0-9_-]+)(?:\s*\[.*?\])?(?:\s*==|\s*>=|s<=|s>|s!=|~=)?(.+)?$/);
    if (match) {
      deps.push({ name: match[1], version: match[2], type: 'prod' });
    }
  }
  
  return deps;
}

function parseGoMod(content: string): Dependency[] {
  const deps: Dependency[] = [];
  const lines = content.split('\n');
  let inRequire = false;
  
  for (const line of lines) {
    if (line.trim() === 'require (') {
      inRequire = true;
      continue;
    }
    if (inRequire && line.trim() === ')') {
      inRequire = false;
      continue;
    }
    
    const match = line.match(/^\s+([^\s]+)\s+v?([\d.]+)/);
    if (match) {
      deps.push({ name: match[1], version: match[2], type: 'prod' });
    } else if (!inRequire) {
      const directMatch = line.match(/^([^\s]+)\s+v?([\d.]+)/);
      if (directMatch && !directMatch[1].startsWith('module')) {
        deps.push({ name: directMatch[1], version: directMatch[2], type: 'prod' });
      }
    }
  }
  
  return deps;
}

function parseCargoToml(content: string): Dependency[] {
  const deps: Dependency[] = [];
  const lines = content.split('\n');
  let inDependencies = false;
  let inDevDependencies = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line === '[dependencies]') {
      inDependencies = true;
      inDevDependencies = false;
      continue;
    }
    if (line === '[dev-dependencies]') {
      inDependencies = false;
      inDevDependencies = true;
      continue;
    }
    if (line.startsWith('[')) {
      inDependencies = false;
      inDevDependencies = false;
      continue;
    }
    
    if ((inDependencies || inDevDependencies) && line.includes('=')) {
      const match = line.match(/^([^=]+)\s*=\s*\{?\s*"([^"]+)"?\s*}?/);
      if (match) {
        const type = inDevDependencies ? 'dev' : 'prod';
        deps.push({ name: match[1].trim(), version: match[2].trim(), type });
      } else {
        const simpleMatch = line.match(/^([^=]+)\s*=\s*"([^"]+)"/);
        if (simpleMatch) {
          const type = inDevDependencies ? 'dev' : 'prod';
          deps.push({ name: simpleMatch[1].trim(), version: simpleMatch[2].trim(), type });
        }
      }
    }
  }
  
  return deps;
}

function parseGemfile(content: string): Dependency[] {
  const deps: Dependency[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^\s*gem\s+['"]([^'"]+)['"](?:,\s*['"]([^'"]+)['"])?/);
    if (match) {
      deps.push({ name: match[1], version: match[2], type: 'prod' });
    }
  }
  
  return deps;
}

function parseComposerJson(content: string): Dependency[] {
  try {
    const pkg = JSON.parse(content);
    const deps: Dependency[] = [];
    
    if (pkg.require) {
      for (const [name, version] of Object.entries(pkg.require)) {
        if (name !== 'php' && !name.startsWith('ext-')) {
          deps.push({ name, version: version as string, type: 'prod' });
        }
      }
    }
    if (pkg['require-dev']) {
      for (const [name, version] of Object.entries(pkg['require-dev'])) {
        deps.push({ name, version: version as string, type: 'dev' });
      }
    }
    
    return deps;
  } catch {
    return [];
  }
}

export function parseManifestFile(filePath: string, content: string): Dependency[] {
  const fileName = filePath.split('/').pop() || filePath;
  
  switch (fileName) {
    case 'package.json':
      return parsePackageJson(content);
    case 'requirements.txt':
      return parseRequirementsTxt(content);
    case 'go.mod':
      return parseGoMod(content);
    case 'Cargo.toml':
      return parseCargoToml(content);
    case 'Gemfile':
      return parseGemfile(content);
    case 'composer.json':
      return parseComposerJson(content);
    default:
      return [];
  }
}

export function parseImports(filePath: string, content: string): ImportStatement[] {
  const language = detectLanguage(filePath);
  const patterns = IMPORT_PATTERNS[language] || IMPORT_PATTERNS.unknown;
  const imports: ImportStatement[] = [];
  
  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.source, 'g');
    
    while ((match = regex.exec(content)) !== null) {
      const source = match[1];
      const isLocal = source.startsWith('.') || source.startsWith('/') || source.startsWith('@/');
      
      imports.push({
        source,
        local: isLocal,
        type: detectImportType(content, match.index),
      });
    }
  }
  
  return imports;
}

function detectImportType(content: string, index: number): 'import' | 'require' | 'from' | 'use' | 'include' | 'import.meta' {
  const before = content.substring(Math.max(0, index - 20), index).toLowerCase();
  
  if (before.includes('import.meta')) return 'import.meta';
  if (before.includes('import')) return 'import';
  if (before.includes('require')) return 'require';
  if (before.includes('from')) return 'from';
  if (before.includes('use')) return 'use';
  if (before.includes('include')) return 'include';
  
  return 'import';
}

export function buildDependencyGraph(files: Record<string, string>): DependencyGraph {
  const nodes: DependencyNode[] = [];
  const edges: DependencyEdge[] = [];
  const crossBoundaryCalls: CrossBoundaryCall[] = [];
  const languagesSet = new Set<Language>();
  const fileLanguageMap = new Map<string, Language>();
  const allASTNodes: ASTNode[] = [];
  
  const filePaths = Object.keys(files);
  
  for (const filePath of filePaths) {
    const content = files[filePath];
    const language = detectLanguage(filePath);
    languagesSet.add(language);
    fileLanguageMap.set(filePath, language);
    
    const deps: string[] = [];
    
    if (filePath.endsWith('package.json')) {
      const manifestDeps = parseManifestFile(filePath, content);
      for (const dep of manifestDeps) {
        deps.push(dep.name);
      }
    }
    
    const imports = parseImports(filePath, content);
    for (const imp of imports) {
      if (imp.local) {
        const targetFile = resolveLocalImport(filePath, imp.source, filePaths);
        if (targetFile) {
          edges.push({
            source: filePath,
            target: targetFile,
            type: 'import',
          });
          
          const sourceLang = fileLanguageMap.get(filePath);
          const targetLang = fileLanguageMap.get(targetFile);
          
          if (sourceLang && targetLang && sourceLang !== targetLang) {
            crossBoundaryCalls.push({
              sourceFile: filePath,
              targetFile: targetFile,
              type: detectCrossBoundaryType(imp.source, content),
            });
          }
        }
      } else {
        deps.push(imp.source);
        edges.push({
          source: filePath,
          target: imp.source,
          type: 'dependency',
        });
      }
    }
    
    // Extract AST-level nodes (fetch calls, routes, types, models, tables)
    const fileASTNodes = extractASTNodes(filePath, content);
    allASTNodes.push(...fileASTNodes);
    
    nodes.push({
      id: filePath,
      name: filePath.split('/').pop() || filePath,
      language,
      filePath,
      dependencies: [...new Set(deps)],
    });
  }
  
  // Infer logical cross-language edges from AST nodes
  inferLogicalEdges(allASTNodes, edges);
  
  // Deduplicate edges
  const edgeKeys = new Set<string>();
  const uniqueEdges: DependencyEdge[] = [];
  for (const edge of edges) {
    const key = `${edge.source}|${edge.target}|${edge.type}`;
    if (!edgeKeys.has(key)) {
      edgeKeys.add(key);
      uniqueEdges.push(edge);
    }
  }
  
  // Also record cross-boundary calls for the inferred edges
  for (const astEdge of uniqueEdges) {
    if (astEdge.type === 'cross-boundary') {
      const sourceLang = fileLanguageMap.get(astEdge.source);
      const targetLang = fileLanguageMap.get(astEdge.target);
      if (sourceLang && targetLang && sourceLang !== targetLang) {
        const alreadyExists = crossBoundaryCalls.some(
          c => c.sourceFile === astEdge.source && c.targetFile === astEdge.target
        );
        if (!alreadyExists) {
          crossBoundaryCalls.push({
            sourceFile: astEdge.source,
            targetFile: astEdge.target,
            type: 'api',
          });
        }
      }
    }
  }
  
  return {
    nodes,
    edges: uniqueEdges,
    languages: Array.from(languagesSet),
    crossBoundaryCalls,
  };
}

function normalizeFsPath(p: string): string {
  // Resolve . and .. segments in a path like /src/components/./Button => /src/components/Button
  const parts = p.split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '.' || part === '') {
      if (resolved.length === 0) resolved.push(''); // preserve leading /
      continue;
    }
    if (part === '..') {
      if (resolved.length > 1) resolved.pop();
      continue;
    }
    resolved.push(part);
  }
  return resolved.join('/') || '/';
}

function resolveLocalImport(importPath: string, source: string, filePaths: string[]): string | null {
  // Get the directory of the importing file
  const lastSlash = importPath.lastIndexOf('/');
  const baseDir = lastSlash >= 0 ? importPath.substring(0, lastSlash) : '';
  
  // Handle @/ alias (Next.js convention) — maps to project root /
  let resolvedSource = source;
  if (source.startsWith('@/')) {
    resolvedSource = '/' + source.slice(2);
  }
  
  // Build the full resolved path
  let fullPath: string;
  if (resolvedSource.startsWith('/')) {
    fullPath = resolvedSource;
  } else {
    // Relative path: join with baseDir
    fullPath = normalizeFsPath(`${baseDir}/${resolvedSource}`);
  }
  
  // Generate candidates with various extensions and index files
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  const candidates: string[] = [fullPath];
  for (const ext of extensions) {
    candidates.push(`${fullPath}${ext}`);
    candidates.push(`${fullPath}/index${ext}`);
  }
  
  // Also try without leading slash in case file paths don't have one
  const withoutLeadingSlash = fullPath.startsWith('/') ? fullPath.slice(1) : fullPath;
  candidates.push(withoutLeadingSlash);
  for (const ext of extensions) {
    candidates.push(`${withoutLeadingSlash}${ext}`);
    candidates.push(`${withoutLeadingSlash}/index${ext}`);
  }
  
  for (const candidate of candidates) {
    if (filePaths.includes(candidate)) {
      return candidate;
    }
  }
  
  return null;
}

function detectCrossBoundaryType(source: string, content: string): 'api' | 'schema' | 'function' | 'variable' {
  const lowerSource = source.toLowerCase();
  
  if (lowerSource.includes('api') || lowerSource.includes('endpoint') || lowerSource.includes('route')) {
    return 'api';
  }
  if (lowerSource.includes('schema') || lowerSource.includes('type') || lowerSource.includes('model') || lowerSource.includes('interface')) {
    return 'schema';
  }
  if (lowerSource.includes('hook') || lowerSource.includes('use') || lowerSource.includes('function')) {
    return 'function';
  }
  
  return 'variable';
}

export function analyzeImpact(
  graph: DependencyGraph,
  changedFile: string
): { affectedFiles: string[]; impactLevel: 'low' | 'medium' | 'high' } {
  const affected = new Set<string>();
  const visited = new Set<string>();
  
  function traverse(filePath: string) {
    if (visited.has(filePath)) return;
    visited.add(filePath);
    
    for (const edge of graph.edges) {
      if (edge.source === filePath) {
        if (edge.type === 'import' || edge.type === 'cross-boundary') {
          affected.add(edge.target);
          traverse(edge.target);
        }
      }
    }
  }
  
  traverse(changedFile);
  
  const crossBoundaryAffected = graph.crossBoundaryCalls.filter(
    call => affected.has(call.sourceFile) || affected.has(call.targetFile)
  ).length;
  
  let impactLevel: 'low' | 'medium' | 'high' = 'low';
  if (crossBoundaryAffected > 5 || affected.size > 10) {
    impactLevel = 'high';
  } else if (crossBoundaryAffected > 2 || affected.size > 5) {
    impactLevel = 'medium';
  }
  
  return {
    affectedFiles: Array.from(affected),
    impactLevel,
  };
}

export function getLanguageColor(language: Language): string {
  const colors: Record<Language, string> = {
    javascript: '#f7df1e',
    typescript: '#3178c6',
    python: '#3776ab',
    go: '#00add8',
    rust: '#dea584',
    java: '#b07219',
    cpp: '#f34b7d',
    csharp: '#178600',
    ruby: '#cc342d',
    php: '#777bb4',
    unknown: '#808080',
  };
  
  return colors[language];
}

export function getLanguageStats(graph: DependencyGraph): Record<Language, number> {
  const stats: Record<Language, number> = {
    javascript: 0,
    typescript: 0,
    python: 0,
    go: 0,
    rust: 0,
    java: 0,
    cpp: 0,
    csharp: 0,
    ruby: 0,
    php: 0,
    unknown: 0,
  };
  
  for (const node of graph.nodes) {
    stats[node.language]++;
  }
  
  return stats;
}
