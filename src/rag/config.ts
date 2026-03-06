;export interface ModelConfig {
  provider: 'ollama' | 'openai' | 'anthropic';
  modelName: string;
  baseUrl?: string;
  apiKey?: string;
  temperature?: number;
  numCtx?: number;
}

export interface EmbeddingConfig {
  provider: 'ollama' | 'huggingface' | 'openai';
  modelName: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface VectorStoreConfig {
  provider: 'memory';
  collectionName: string;
  persistDirectory: string;
}

export interface AppConfig {
  fastModel: ModelConfig;      // For simple queries
  accurateModel: ModelConfig;   // For complex extractions
  embedding: EmbeddingConfig;
  vectorStore: VectorStoreConfig;
  chunkSize: number;
  chunkOverlap: number;
}

export const defaultConfig: AppConfig = {
  // Fast model for general queries (2-3x faster)
  fastModel: {
    provider: 'ollama',
    modelName: 'llama3.2:1b',
    baseUrl: 'http://localhost:11434',
    temperature: 0.3,  // Lower for more deterministic responses
    numCtx: 2048,      // Smaller context for speed
  },
  // Accurate model for stat blocks and complex queries
  accurateModel: {
    provider: 'ollama',
    modelName: 'llama3.2:3b',
    baseUrl: 'http://localhost:11434',
    temperature: 0.3,  // Lower for more deterministic responses
    numCtx: 4096,      // Larger context for complex extractions
  },
  embedding: {
    provider: 'ollama',
    modelName: 'nomic-embed-text',
    baseUrl: 'http://localhost:11434',
  },
  vectorStore: {
    provider: 'memory',
    collectionName: 'rag_documents',
    persistDirectory: './vectorstore',
  },
  chunkSize: 800,    // Smaller for more precise retrieval
  chunkOverlap: 100, // Less overlap for speed
};