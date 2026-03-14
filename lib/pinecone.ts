import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";

let pineconeClient: Pinecone | null = null;
let index: any = null;
let genAI: GoogleGenerativeAI | null = null;

function getPineconeClient() {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }
  return pineconeClient;
}

function getIndex() {
  if (!index) {
    index = getPineconeClient().Index(process.env.PINECONE_INDEX_NAME!);
  }
  return index;
}

function getGenAI() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
  }
  return genAI;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = getGenAI().getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

export async function upsertCodeChunk(
  repositoryId: string,
  filePath: string,
  content: string,
  chunkIndex: number
) {
  const embedding = await generateEmbedding(content);
  const id = `${repositoryId}:${filePath}:${chunkIndex}`;

  await getIndex().upsert({
    records: [
      {
        id,
        values: embedding,
        metadata: {
          repositoryId,
          filePath,
          chunkIndex,
          content: content.slice(0, 10000),
        },
      },
    ],
  });

  return id;
}

export async function queryCodebase(
  repositoryId: string,
  query: string,
  topK: number = 10
) {
  const queryEmbedding = await generateEmbedding(query);

  const results = await getIndex().query({
    vector: queryEmbedding,
    filter: {
      repositoryId: { $eq: repositoryId },
    },
    topK,
    includeMetadata: true,
  });

  return results.matches.map((match: any) => ({
    id: match.id,
    score: match.score,
    filePath: match.metadata?.filePath as string,
    content: match.metadata?.content as string,
  }));
}

export async function deleteRepositoryIndex(repositoryId: string) {
  const results = await getIndex().query({
    vector: new Array(1536).fill(0),
    filter: {
      repositoryId: { $eq: repositoryId },
    },
    topK: 10000,
    includeMetadata: false,
  });

  if (results.matches.length > 0) {
    await getIndex().deleteMany(results.matches.map((m: any) => m.id));
  }
}

export async function indexFile(
  repositoryId: string,
  filePath: string,
  content: string,
  chunkSize: number = 4000
) {
  const chunks: string[] = [];
  
  for (let i = 0; i < content.length; i += chunkSize) {
    chunks.push(content.slice(i, i + chunkSize));
  }

  const embeddingIds: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const id = await upsertCodeChunk(repositoryId, filePath, chunks[i], i);
    embeddingIds.push(id);
  }

  return embeddingIds;
}
