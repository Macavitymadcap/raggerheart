export interface ModelConfig {
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
  provider: 'memory' | 'lance' | 'qdrant';
  collectionName: string;
  persistDirectory?: string;
  // Qdrant-specific options
  url?: string;
  apiKey?: string;
  onDisk?: boolean;
  quantization?: boolean;
  memmap?: boolean;
}

export interface AppConfig {
  fastModel: ModelConfig;
  accurateModel: ModelConfig;
  embedding: EmbeddingConfig;
  vectorStore: VectorStoreConfig;
  chunkSize: number;
  chunkOverlap: number;
}

export const defaultConfig: AppConfig = {
  fastModel: {
    provider: 'ollama',
    modelName: 'mistral',
    baseUrl: 'http://localhost:11434',
    temperature: 0.3,
    numCtx: 4096,
  },
  
  accurateModel: {
    provider: 'ollama',
    modelName: 'deepseek-r1:14b',
    baseUrl: 'http://localhost:11434',
    temperature: 0.3,
    numCtx: 8192,
  },
  
  embedding: {
    provider: 'ollama',
    modelName: 'mxbai-embed-large',
    baseUrl: 'http://localhost:11434',
  },
  
  vectorStore: {
    provider: 'qdrant',
    collectionName: 'daggerheart_rag_v2',
    url: 'http://localhost:6333',
    onDisk: true,
    quantization: true,
    memmap: true,
  },
  
  chunkSize: 1500,
  chunkOverlap: 300,
};

export const apiEmbeddingConfig: AppConfig = {
  ...defaultConfig,
  
  embedding: {
    provider: 'openai',
    modelName: 'text-embedding-3-large',
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  
  vectorStore: {
    provider: 'qdrant',
    collectionName: 'daggerheart_rag_openai',  // Different collection for API embeddings
    url: 'http://localhost:6333',
    onDisk: true,
    quantization: false,  // Don't quantize OpenAI embeddings
    memmap: true,
  },
};