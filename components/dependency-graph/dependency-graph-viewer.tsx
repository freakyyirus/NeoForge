'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Network, 
  AlertTriangle, 
  ArrowRight, 
  FileCode, 
  Package,
  RefreshCw,
  Layers,
  GitBranch,
  X
} from 'lucide-react';

interface DependencyNode {
  id: string;
  name: string;
  language: string;
  filePath: string;
  dependencies: string[];
}

interface DependencyEdge {
  source: string;
  target: string;
  type: 'dependency' | 'import' | 'cross-boundary';
}

interface CrossBoundaryCall {
  sourceFile: string;
  targetFile: string;
  type: 'api' | 'schema' | 'function' | 'variable';
}

interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  languages: string[];
  crossBoundaryCalls: CrossBoundaryCall[];
}

interface ImpactAnalysis {
  affectedFiles: string[];
  impactLevel: 'low' | 'medium' | 'high';
}

interface DependencyGraphViewerProps {
  files: Record<string, string>;
  projectId?: string;
  onFileSelect?: (filePath: string) => void;
}

const languageColors: Record<string, string> = {
  javascript: 'bg-yellow-400 text-black',
  typescript: 'bg-blue-500 text-white',
  python: 'bg-blue-400 text-white',
  go: 'bg-cyan-400 text-black',
  rust: 'bg-orange-400 text-black',
  java: 'bg-orange-600 text-white',
  cpp: 'bg-pink-400 text-white',
  csharp: 'bg-green-600 text-white',
  ruby: 'bg-red-400 text-white',
  php: 'bg-purple-400 text-white',
  unknown: 'bg-gray-400 text-white',
};

const languageLabels: Record<string, string> = {
  javascript: 'JS',
  typescript: 'TS',
  python: 'PY',
  go: 'GO',
  rust: 'RS',
  java: 'JAVA',
  cpp: 'C++',
  csharp: 'C#',
  ruby: 'RB',
  php: 'PHP',
  unknown: '?',
};

