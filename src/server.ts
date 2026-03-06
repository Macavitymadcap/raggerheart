import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { defaultConfig } from './rag/config';
import { EmbeddingFactory } from './rag/embeddings/embedding-factory';
import { ModelFactory } from './rag/models/model-factory';
import { VectorStoreFactory } from './rag/vectorstores/vector-store-factory';
import { PromptTemplate } from '@langchain/core/prompts';
import { userMessage, assistantMessage, errorMessage, sourcesSection } from './ui/templates';
import { formatAnswer } from './ui/formatters';
import { equipmentPrompt, standardPrompt, statBlockPrompt } from './ui/prompts';

type QueryType = 'standard' | 'equipment' | 'statblock';

const app = new Hono();

let vectorStore: any;
let fastModel: any;      // 1b model for simple queries
let accurateModel: any;  // 3b model for complex extractions
let isReady = false;

async function initializeRAG() {
  console.log('🚀 Initializing RAG system...');
  
  const embeddings = EmbeddingFactory.create(defaultConfig.embedding);
  vectorStore = VectorStoreFactory.create(defaultConfig.vectorStore);
  
  const collectionInfo = await vectorStore.getCollectionInfo();
  if (!collectionInfo) {
    throw new Error('Database not initialized. Run: bun run init');
  }
  
  await vectorStore.loadExisting(embeddings);
  
  // Initialize both models
  console.log('🤖 Loading fast model (1b)...');
  fastModel = ModelFactory.create(defaultConfig.fastModel);
  
  console.log('🤖 Loading accurate model (3b)...');
  accurateModel = ModelFactory.create(defaultConfig.accurateModel);
  
  isReady = true;
  console.log(`✅ Loaded ${collectionInfo.count} document chunks`);
  console.log('🌐 Server ready at http://localhost:3000\n');
}

app.use('/css/*', serveStatic({ root: './public' }));
app.use('/js/*', serveStatic({ root: './public' }));
app.get('/', serveStatic({ path: './public/index.html' }));

app.post('/query', async (c) => {
  let query: QueryType = 'standard';
  if (!isReady) {
    return c.html(errorMessage('System not ready. Please wait...'));
  }

  const body = await c.req.parseBody();
  const question = body.question as string;
  let k = parseInt(body.k as string) || 4;

  if (!question) {
    return c.html(errorMessage('Please enter a question.'));
  }

  try {
    // Detect query type and select appropriate model
    const isStatBlockQuery = question.toLowerCase().match(/stat\s*block|adversary|enemy|monster|creature|npc/);
    if (isStatBlockQuery) query = 'statblock';

    const isWeaponQuery = question.toLowerCase().match(/weapon|armor|item|equipment|gear|knife|sword|bow|axe/);
    if (isWeaponQuery) query = 'equipment';

    // Choose model based on complexity
    const model = (isStatBlockQuery || isWeaponQuery) ? accurateModel : fastModel;
    const modelName = (isStatBlockQuery || isWeaponQuery) ? '3b' : '1b';
    
    console.log(`  🤖 Using ${modelName} model for this query`);
    
    // Adjust chunk count
    if (isStatBlockQuery) {
      k = Math.max(k, 10);
      console.log(`  📈 Stat block query - increased to ${k} chunks`);
    } else if (isWeaponQuery) {
      k = Math.max(k, 8);
      console.log(`  📈 Equipment query - increased to ${k} chunks`);
    }

    const relevantDocs = await vectorStore.similaritySearchWithScore(question, k);

    const context = relevantDocs
      .map(([doc, score]: any, i: number) => {
        const source = doc.metadata?.source || 'Unknown';
        const page = doc.metadata?.loc?.pageNumber || '?';
        return `[Source ${i + 1}: ${source}, Page ${page}]\n${doc.pageContent}`;
      })
      .join('\n\n---\n\n');

    // Build prompt based on query type
    const promptTemplate = buildPrompt(query);
    const prompt = await promptTemplate.format({ context, question });
    
    const response = await model.invoke(prompt);
    const answer = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);

    // Extract docs and scores for sources
    const docs = relevantDocs.map(([doc]: any) => doc);
    const scores = relevantDocs.map(([_, score]: any) => score);
    
    const sourcesHTML = sourcesSection(docs, scores);
    const formattedAnswer = formatAnswer(answer, isWeaponQuery || false);

    return c.html(
      userMessage(question) + 
      assistantMessage(formattedAnswer, sourcesHTML)
    );

  } catch (error) {
    return c.html(errorMessage(error instanceof Error ? error.message : 'Unknown error'));
  }
});

function buildPrompt(query: QueryType): PromptTemplate {
  switch (query) {
    case 'equipment':
      return equipmentPrompt;
    case 'statblock':
      return statBlockPrompt;
    case 'standard':
    default:
      return standardPrompt;
  }
}

const port = 3000;

initializeRAG().then(() => {
  console.log(`🌐 Server running at http://localhost:${port}`);
  
});

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 255,
};