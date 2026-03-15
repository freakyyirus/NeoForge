'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Network, 
  RefreshCw, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  Filter,
  Eye,
  EyeOff,
  Server,
  Database,
  Globe,
  Code,
  ArrowRight,
  X
} from 'lucide-react';

interface GraphNode {
  id: string;
  label: string;
  kind: string;
  language: string;
  filePath: string;
  line: number;
  members?: string[];
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  relation: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface D3DependencyGraphProps {
  projectRoot?: string;
  files?: Record<string, string>;
  onNodeClick?: (node: GraphNode) => void;
  height?: number;
}

function buildDAGGraph(graph: GraphData): GraphData {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, string[]>();

  for (const node of graph.nodes) {
    adjacency.set(node.id, []);
  }

  for (const link of graph.links) {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    if (!nodeById.has(sourceId) || !nodeById.has(targetId)) continue;
    adjacency.get(sourceId)?.push(targetId);
  }

  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const components: string[][] = [];

  const strongConnect = (id: string) => {
    indices.set(id, index);
    lowlinks.set(id, index);
    index += 1;
    stack.push(id);
    onStack.add(id);

    const neighbors = adjacency.get(id) || [];
    for (const neighbor of neighbors) {
      if (!indices.has(neighbor)) {
        strongConnect(neighbor);
        lowlinks.set(id, Math.min(lowlinks.get(id)!, lowlinks.get(neighbor)!));
      } else if (onStack.has(neighbor)) {
        lowlinks.set(id, Math.min(lowlinks.get(id)!, indices.get(neighbor)!));
      }
    }

    if (lowlinks.get(id) === indices.get(id)) {
      const component: string[] = [];
      while (stack.length > 0) {
        const member = stack.pop()!;
        onStack.delete(member);
        component.push(member);
        if (member === id) break;
      }
      components.push(component);
    }
  };

  for (const node of graph.nodes) {
    if (!indices.has(node.id)) {
      strongConnect(node.id);
    }
  }

  const componentByNode = new Map<string, number>();
  components.forEach((component, componentIndex) => {
    for (const member of component) {
      componentByNode.set(member, componentIndex);
    }
  });

  const dagNodes: GraphNode[] = components.map((component, componentIndex) => {
    const members = component.map((id) => nodeById.get(id)).filter(Boolean) as GraphNode[];
    const first = members[0];
    const isCycle = members.length > 1;

    const uniqueKinds = new Set(members.map((m) => m.kind));
    const uniqueLanguages = new Set(members.map((m) => m.language));

    return {
      id: `scc-${componentIndex}`,
      label: isCycle ? `Cycle (${members.length})` : first?.label || `Node ${componentIndex + 1}`,
      kind: uniqueKinds.size === 1 ? members[0].kind : 'mixed',
      language: uniqueLanguages.size === 1 ? members[0].language : 'mixed',
      filePath: isCycle
        ? `${members.length} files collapsed`
        : first?.filePath || `component-${componentIndex}`,
      line: first?.line || 1,
      members: members.map((m) => m.filePath),
    };
  });

  const edgeKeyToRelation = new Map<string, string>();
  for (const link of graph.links) {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    const sourceComponent = componentByNode.get(sourceId);
    const targetComponent = componentByNode.get(targetId);

    if (sourceComponent === undefined || targetComponent === undefined) continue;
    if (sourceComponent === targetComponent) continue;

    const key = `${sourceComponent}->${targetComponent}`;
    if (!edgeKeyToRelation.has(key)) {
      edgeKeyToRelation.set(key, link.relation || 'dependency');
    }
  }

  const dagLinks: GraphLink[] = Array.from(edgeKeyToRelation.entries()).map(([key, relation]) => {
    const [sourceComponent, targetComponent] = key.split('->');
    return {
      source: `scc-${sourceComponent}`,
      target: `scc-${targetComponent}`,
      relation,
    };
  });

  return {
    nodes: dagNodes,
    links: dagLinks,
  };
}

const kindConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  fetch_call: { color: '#fbbf24', icon: <Globe className="w-3 h-3" />, label: 'Fetch' },
  axios_call: { color: '#f59e0b', icon: <Globe className="w-3 h-3" />, label: 'Axios' },
  api_route: { color: '#22c55e', icon: <Server className="w-3 h-3" />, label: 'API Route' },
  go_handler: { color: '#06b6d4', icon: <Server className="w-3 h-3" />, label: 'Go Handler' },
  exported_type: { color: '#3b82f6', icon: <Code className="w-3 h-3" />, label: 'Type' },
  go_struct: { color: '#14b8a6', icon: <Code className="w-3 h-3" />, label: 'Struct' },
  sql_table: { color: '#a855f7', icon: <Database className="w-3 h-3" />, label: 'SQL Table' },
  prisma_model: { color: '#ec4899', icon: <Database className="w-3 h-3" />, label: 'Prisma Model' },
  typescript: { color: '#2563eb', icon: <Code className="w-3 h-3" />, label: 'TypeScript' },
  javascript: { color: '#facc15', icon: <Code className="w-3 h-3" />, label: 'JavaScript' },
  python: { color: '#0ea5e9', icon: <Code className="w-3 h-3" />, label: 'Python' },
  go: { color: '#06b6d4', icon: <Code className="w-3 h-3" />, label: 'Go' },
  sql: { color: '#a855f7', icon: <Database className="w-3 h-3" />, label: 'SQL' },
  prisma: { color: '#ec4899', icon: <Database className="w-3 h-3" />, label: 'Prisma' },
};

