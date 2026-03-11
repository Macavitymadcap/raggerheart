// src/server-enhanced.tsx
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { defaultConfig } from './rag/config';
import { EmbeddingFactory } from './rag/embedding-factory';
import { ModelFactory } from './rag/models/model-factory';
import { VectorStoreFactory } from './rag/vectorstores/vector-store-factory';
import { QueryClassifier } from './rag/query-classifier';
import { getPromptForIntent } from './cli/enhanced-prompts';
import { formatResponse } from './ui/enhanced-formatters';
import { UserMessage, AssistantMessage, ErrorMessage } from './ui/components';

const app = new Hono();

let vectorStore: any;
let fastModel: any;
let accurateModel: any;
let isReady = false;

async function initializeRAG() {
  console.log('🚀 Initializing Enhanced RAG system...');
  
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

  if (!question) {
    return c.html(<ErrorMessage error="Please enter a question." />);
  }

  try {
    // Classify the query
    const classification = QueryClassifier.classify(question);
    
    console.log(`\n🔍 Query: "${question}"`);
    console.log(`📊 Type: ${classification.contentType} | Intent: ${classification.intent}`);

    // Select model based on complexity
    const useAccurateModel = [
      'show_adversary_statblock',
      'show_environment_statblock',
      'show_class_features',
      'show_domain_cards',
      'compare_items'
    ].includes(classification.intent);
    
    const model = useAccurateModel ? accurateModel : fastModel;
    const modelName = useAccurateModel ? '3b' : '1b';
    
    console.log(`🤖 Using ${modelName} model | Retrieving ${classification.k} chunks`);

    // Retrieve relevant documents
    const relevantDocs = await vectorStore.similaritySearchWithScore(
      question,
      classification.k
    );

    if (relevantDocs.length === 0) {
      return c.html(
        <>
          <UserMessage question={question} />
          <ErrorMessage error="No relevant information found in the database." />
        </>
      );
    }

    // Build context with better formatting
    const context = relevantDocs
      .map(([doc, score]: any, i: number) => {
        const source = doc.metadata?.source || 'Unknown';
        const section = doc.metadata?.section || '';
        const page = doc.metadata?.loc?.pageNumber || '?';
        
        const header = section
          ? `[Source ${i + 1}: ${source} → ${section}, Page ${page}, Relevance: ${(score * 100).toFixed(1)}%]`
          : `[Source ${i + 1}: ${source}, Page ${page}, Relevance: ${(score * 100).toFixed(1)}%]`;
        
        return `${header}\n${doc.pageContent}`;
      })
      .join('\n\n---\n\n');

    // Get appropriate prompt template
    const promptTemplate = getPromptForIntent(classification.intent);
    const prompt = await promptTemplate.format({ context, question });

    // Get response from model
    const response = await model.invoke(prompt);
    const rawAnswer = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);

    console.log(`✅ Generated response (${rawAnswer.length} chars)`);

    // Format the answer based on intent
    const formattedAnswer = formatResponse({
      intent: classification.intent,
      rawText: rawAnswer,
    });

    // Extract docs and scores for source display
    const docs = relevantDocs.map(([doc]: any) => doc);
    const scores = relevantDocs.map(([_, score]: any) => score);

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
    console.error('❌ Error:', error);
    return c.html(
      <>
        <UserMessage question={question} />
        <ErrorMessage error={error instanceof Error ? error.message : 'Unknown error'} />
      </>
    );
  }
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: isReady ? 'ready' : 'initializing',
    timestamp: new Date().toISOString(),
  });
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