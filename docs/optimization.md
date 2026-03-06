# Speed & Accuracy Improvements for Daggerheart RAG

## Quick Wins (Immediate)

### 1. Use llama3.2:1b for general queries, 3b only for stat blocks
```typescript
// In config.ts - create two model instances
export const fastModel = {
  provider: 'ollama',
  modelName: 'llama3.2:1b',  // Fast for simple queries
};

export const accurateModel = {
  provider: 'ollama',
  modelName: 'llama3.2:3b',  // Accurate for complex extractions
};

// In server - switch based on query type
const modelConfig = isStatBlockQuery ? accurateModel : fastModel;
const model = ModelFactory.create(modelConfig);
```

### 2. Reduce context size
```typescript
// Lower temperature for more deterministic responses
temperature: 0.3  // Instead of 0.7

// Smaller num_ctx for faster processing
numCtx: 2048  // Instead of 4096
```

### 3. Cache compiled prompts
```typescript
// Pre-compile prompt templates at startup
const STAT_BLOCK_PROMPT = PromptTemplate.fromTemplate(statBlockPrompt());
const WEAPON_PROMPT = PromptTemplate.fromTemplate(weaponPrompt());

// Reuse them instead of creating new ones each request
```

## Medium-Term Improvements

### 4. Better chunking strategy
Current: 1000 chars with 200 overlap
Better: Split on semantic boundaries

```typescript
// In pdf-parser.ts
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 800,  // Smaller = more precise retrieval
  chunkOverlap: 100,  // Less overlap = faster
  separators: [
    '\n## ',      // Section headers
    '\n### ',     // Subsection headers
    '\nTier ',    // Stat blocks
    '\n\n',       // Paragraphs
    '\n',
    ' ',
  ],
});
```

### 5. Pre-filter chunks by page context
```typescript
// Add metadata filtering for stat blocks
if (isStatBlockQuery) {
  // Only search pages likely to have stat blocks (e.g., bestiary section)
  const filteredDocs = await vectorStore.similaritySearch(
    question, 
    k,
    { pageRange: [40, 80] }  // Adjust based on your PDF structure
  );
}
```

### 6. Use embedding cache
```typescript
// Cache embeddings for common queries
const queryCache = new Map<string, number[]>();

async function getCachedEmbedding(query: string) {
  if (queryCache.has(query)) {
    return queryCache.get(query);
  }
  const embedding = await embeddings.embedQuery(query);
  queryCache.set(query, embedding);
  return embedding;
}
```

## Advanced Optimizations

### 7. Switch to better vector store (if willing to pay setup cost)
```bash
# SQLite-based vector store (much faster than JSON)
bun add better-sqlite3
```

### 8. Quantized embeddings
```bash
# Use smaller embedding model
ollama pull all-minilm  # 384 dims, 2x faster than nomic-embed-text
```

### 9. Parallel chunk processing
```typescript
// Process chunks in parallel instead of batches
const embeddings = await Promise.all(
  chunks.map(chunk => embeddingModel.embedQuery(chunk.pageContent))
);
```

### 10. Request debouncing
```javascript
// In app.js - prevent rapid-fire requests
let debounceTimer;
function handleSubmit(e) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    // Submit request
  }, 300);
}
```

## Accuracy Improvements

### 11. Two-stage retrieval
```typescript
// First: Get 20 chunks
const roughResults = await vectorStore.similaritySearch(question, 20);

// Second: Re-rank with cross-encoder or relevance scoring
const reranked = roughResults
  .map(doc => ({ doc, score: calculateRelevance(doc, question) }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 8);
```

### 12. Query expansion
```typescript
// Expand user query with synonyms
function expandQuery(question: string): string {
  const expansions = {
    'knife': 'knife dagger blade',
    'zombie': 'zombie undead corpse',
    'stats': 'stats statistics stat block',
  };
  
  // Add relevant expansions to query
  return expandedQuery;
}
```

### 13. Hybrid search (keyword + semantic)
```typescript
// Combine vector similarity with keyword matching
const semanticResults = await vectorStore.similaritySearch(query, 10);
const keywordResults = chunks.filter(c => 
  c.pageContent.toLowerCase().includes(queryKeyword)
);

// Merge and deduplicate
const combined = [...new Set([...semanticResults, ...keywordResults])];
```

## Expected Improvements

| Change | Speed Gain | Accuracy Gain |
|--------|------------|---------------|
| 1b for simple queries | 2-3x | -10% |
| Lower temp + ctx | 20-30% | +5% |
| Better chunking | 10% | +15% |
| Cached prompts | 5% | 0% |
| Embedding cache | 30-50% | 0% |
| Two-stage retrieval | -20% | +25% |

## Recommended Quick Setup

```typescript
// config.ts
export const defaultConfig = {
  fastModel: {
    modelName: 'llama3.2:1b',
    temperature: 0.3,
    numCtx: 2048,
  },
  accurateModel: {
    modelName: 'llama3.2:3b',
    temperature: 0.3,
    numCtx: 4096,
  },
  chunkSize: 800,
  chunkOverlap: 100,
};
```

This gives you 2x faster general queries while maintaining accuracy for complex stat block extractions.