const relationColors: Record<string, string> = {
  calls: '#22c55e',
  implements: '#3b82f6',
  queries: '#f59e0b',
  defines: '#a855f7',
  dependency: '#64748b',
  import: '#3b82f6',
  'cross-boundary': '#ef4444',
};

export function D3DependencyGraph({ projectRoot, files, onNodeClick, height = 500 }: D3DependencyGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [filterKind, setFilterKind] = useState<Set<string>>(new Set());
  const [showLegend, setShowLegend] = useState(true);
  const [graphMode, setGraphMode] = useState<'full' | 'dag'>('full');
  const simulationRef = useRef<any>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const renderedGraphData = useMemo(() => {
    if (!graphData) return null;
    return graphMode === 'dag' ? buildDAGGraph(graphData) : graphData;
  }, [graphData, graphMode]);

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const hasWorkspaceFiles = Boolean(files && Object.keys(files).length > 0);
      const response = await fetch(hasWorkspaceFiles ? '/api/dependency-graph' : '/api/dependencies/graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: hasWorkspaceFiles
          ? JSON.stringify({ files })
          : JSON.stringify({ projectRoot: projectRoot || '.', format: 'd3' }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch dependency graph');
      }
      
      const data = await response.json();

      if (hasWorkspaceFiles) {
        const legacyGraph = data.graph || { nodes: [], edges: [] };
        const normalized: GraphData = {
          nodes: (legacyGraph.nodes || []).map((node: any) => ({
            id: node.id,
            label: node.name || node.id,
            kind: (node.language || 'unknown').toLowerCase(),
            language: node.language || 'unknown',
            filePath: node.filePath || node.id,
            line: 1,
          })),
          links: (legacyGraph.edges || []).map((edge: any) => ({
            source: edge.source,
            target: edge.target,
            relation: edge.type || 'dependency',
          })),
        };
        setGraphData(normalized);
      } else {
        setGraphData(data.graph);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [files, projectRoot]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  useEffect(() => {
    if (!renderedGraphData || !svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    const width = container.clientWidth;
    const graphHeight = height;

    svg.selectAll('*').remove();

    const g = svg.append('g');
    
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .wheelDelta((event) => -event.deltaY * 0.0012)
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Arrow markers for links
    svg.append('defs').selectAll('marker')
      .data(['arrow'])
      .join('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 30)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', '#6b7280')
      .attr('d', 'M0,-5L10,0L0,5');

    let filteredNodes = renderedGraphData.nodes;
    let filteredLinks = renderedGraphData.links;

    if (filterKind.size > 0) {
      filteredNodes = renderedGraphData.nodes.filter(n => filterKind.has(n.kind));
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredLinks = renderedGraphData.links.filter(l => {
        const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
        const targetId = typeof l.target === 'string' ? l.target : l.target.id;
        return nodeIds.has(sourceId) && nodeIds.has(targetId);
      });
    }

    // D3 forceLink throws when an edge references a node id that doesn't exist.
    // Some parsers emit external/unresolved imports as edges; ignore those safely.
    const validNodeIds = new Set(filteredNodes.map((n) => n.id));
    const safeLinks = filteredLinks.filter((l) => {
      const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
      const targetId = typeof l.target === 'string' ? l.target : l.target.id;
      return validNodeIds.has(sourceId) && validNodeIds.has(targetId);
    });

    const nodes = filteredNodes.map(d => ({ ...d }));
    const links = safeLinks.map(d => ({ ...d }));

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(130))
      .force('charge', d3.forceManyBody().strength(-340))
      .force('center', d3.forceCenter(width / 2, graphHeight / 2))
      .force('collision', d3.forceCollide().radius(56));

    simulationRef.current = simulation;

    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', d => relationColors[d.relation] || '#6b7280')
      .attr('stroke-opacity', 0.85)
      .attr('stroke-width', d => (d.relation === 'cross-boundary' ? 2.8 : 2.2))
      .attr('marker-end', 'url(#arrow)');

    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (event: any, d: GraphNode) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event: any, d: GraphNode) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event: any, d: GraphNode) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }) as any);

    // Node circles
    node.append('circle')
      .attr('r', 24)
      .attr('fill', d => kindConfig[d.kind]?.color || '#6b7280')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2.5);

    // Node labels
    node.append('text')
      .text(d => d.label.length > 20 ? d.label.substring(0, 17) + '...' : d.label)
      .attr('x', 0)
      .attr('y', 40)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#374151')
      .attr('font-weight', '700');

    node.on('click', (event, d) => {
      event.stopPropagation();
      setSelectedNode(d);
      onNodeClick?.(d);
    });

    node.on('mouseenter', (event, d) => {
      setHoveredNode(d);
      d3.select(event.currentTarget).select('circle')
        .attr('stroke', '#000')
        .attr('stroke-width', 3);
    });

    node.on('mouseleave', (event, d) => {
      setHoveredNode(null);
      d3.select(event.currentTarget).select('circle')
        .attr('stroke', '#fff')
        .attr('stroke-width', 2.5);
    });

    simulation.on('tick', () => {
      link
        .attr('d', d => {
          const source = d.source as GraphNode;
          const target = d.target as GraphNode;
          const x1 = source.x ?? 0;
          const y1 = source.y ?? 0;
          const x2 = target.x ?? 0;
          const y2 = target.y ?? 0;

          const dx = x2 - x1;
          const dy = y2 - y1;
          const distance = Math.hypot(dx, dy) || 1;
          const nx = -dy / distance;
          const ny = dx / distance;
          const curve = Math.min(22, distance * 0.18);
          const cx = (x1 + x2) / 2 + nx * curve;
          const cy = (y1 + y2) / 2 + ny * curve;

          return `M ${x1},${y1} Q ${cx},${cy} ${x2},${y2}`;
        });

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Click on svg to deselect
    svg.on('click', () => {
      setSelectedNode(null);
    });

    return () => {
      simulation.stop();
    };
  }, [renderedGraphData, filterKind, height, onNodeClick]);

  const allKinds = renderedGraphData ? [...new Set(renderedGraphData.nodes.map(n => n.kind))] : [];

  const toggleFilter = (kind: string) => {
    const newFilter = new Set(filterKind);
    if (newFilter.has(kind)) {
      newFilter.delete(kind);
    } else {
      newFilter.add(kind);
    }
    setFilterKind(newFilter);
  };

  const zoomIn = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      const svg = d3.select(svgRef.current);
      const zoomBehavior = zoomBehaviorRef.current;
      svg.transition().duration(320).ease(d3.easeCubicOut).call(
        (zoomBehavior.scaleBy as any),
        1.3
      );
    }
  };

  const zoomOut = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      const svg = d3.select(svgRef.current);
      const zoomBehavior = zoomBehaviorRef.current;
      svg.transition().duration(320).ease(d3.easeCubicOut).call(
        (zoomBehavior.scaleBy as any),
        0.7
      );
    }
  };

  const resetZoom = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      const svg = d3.select(svgRef.current);
      const zoomBehavior = zoomBehaviorRef.current;
      svg.transition().duration(420).ease(d3.easeCubicOut).call(
        (zoomBehavior.transform as any),
        d3.zoomIdentity
      );
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-8" style={{ height }}>
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="h-8 w-8 animate-spin" />
            <p className="text-sm text-muted-foreground">Building dependency graph...</p>
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
            <Network className="h-8 w-8" />
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
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Polyglot Dependency Graph
            <Badge variant="secondary">{renderedGraphData?.nodes.length || 0} nodes</Badge>
            <Badge variant="default">{graphMode === 'dag' ? 'DAG' : 'FULL'}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGraphMode((mode) => (mode === 'full' ? 'dag' : 'full'))}
              className="min-w-[68px]"
            >
              {graphMode === 'full' ? 'DAG' : 'FULL'}
            </Button>
            <Button variant="outline" size="sm" onClick={zoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={zoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={resetZoom}>
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowLegend(!showLegend)}>
              {showLegend ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchGraph}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-1 mb-3">
          {allKinds.map(kind => (
            <Button
              key={kind}
              variant={filterKind.has(kind) ? 'primary' : 'outline'}
              size="sm"
              onClick={() => toggleFilter(kind)}
              className="text-xs"
              style={{ 
                backgroundColor: filterKind.has(kind) ? kindConfig[kind]?.color : 'transparent',
                borderColor: kindConfig[kind]?.color,
                color: filterKind.has(kind) ? '#000' : kindConfig[kind]?.color
              }}
            >
              {kindConfig[kind]?.icon}
              <span className="ml-1">{kindConfig[kind]?.label || kind}</span>
            </Button>
          ))}
        </div>

        {/* Graph Container */}
        <div 
          ref={containerRef}
          className="relative rounded-lg border-2 border-black overflow-hidden"
          style={{ height }}
        >
          <svg 
            ref={svgRef} 
            width="100%" 
            height={height}
            className="bg-slate-50"
          />
          
          {/* Hover Tooltip */}
          {hoveredNode && (
            <div className="absolute top-2 left-2 bg-white border-2 border-black p-2 rounded shadow-lg text-xs z-10">
              <div className="font-bold">{hoveredNode.label}</div>
              <div className="text-muted-foreground">{hoveredNode.filePath}:{hoveredNode.line}</div>
              {graphMode === 'dag' && hoveredNode.members && hoveredNode.members.length > 1 && (
                <div className="mt-1 max-w-[280px]">
                  <div className="font-medium">Collapsed files:</div>
                  <div className="text-muted-foreground break-all">{hoveredNode.members.slice(0, 4).join(', ')}</div>
                  {hoveredNode.members.length > 4 && (
                    <div className="text-muted-foreground">+{hoveredNode.members.length - 4} more</div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1 mt-1">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: kindConfig[hoveredNode.kind]?.color }}
                />
                <span>{kindConfig[hoveredNode.kind]?.label || hoveredNode.kind}</span>
              </div>
            </div>
          )}

          {/* Selected Node Info */}
          {selectedNode && (
            <div className="absolute top-2 right-2 bg-white border-2 border-black p-3 rounded shadow-lg text-xs z-10 max-w-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold">{selectedNode.label}</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-4 w-4 p-0"
                  onClick={() => setSelectedNode(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1">
                <div><span className="font-medium">File:</span> {selectedNode.filePath}</div>
                <div><span className="font-medium">Line:</span> {selectedNode.line}</div>
                <div><span className="font-medium">Language:</span> {selectedNode.language}</div>
                <div><span className="font-medium">Type:</span> {kindConfig[selectedNode.kind]?.label || selectedNode.kind}</div>
                {graphMode === 'dag' && selectedNode.members && selectedNode.members.length > 1 && (
                  <div>
                    <span className="font-medium">Collapsed:</span>
                    <div className="mt-1 max-h-24 overflow-auto text-muted-foreground break-all">
                      {selectedNode.members.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="mt-3 p-2 bg-muted rounded-lg">
            <div className="text-xs font-bold mb-2 flex items-center gap-2">
              <Filter className="h-3 w-3" />
              Legend
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(kindConfig).map(([kind, config]) => (
                <div key={kind} className="flex items-center gap-1">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="text-xs">{config.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t text-xs">
              <span className="font-medium">Relations:</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {Object.entries(relationColors).map(([rel, color]) => (
                  <div key={rel} className="flex items-center gap-1">
                    <div 
                      className="w-4 h-0.5" 
                      style={{ backgroundColor: color }}
                    />
                    <span>{rel}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
