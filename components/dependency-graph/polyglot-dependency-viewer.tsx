'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Globe,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import * as d3 from 'd3';

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
  fetch_call: '#fbbf24',
  axios_call: '#eab308',
  api_route: '#22c55e',
  go_handler: '#06b6d4',
  exported_type: '#3b82f6',
  go_struct: '#22d3ee',
  sql_table: '#a855f7',
  prisma_model: '#ec4899',
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

const languageColors: Record<string, string> = {
  typescript: '#3178c6',
  go: '#00add8',
  python: '#3776ab',
  sql: '#336791',
  prisma: '#2d3748',
};

const languageIcons: Record<string, React.ReactNode> = {
  typescript: <Globe className="h-3 w-3" />,
  go: <Server className="h-3 w-3" />,
  python: <Zap className="h-3 w-3" />,
  sql: <Database className="h-3 w-3" />,
  prisma: <Database className="h-3 w-3" />,
};

function FlowChart({ 
  data, 
  onNodeClick 
}: { 
  data: GraphData; 
  onNodeClick: (node: GraphNode) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data.nodes.length) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g');

    const defs = svg.append('defs');
    
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 28)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 7)
      .attr('markerHeight', 7)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#94a3b8');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const simulation = d3.forceSimulation(data.nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(data.links)
        .id((d: any) => d.id)
        .distance(150)
        .strength(0.4))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(70))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05));

    const link = g.append('g')
      .selectAll('line')
      .data(data.links)
      .enter()
      .append('line')
      .attr('stroke', '#64748b')
      .attr('stroke-width', 2.5)
      .attr('opacity', 0.7)
      .attr('marker-end', 'url(#arrowhead)');

    const node = g.append('g')
      .selectAll('g')
      .data(data.nodes)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        onNodeClick(d);
      })
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    node.append('circle')
      .attr('r', 35)
      .attr('fill', (d) => kindColors[d.kind] || '#6b7280')
      .attr('stroke', (d) => languageColors[d.language] || '#374151')
      .attr('stroke-width', 3)
      .attr('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))');

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 52)
      .attr('font-size', '11px')
      .attr('fill', '#e2e8f0')
      .attr('font-weight', '500')
      .text((d) => d.label.length > 14 ? d.label.slice(0, 14) + '...' : d.label);

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 5)
      .attr('font-size', '10px')
      .attr('fill', '#1f2937')
      .attr('font-weight', 'bold')
      .text((d) => kindLabels[d.kind] || d.kind);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    let currentZoom = zoom;

    const handleZoomIn = () => {
      svg.transition().duration(300).call(zoom.scaleBy, 1.3);
    };

    const handleZoomOut = () => {
      svg.transition().duration(300).call(zoom.scaleBy, 0.7);
    };

    const handleReset = () => {
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    };

    const zoomInBtn = document.getElementById('flow-zoom-in');
    const zoomOutBtn = document.getElementById('flow-zoom-out');
    const resetBtn = document.getElementById('flow-zoom-reset');

    if (zoomInBtn) zoomInBtn.onclick = handleZoomIn;
    if (zoomOutBtn) zoomOutBtn.onclick = handleZoomOut;
    if (resetBtn) resetBtn.onclick = handleReset;

    return () => {
      simulation.stop();
    };
  }, [data, onNodeClick]);

  return (
    <div ref={containerRef} className="relative w-full h-[500px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-lg overflow-hidden border border-slate-700">
      <svg ref={svgRef} className="w-full h-full" />
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <Button id="flow-zoom-in" variant="outline" className="bg-slate-800/90 border-slate-600 hover:bg-slate-700 w-8 h-8 p-0" style={{ width: '32px', height: '32px', padding: 0 }}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button id="flow-zoom-out" variant="outline" className="bg-slate-800/90 border-slate-600 hover:bg-slate-700 w-8 h-8 p-0" style={{ width: '32px', height: '32px', padding: 0 }}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button id="flow-zoom-reset" variant="outline" className="bg-slate-800/90 border-slate-600 hover:bg-slate-700 w-8 h-8 p-0" style={{ width: '32px', height: '32px', padding: 0 }}>
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function PolyglotDependencyViewer({ projectRoot, onFileSelect }: PolyglotDependencyViewerProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [impact, setImpact] = useState<ImpactResult | null>(null);
  const [filterKind, setFilterKind] = useState<string | null>(null);
  const [filterLanguage, setFilterLanguage] = useState<string | null>(null);
  const [showFlowChart, setShowFlowChart] = useState(true);

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

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    analyzeImpact(node.id);
    onFileSelect?.(node.filePath, node.line);
  }, [onFileSelect]);

  const filteredData: GraphData = {
    nodes: filteredNodes,
    links: filteredLinks,
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
            <div className="flex gap-2">
              <Button 
                variant={showFlowChart ? 'primary' : 'outline'} 
                size="sm"
                onClick={() => setShowFlowChart(!showFlowChart)}
              >
                {showFlowChart ? 'List View' : 'Flow Chart'}
              </Button>
              <Button onClick={fetchGraph} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
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
                onClick={() => setFilterKind(filterKind === kind ? null : kind)}
                style={filterKind !== kind ? { backgroundColor: kindColors[kind], color: '#1f2937' } : undefined}
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
                onClick={() => setFilterLanguage(filterLanguage === lang ? null : lang)}
              >
                {languageIcons[lang]}
                <span className="ml-1">{lang}</span>
              </Button>
            ))}
          </div>

          {showFlowChart && graphData && graphData.nodes.length > 0 ? (
            <FlowChart data={filteredData} onNodeClick={handleNodeClick} />
          ) : (
            <ScrollArea className="h-[250px] w-full rounded-md border p-4">
              <div className="flex flex-wrap gap-2">
                {filteredNodes.map(node => (
                  <div
                    key={node.id}
                    className={`
                      flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer
                      border-2 transition-all hover:scale-105
                      ${selectedNode?.id === node.id ? 'border-blue-500' : 'border-transparent'}
                    `}
                    style={{ backgroundColor: kindColors[node.kind] || '#6b7280' }}
                    onClick={() => handleNodeClick(node)}
                    title={`${node.filePath}:${node.line}`}
                  >
                    {languageIcons[node.language]}
                    <span className="text-xs font-medium max-w-[100px] truncate text-black">
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
          )}
        </CardContent>
      </Card>

      {filteredLinks.length > 0 && !showFlowChart && (
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
                      <span 
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: kindColors[sourceNode.kind], color: '#1f2937' }}
                      >
                        {sourceNode.label}
                      </span>
                      <ArrowRight className="h-3 w-3" />
                      <span 
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: kindColors[targetNode.kind], color: '#1f2937' }}
                      >
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

      {selectedNode && (
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
              <p className="text-sm font-medium">Selected: {selectedNode.label}</p>
              <p className="text-xs text-muted-foreground">
                {selectedNode.filePath}:{selectedNode.line}
              </p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Affected Components ({impact?.affectedNodes.length || 0}):
              </p>
              <ScrollArea className="h-[120px] w-full rounded-md border p-2">
                <div className="flex flex-wrap gap-1">
                  {impact?.affectedNodes.map(node => (
                    <Badge
                      key={node.id}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => onFileSelect?.(node.filePath, node.line)}
                    >
                      {kindLabels[node.kind] || node.kind}: {node.label}
                    </Badge>
                  ))}
                  {(!impact?.affectedNodes || impact.affectedNodes.length === 0) && (
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
