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
    modelName: 'llama3.2:1b',
    baseUrl: 'http://localhost:11434',
    temperature: 0.3,
    numCtx: 2048,
  },
  accurateModel: {
    provider: 'ollama',
    modelName: 'llama3.2:3b',
    baseUrl: 'http://localhost:11434',
    temperature: 0.3,
    numCtx: 4096,
  },
  embedding: {
    provider: 'ollama',
    modelName: 'nomic-embed-text',
    baseUrl: 'http://localhost:11434',
  },
  vectorStore: {
    provider: 'qdrant',
    collectionName: 'daggerheart_rag',
    url: 'http://localhost:6333',
    onDisk: true,
    quantization: false,
    memmap: true,
  },
  chunkSize: 800,
  chunkOverlap: 100,
};