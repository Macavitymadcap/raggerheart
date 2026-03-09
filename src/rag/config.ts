// src/rag/config.ts
// OPTIMIZED CONFIG for updated markdown format

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

// =============================================================================
// RECOMMENDED CONFIG (Updated for better performance)
// =============================================================================
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
    numCtx: 4096,  // REDUCED from 8192 for 8GB RAM
  },
  
  embedding: {
    provider: 'ollama',
    modelName: 'nomic-embed-text',  // KEEP THIS - works great on 8GB
    baseUrl: 'http://localhost:11434',
  },
  
  vectorStore: {
    provider: 'qdrant',
    collectionName: 'daggerheart_rag_v2',
    url: 'http://localhost:6333',
    onDisk: true,
    quantization: true,  // IMPORTANT for 8GB
    memmap: true,
  },
  
  chunkSize: 1000,     // Slightly reduced
  chunkOverlap: 150,   // Slightly reduced
};

// =============================================================================
// ALTERNATIVE CONFIG: When you upgrade to 32GB RAM
// =============================================================================

export const highPerformanceConfig: AppConfig = {
  fastModel: {
    provider: 'ollama',
    modelName: 'qwen2.5:7b',  // Better than llama 1b
    baseUrl: 'http://localhost:11434',
    temperature: 0.3,
    numCtx: 4096,
  },
  
  accurateModel: {
    provider: 'ollama',
    modelName: 'qwen2.5:14b',  // Or llama3.1:70b (quantized)
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

// =============================================================================
// ALTERNATIVE: API-based embeddings (best quality, small cost)
// =============================================================================

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