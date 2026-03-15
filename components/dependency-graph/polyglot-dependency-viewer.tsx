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
  RefreshCw,
  Layers,
  GitBranch,
  X,
  Zap,
  Database,
  Server,
  Globe
} from 'lucide-react';

interface GraphNode {
  id: string;
  label: string;
  kind: string;
  language: string;
  filePath: string;
  line: number;
}

interface GraphLink {
  source: string;
  target: string;
  relation: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface ImpactResult {
  changedNode: GraphNode;
  affectedNodes: GraphNode[];
}

interface PolyglotDependencyViewerProps {
  projectRoot?: string;
  onFileSelect?: (filePath: string, line?: number) => void;
}

const kindColors: Record<string, string> = {
  fetch_call: 'bg-yellow-400 text-black',
  axios_call: 'bg-yellow-500 text-black',
  api_route: 'bg-green-500 text-white',
  go_handler: 'bg-cyan-500 text-white',
  exported_type: 'bg-blue-500 text-white',
  go_struct: 'bg-cyan-400 text-black',
  sql_table: 'bg-purple-500 text-white',
  prisma_model: 'bg-pink-500 text-white',
};

const kindLabels: Record<string, string> = {
  fetch_call: 'Fetch',
  axios_call: 'Axios',
  api_route: 'Route',
  go_handler: 'Go Handler',
  exported_type: 'Type',
  go_struct: 'Struct',
  sql_table: 'Table',
  prisma_model: 'Model',
};

const languageIcons: Record<string, React.ReactNode> = {
  typescript: <Globe className="h-3 w-3" />,
  go: <Server className="h-3 w-3" />,
  python: <Zap className="h-3 w-3" />,
  sql: <Database className="h-3 w-3" />,
  prisma: <Database className="h-3 w-3" />,
};

export function PolyglotDependencyViewer({ projectRoot, onFileSelect }: PolyglotDependencyViewerProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [impact, setImpact] = useState<ImpactResult | null>(null);
  const [filterKind, setFilterKind] = useState<string | null>(null);
  const [filterLanguage, setFilterLanguage] = useState<string | null>(null);

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/dependencies/graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectRoot: projectRoot || '.', format: 'd3' }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch dependency graph');
      }
      
      const data = await response.json();
      setGraphData(data.graph);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [projectRoot]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const analyzeImpact = async (nodeId: string) => {
    try {
      const response = await fetch('/api/dependencies/impact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectRoot: projectRoot || '.', nodeId }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setImpact(data);
      }
    } catch (err) {
      console.error('Impact analysis failed:', err);
    }
  };

  const filteredNodes = graphData?.nodes.filter(node => {
    if (filterKind && node.kind !== filterKind) return false;
    if (filterLanguage && node.language !== filterLanguage) return false;
    return true;
  }) || [];

  const filteredLinks = graphData?.links.filter(link => {
    const sourceNode = graphData.nodes.find(n => n.id === link.source);
    const targetNode = graphData.nodes.find(n => n.id === link.target);
    if (!sourceNode || !targetNode) return false;
    if (filterKind && (sourceNode.kind !== filterKind && targetNode.kind !== filterKind)) return false;
    if (filterLanguage && (sourceNode.language !== filterLanguage && targetNode.language !== filterLanguage)) return false;
    return true;
  }) || [];

  const allKinds = [...new Set(graphData?.nodes.map(n => n.kind) || [])];
  const allLanguages = [...new Set(graphData?.nodes.map(n => n.language) || [])];

  const relationLabels: Record<string, string> = {
    calls: 'calls',
    implements: 'implements',
    queries: 'queries',
    defines: 'defines',
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="h-8 w-8 animate-spin" />
            <p className="text-sm text-muted-foreground">Analyzing cross-language dependencies...</p>
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
            <Button onClick={fetchGraph} variant="outline" size="sm">
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
              Polyglot Dependency Graph
            </CardTitle>
            <Button onClick={fetchGraph} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant={filterKind === null ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilterKind(null)}
            >
              All ({graphData?.nodes.length || 0})
            </Button>
            {allKinds.map(kind => (
              <Button
                key={kind}
                variant={filterKind === kind ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilterKind(kind === filterKind ? null : kind)}
                className={filterKind === kind ? '' : kindColors[kind] || ''}
              >
                {kindLabels[kind] || kind}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {allLanguages.map(lang => (
              <Button
                key={lang}
                variant={filterLanguage === lang ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilterLanguage(lang === filterLanguage ? null : lang)}
              >
                {languageIcons[lang]}
                <span className="ml-1">{lang}</span>
              </Button>
            ))}
          </div>

          <ScrollArea className="h-[250px] w-full rounded-md border p-4">
            <div className="flex flex-wrap gap-2">
              {filteredNodes.map(node => (
                <div
                  key={node.id}
                  className={`
                    flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer
                    border-2 transition-all hover:scale-105
                    ${selectedNode === node.id ? 'border-blue-500' : 'border-transparent'}
                    ${kindColors[node.kind] || 'bg-gray-400'}
                  `}
                  onClick={() => {
                    setSelectedNode(node.id);
                    analyzeImpact(node.id);
                    onFileSelect?.(node.filePath, node.line);
                  }}
                  title={`${node.filePath}:${node.line}`}
                >
                  {languageIcons[node.language]}
                  <span className="text-xs font-medium max-w-[100px] truncate">
                    {node.label}
                  </span>
                </div>
              ))}
            </div>
            
            {filteredLinks.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  {filteredLinks.length} connections
                </p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {filteredLinks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <GitBranch className="h-5 w-5" />
              Cross-Language Dependencies
              <Badge variant="secondary">{filteredLinks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[180px] w-full">
              <div className="space-y-1">
                {filteredLinks.slice(0, 50).map((link, idx) => {
                  const sourceNode = graphData?.nodes.find(n => n.id === link.source);
                  const targetNode = graphData?.nodes.find(n => n.id === link.target);
                  if (!sourceNode || !targetNode) return null;
                  
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm cursor-pointer hover:bg-muted"
                      onClick={() => {
                        onFileSelect?.(sourceNode.filePath, sourceNode.line);
                      }}
                    >
                      <span className={kindColors[sourceNode.kind] || 'bg-gray-400'}>
                        {sourceNode.label}
                      </span>
                      <ArrowRight className="h-3 w-3" />
                      <span className={kindColors[targetNode.kind] || 'bg-gray-400'}>
                        {targetNode.label}
                      </span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {relationLabels[link.relation] || link.relation}
                      </Badge>
                    </div>
                  );
                })}
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
            <div className="mb-4">
              <p className="text-sm font-medium">Analyzing: {impact.changedNode.label}</p>
              <p className="text-xs text-muted-foreground">
                {impact.changedNode.filePath}:{impact.changedNode.line}
              </p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Affected Components ({impact.affectedNodes.length}):
              </p>
              <ScrollArea className="h-[120px] w-full rounded-md border p-2">
                <div className="flex flex-wrap gap-1">
                  {impact.affectedNodes.map(node => (
                    <Badge
                      key={node.id}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => onFileSelect?.(node.filePath, node.line)}
                    >
                      {kindLabels[node.kind] || node.kind}: {node.label}
                    </Badge>
                  ))}
                  {impact.affectedNodes.length === 0 && (
                    <p className="text-xs text-muted-foreground">No affected components</p>
                  )}
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {allLanguages.map(lang => {
              const count = graphData?.nodes.filter(n => n.language === lang).length || 0;
              return (
                <div
                  key={lang}
                  className="flex items-center gap-2 p-2 rounded bg-muted"
                >
                  {languageIcons[lang]}
                  <div>
                    <div className="text-sm font-bold">{lang}</div>
                    <div className="text-xs text-muted-foreground">{count} nodes</div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Graph Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded bg-muted">
              <div className="text-2xl font-bold">{graphData?.nodes.length || 0}</div>
              <div className="text-xs text-muted-foreground">Total Nodes</div>
            </div>
            <div className="p-3 rounded bg-muted">
              <div className="text-2xl font-bold">{graphData?.links.length || 0}</div>
              <div className="text-xs text-muted-foreground">Total Edges</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
