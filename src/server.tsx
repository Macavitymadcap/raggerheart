import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { defaultConfig } from './rag/config';
import { EmbeddingFactory } from './rag/embeddings/embedding-factory';
import { ModelFactory } from './rag/models/model-factory';
import { VectorStoreFactory } from './rag/vectorstores/vector-store-factory';
import { PromptTemplate } from '@langchain/core/prompts';
import { UserMessage, AssistantMessage, ErrorMessage } from './ui/components';
import { formatAnswer } from './ui/formatters';
import { equipmentPrompt, standardPrompt, statBlockPrompt } from './ui/prompts';

const app = new Hono();

let vectorStore: any;
let fastModel: any;
let accurateModel: any;
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
  if (!isReady) {
    return c.html(<ErrorMessage error="System not ready. Please wait..." />);
  }

  const body = await c.req.parseBody();
  const question = body.question as string;
  let k = parseInt(body.k as string) || 4;

  if (!question) {
    return c.html(<ErrorMessage error="Please enter a question." />);
  }

  try {
    const isStatBlockQuery = question.toLowerCase().match(/stat\s*block|adversary|enemy|monster|creature|npc/);
    const isWeaponQuery = question.toLowerCase().match(/weapon|armor|item|equipment|gear|knife|sword|bow|axe/);

    const model = (isStatBlockQuery || isWeaponQuery) ? accurateModel : fastModel;
    const modelName = (isStatBlockQuery || isWeaponQuery) ? '3b' : '1b';
    
    console.log(`  🤖 Using ${modelName} model for this query`);
    
    if (isStatBlockQuery) {
      k = Math.max(k, 10);
    } else if (isWeaponQuery) {
      k = Math.max(k, 8);
    }

    const relevantDocs = await vectorStore.similaritySearchWithScore(question, k);

    const context = relevantDocs
      .map(([doc, score]: any, i: number) => {
        const source = doc.metadata?.source || 'Unknown';
        const page = doc.metadata?.loc?.pageNumber || '?';
        return `[Source ${i + 1}: ${source}, Page ${page}]\n${doc.pageContent}`;
      })
      .join('\n\n---\n\n');

    let promptTemplate: PromptTemplate;
    if (isWeaponQuery) {
      promptTemplate = equipmentPrompt;
    } else if (isStatBlockQuery) {
      promptTemplate = statBlockPrompt;
    } else {
      promptTemplate = standardPrompt;
    }

    const prompt = await promptTemplate.format({ context, question });
    
    const response = await model.invoke(prompt);
    const answer = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);

    const docs = relevantDocs.map(([doc]: any) => doc);
    const scores = relevantDocs.map(([_, score]: any) => score);
    
    const formattedAnswer = formatAnswer(answer, !!isWeaponQuery);

    return c.html(
      <>
        <UserMessage question={question} />
        <AssistantMessage 
          content={formattedAnswer} 
          sources={{ docs, scores }} 
        />
      </>
    );

  } catch (error) {
    return c.html(<ErrorMessage error={error instanceof Error ? error.message : 'Unknown error'} />);
  }
});

const port = 3000;

initializeRAG().then(() => {
  console.log(`🌐 Server running at http://localhost:${port}`);
});

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 255,
};