export function DependencyGraphViewer({ files, projectId, onFileSelect }: DependencyGraphViewerProps) {
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [languageStats, setLanguageStats] = useState<Record<string, number>>({});
  const [impact, setImpact] = useState<ImpactAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [filterLanguage, setFilterLanguage] = useState<string | null>(null);
  const [showCrossBoundary, setShowCrossBoundary] = useState(true);

  const analyzeGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/dependency-graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze dependencies');
      }
      
      const data = await response.json();
      setGraph(data.graph);
      setLanguageStats(data.languageStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [files]);

  useEffect(() => {
    analyzeGraph();
  }, [analyzeGraph]);

  const analyzeImpact = async (filePath: string) => {
    try {
      const response = await fetch('/api/dependency-graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, analyzeFile: filePath }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setImpact(data.impact);
      }
    } catch (err) {
      console.error('Impact analysis failed:', err);
    }
  };

  const filteredNodes = graph?.nodes.filter(node => 
    !filterLanguage || node.language === filterLanguage
  ) || [];

  const filteredEdges = graph?.edges.filter(edge => {
    if (!showCrossBoundary && edge.type === 'cross-boundary') return false;
    if (filterLanguage) {
      const sourceNode = graph.nodes.find(n => n.id === edge.source);
      const targetNode = graph.nodes.find(n => n.id === edge.target);
      return sourceNode?.language === filterLanguage || targetNode?.language === filterLanguage;
    }
    return true;
  }) || [];

  const crossBoundaryCalls = graph?.crossBoundaryCalls || [];

  const getImpactColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="h-8 w-8 animate-spin" />
            <p className="text-sm text-muted-foreground">Analyzing dependencies...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex flex-col items-center gap-2 text-red-500">
            <AlertTriangle className="h-8 w-8" />
            <p>{error}</p>
            <Button onClick={analyzeGraph} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Network className="h-5 w-5" />
              Dependency Graph
            </CardTitle>
            <Button onClick={analyzeGraph} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant={filterLanguage === null ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilterLanguage(null)}
            >
              All ({graph?.nodes.length || 0})
            </Button>
              {graph?.languages.map(lang => (
                <Button
                  key={lang}
                  variant={filterLanguage === lang ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setFilterLanguage(lang === filterLanguage ? null : lang)}
                >
                {languageLabels[lang] || lang} ({languageStats[lang] || 0})
              </Button>
            ))}
          </div>
          
          <div className="flex items-center gap-2 mb-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showCrossBoundary}
                onChange={(e) => setShowCrossBoundary(e.target.checked)}
                className="rounded"
              />
              Show cross-language edges
            </label>
          </div>

          <ScrollArea className="h-[300px] w-full rounded-md border p-4">
            <div className="flex flex-wrap gap-2">
              {filteredNodes.map(node => (
                <div
                  key={node.id}
                  className={`
                    flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer
                    border-2 transition-all hover:scale-105
                    ${selectedNode === node.id ? 'border-blue-500' : 'border-transparent'}
                    ${languageColors[node.language] || 'bg-gray-400'}
                  `}
                  onClick={() => {
                    setSelectedNode(node.id);
                    analyzeImpact(node.id);
                    onFileSelect?.(node.id);
                  }}
                >
                  <FileCode className="h-3 w-3" />
                  <span className="text-xs font-medium max-w-[120px] truncate">
                    {node.name}
                  </span>
                </div>
              ))}
            </div>
            
            {filteredEdges.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">
                  {filteredEdges.length} connections
                </p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {crossBoundaryCalls.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <GitBranch className="h-5 w-5" />
              Cross-Language Dependencies
              <Badge variant="secondary">{crossBoundaryCalls.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] w-full">
              <div className="space-y-2">
                {crossBoundaryCalls.map((call, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm"
                  >
                    <span className={languageColors[call.sourceFile.split('.').pop() || 'unknown']}>
                      {call.sourceFile.split('/').pop()}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                    <span className={languageColors[call.targetFile.split('.').pop() || 'unknown']}>
                      {call.targetFile.split('/').pop()}
                    </span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {call.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {selectedNode && impact && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5" />
                Impact Analysis
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedNode(null);
                  setImpact(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm">Impact Level:</span>
              <span className={`px-2 py-1 rounded text-white text-xs ${getImpactColor(impact.impactLevel)}`}>
                {impact.impactLevel.toUpperCase()}
              </span>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium">Affected Files ({impact.affectedFiles.length}):</p>
              <ScrollArea className="h-[150px] w-full rounded-md border p-2">
                <div className="flex flex-wrap gap-1">
                  {impact.affectedFiles.map(file => (
                    <Badge
                      key={file}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => onFileSelect?.(file)}
                    >
                      {file.split('/').pop()}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="h-5 w-5" />
            Project Languages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {graph?.languages.map(lang => (
              <div
                key={lang}
                className={`p-2 rounded ${languageColors[lang] || 'bg-gray-400'}`}
              >
                <div className="text-xs font-bold">{lang}</div>
                <div className="text-lg font-bold">{languageStats[lang] || 0}</div>
                <div className="text-xs">files</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function DependencyBadge({ language }: { language: string }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${languageColors[language] || 'bg-gray-400 text-white'}`}>
      {languageLabels[language] || language}
    </span>
  );
}

export function DependencyList({ 
  dependencies, 
  type = 'prod' 
}: { 
  dependencies: string[];
  type?: 'prod' | 'dev' | 'import';
}) {
  const typeColors = {
    prod: 'bg-green-500',
    dev: 'bg-yellow-500',
    import: 'bg-blue-500',
  };

  return (
    <div className="flex flex-wrap gap-1">
      {dependencies.slice(0, 10).map((dep, idx) => (
        <Badge key={idx} variant="secondary" className={`${typeColors[type]} text-white`}>
          <Package className="h-3 w-3 mr-1" />
          {dep}
        </Badge>
      ))}
      {dependencies.length > 10 && (
        <Badge variant="secondary">+{dependencies.length - 10} more</Badge>
      )}
    </div>
  );
}
