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
  '.go': 'rust', 
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
      const isLocal = source.startsWith('.') || source.startsWith('/');
      
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
    
    nodes.push({
      id: filePath,
      name: filePath.split('/').pop() || filePath,
      language,
      filePath,
      dependencies: [...new Set(deps)],
    });
  }
  
  return {
    nodes,
    edges,
    languages: Array.from(languagesSet),
    crossBoundaryCalls,
  };
}

function resolveLocalImport(importPath: string, source: string, filePaths: string[]): string | null {
  const baseDir = importPath.substring(0, importPath.lastIndexOf('/') + 1);
  
  const candidates = [
    source,
    `${source}.ts`,
    `${source}.tsx`,
    `${source}.js`,
    `${source}.jsx`,
    `${source}/index.ts`,
    `${source}/index.tsx`,
    `${source}/index.js`,
    `${source}/index.jsx`,
    `${baseDir}${source}`,
    `${baseDir}${source}.ts`,
    `${baseDir}${source}.tsx`,
    `${baseDir}${source}.js`,
    `${baseDir}${source}.jsx`,
    `${baseDir}${source}/index.ts`,
    `${baseDir}${source}/index.tsx`,
    `${baseDir}${source}/index.js`,
    `${baseDir}${source}/index.jsx`,
  ];
  
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
