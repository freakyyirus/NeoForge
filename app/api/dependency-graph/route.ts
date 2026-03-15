import { NextRequest, NextResponse } from 'next/server';
import { buildDependencyGraph, analyzeImpact, getLanguageStats, type DependencyGraph } from '@/lib/dependency-graph';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { files, analyzeFile } = body;
    
    if (!files || typeof files !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request: files object is required' },
        { status: 400 }
      );
    }
    
    const graph: DependencyGraph = buildDependencyGraph(files);
    const languageStats = getLanguageStats(graph);
    
    const response: {
      graph: DependencyGraph;
      languageStats: ReturnType<typeof getLanguageStats>;
      impact?: {
        affectedFiles: string[];
        impactLevel: 'low' | 'medium' | 'high';
      };
    } = {
      graph,
      languageStats,
    };
    
    if (analyzeFile && typeof analyzeFile === 'string') {
      response.impact = analyzeImpact(graph, analyzeFile);
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error analyzing dependency graph:', error);
    return NextResponse.json(
      { error: 'Failed to analyze dependency graph' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Dependency Graph API',
    features: [
      'Cross-language dependency parsing',
      'Import statement detection',
      'Impact analysis',
      'Language statistics',
    ],
    supportedLanguages: [
      'JavaScript',
      'TypeScript',
      'Python',
      'Go',
      'Rust',
      'Java',
      'C/C++',
      'C#',
      'Ruby',
      'PHP',
    ],
  });
}
