# Local RAG Application Setup Guide

Complete guide to building a Retrieval-Augmented Generation (RAG) application using Ollama, LangChain, TypeScript, Bun, and Chroma vector database - completely free and running locally on Ubuntu 24.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Architecture](#architecture)
- [Installation Steps](#installation-steps)
- [Project Structure](#project-structure)
- [Implementation](#implementation)
- [Usage](#usage)
- [Customization](#customization)
- [Troubleshooting](#troubleshooting)

## Overview

This RAG application allows you to:
- Parse PDF documents into chunks
- Store embeddings in a persistent local vector database (Chroma)
- Query your documents using natural language
- Run completely locally with no API costs
- Easily swap models and providers

**Cost: 100% Free** - Everything runs on your local machine.

## Prerequisites

- Ubuntu 24.04
- 8GB+ RAM (16GB recommended)
- Bun runtime installed
- Basic terminal knowledge

## Architecture

```
┌─────────────┐
│   PDFs      │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  PDF Parser     │ (LangChain)
│  Chunking       │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Embeddings     │ (Ollama: nomic-embed-text)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Chroma DB      │ (SQLite-based, persistent)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  RAG Chain      │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  LLM Response   │ (Ollama: llama3.2)
└─────────────────┘
```

## Installation Steps

### Step 1: Install Ollama

```bash
# Download and install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Verify installation
ollama --version

# Start Ollama service (if not auto-started)
ollama serve
```

### Step 2: Pull Required Models

```bash
# Pull LLM model (choose based on your RAM)
# For 8GB RAM:
ollama pull llama3.2:1b

# For 16GB+ RAM (recommended):
ollama pull llama3.2

# For 32GB+ RAM (best quality):
ollama pull llama3.1:8b

# Pull embedding model (required for all)
ollama pull nomic-embed-text

# Verify models are downloaded
ollama list
```

### Step 3: Create Project

```bash
# Create project directory
mkdir rag-app
cd rag-app

# Initialize Bun project
bun init -y
```

### Step 4: Install Dependencies

```bash
# Core LangChain packages
bun add langchain @langchain/core @langchain/community

# Ollama integration
bun add @langchain/ollama

# Chroma vector database
bun add chromadb

# PDF parsing
bun add pdf-parse

# TypeScript types
bun add -d @types/node @types/pdf-parse
```

### Step 5: Create Directory Structure

```bash
# Create source directories
mkdir -p src/{models,embeddings,vectorstores,chains,parsers}

# Create data directory for PDFs
mkdir data

# Create directory for Chroma database
mkdir chroma_db
```

## Project Structure

```
rag-app/
├── src/
│   ├── config.ts                    # Configuration
│   ├── index.ts                     # Main application
│   ├── parsers/
│   │   └── pdf-parser.ts           # PDF parsing logic
│   ├── embeddings/
│   │   └── embedding-factory.ts    # Embedding provider factory
│   ├── models/
│   │   └── model-factory.ts        # LLM provider factory
│   ├── vectorstores/
│   │   ├── chroma-store.ts         # Chroma implementation
│   │   └── vector-store-factory.ts # Vector store factory
│   └── chains/
│       └── rag-chain.ts            # RAG implementation
├── data/                            # Place your PDFs here
├── chroma_db/                       # Chroma database storage
├── package.json
└── tsconfig.json
```

## Implementation

### 1. Configuration File

Create `src/config.ts`:

```typescript
export interface ModelConfig {
  provider: 'ollama' | 'openai' | 'anthropic';
  modelName: string;
  baseUrl?: string;
  apiKey?: string;
  temperature?: number;
}

export interface EmbeddingConfig {
  provider: 'ollama' | 'huggingface' | 'openai';
  modelName: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface VectorStoreConfig {
  provider: 'chroma';
  collectionName: string;
  persistDirectory: string;
}

export interface AppConfig {
  model: ModelConfig;
  embedding: EmbeddingConfig;
  vectorStore: VectorStoreConfig;
  chunkSize: number;
  chunkOverlap: number;
}

export const defaultConfig: AppConfig = {
  model: {
    provider: 'ollama',
    modelName: 'llama3.2',
    baseUrl: 'http://localhost:11434',
    temperature: 0.7,
  },
  embedding: {
    provider: 'ollama',
    modelName: 'nomic-embed-text',
    baseUrl: 'http://localhost:11434',
  },
  vectorStore: {
    provider: 'chroma',
    collectionName: 'rag_documents',
    persistDirectory: './chroma_db',
  },
  chunkSize: 1000,
  chunkOverlap: 200,
};
```

### 2. PDF Parser

Create `src/parsers/pdf-parser.ts`:

```typescript
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import type { Document } from '@langchain/core/documents';

export class PDFParser {
  private splitter: RecursiveCharacterTextSplitter;

  constructor(chunkSize = 1000, chunkOverlap = 200) {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: ['\n\n', '\n', ' ', ''],
    });
  }

  /**
   * Parse a single PDF file into chunks
   */
  async parsePDF(filePath: string): Promise<Document[]> {
    console.log(`  📄 Loading: ${filePath}`);
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();
    
    console.log(`  ✂️  Splitting into chunks...`);
    const chunks = await this.splitter.splitDocuments(docs);
    console.log(`  ✅ Created ${chunks.length} chunks`);
    
    return chunks;
  }

  /**
   * Parse multiple PDF files
   */
  async parseMultiplePDFs(filePaths: string[]): Promise<Document[]> {
    const allChunks: Document[] = [];
    
    for (const path of filePaths) {
      const chunks = await this.parsePDF(path);
      allChunks.push(...chunks);
    }
    
    console.log(`\n📊 Total chunks: ${allChunks.length}`);
    return allChunks;
  }

  /**
   * Get chunk statistics
   */
  getChunkStats(documents: Document[]): {
    totalChunks: number;
    avgChunkSize: number;
    minChunkSize: number;
    maxChunkSize: number;
  } {
    const sizes = documents.map(doc => doc.pageContent.length);
    
    return {
      totalChunks: documents.length,
      avgChunkSize: Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length),
      minChunkSize: Math.min(...sizes),
      maxChunkSize: Math.max(...sizes),
    };
  }
}
```

### 3. Embedding Factory

Create `src/embeddings/embedding-factory.ts`:

```typescript
import { OllamaEmbeddings } from '@langchain/ollama';
import type { Embeddings } from '@langchain/core/embeddings';
import type { EmbeddingConfig } from '../config';

export class EmbeddingFactory {
  /**
   * Create embeddings instance based on provider
   */
  static create(config: EmbeddingConfig): Embeddings {
    switch (config.provider) {
      case 'ollama':
        return new OllamaEmbeddings({
          model: config.modelName,
          baseUrl: config.baseUrl || 'http://localhost:11434',
        });
      
      case 'huggingface':
        // To implement: install @langchain/community
        // return new HuggingFaceInferenceEmbeddings({
        //   apiKey: config.apiKey,
        // });
        throw new Error('HuggingFace embeddings not implemented yet');
      
      case 'openai':
        // To implement: install @langchain/openai
        // return new OpenAIEmbeddings({
        //   apiKey: config.apiKey,
        // });
        throw new Error('OpenAI embeddings not implemented yet');
      
      default:
        throw new Error(`Unknown embedding provider: ${config.provider}`);
    }
  }
}
```

### 4. Model Factory

Create `src/models/model-factory.ts`:

```typescript
import { ChatOllama } from '@langchain/ollama';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ModelConfig } from '../config';

export class ModelFactory {
  /**
   * Create LLM instance based on provider
   */
  static create(config: ModelConfig): BaseChatModel {
    switch (config.provider) {
      case 'ollama':
        return new ChatOllama({
          model: config.modelName,
          baseUrl: config.baseUrl || 'http://localhost:11434',
          temperature: config.temperature || 0.7,
        });
      
      case 'openai':
        // To implement: install @langchain/openai
        // return new ChatOpenAI({
        //   apiKey: config.apiKey,
        //   modelName: config.modelName,
        //   temperature: config.temperature,
        // });
        throw new Error('OpenAI not implemented yet');
      
      case 'anthropic':
        // To implement: install @langchain/anthropic
        // return new ChatAnthropic({
        //   apiKey: config.apiKey,
        //   modelName: config.modelName,
        //   temperature: config.temperature,
        // });
        throw new Error('Anthropic not implemented yet');
      
      default:
        throw new Error(`Unknown model provider: ${config.provider}`);
    }
  }
}
```

### 5. Chroma Vector Store

Create `src/vectorstores/chroma-store.ts`:

```typescript
import { Chroma } from '@langchain/community/vectorstores/chroma';
import type { Document } from '@langchain/core/documents';
import type { Embeddings } from '@langchain/core/embeddings';
import { ChromaClient } from 'chromadb';

export class ChromaVectorStore {
  private store: Chroma | null = null;
  private client: ChromaClient;
  private collectionName: string;
  private persistDirectory: string;

  constructor(
    collectionName = 'rag_documents',
    persistDirectory = './chroma_db'
  ) {
    this.collectionName = collectionName;
    this.persistDirectory = persistDirectory;
    this.client = new ChromaClient({
      path: this.persistDirectory,
    });
  }

  /**
   * Initialize vector store with documents
   */
  async initialize(documents: Document[], embeddings: Embeddings): Promise<void> {
    console.log('  🔢 Creating embeddings...');
    this.store = await Chroma.fromDocuments(
      documents,
      embeddings,
      {
        collectionName: this.collectionName,
        url: this.persistDirectory,
      }
    );
    console.log('  💾 Stored in Chroma database');
  }

  /**
   * Load existing vector store
   */
  async loadExisting(embeddings: Embeddings): Promise<void> {
    this.store = await Chroma.fromExistingCollection(
      embeddings,
      {
        collectionName: this.collectionName,
        url: this.persistDirectory,
      }
    );
  }

  /**
   * Search for similar documents
   */
  async similaritySearch(query: string, k = 4): Promise<Document[]> {
    if (!this.store) {
      throw new Error('Vector store not initialized. Call initialize() or loadExisting() first.');
    }
    return this.store.similaritySearch(query, k);
  }

  /**
   * Search with scores
   */
  async similaritySearchWithScore(
    query: string,
    k = 4
  ): Promise<[Document, number][]> {
    if (!this.store) {
      throw new Error('Vector store not initialized');
    }
    return this.store.similaritySearchWithScore(query, k);
  }

  /**
   * Add more documents to existing store
   */
  async addDocuments(documents: Document[]): Promise<void> {
    if (!this.store) {
      throw new Error('Vector store not initialized');
    }
    await this.store.addDocuments(documents);
  }

  /**
   * Delete the collection
   */
  async deleteCollection(): Promise<void> {
    await this.client.deleteCollection({ name: this.collectionName });
    this.store = null;
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(): Promise<any> {
    try {
      const collection = await this.client.getCollection({
        name: this.collectionName,
      });
      return {
        name: this.collectionName,
        count: await collection.count(),
      };
    } catch (error) {
      return null;
    }
  }
}
```

### 6. Vector Store Factory

Create `src/vectorstores/vector-store-factory.ts`:

```typescript
import type { VectorStoreConfig } from '../config';
import { ChromaVectorStore } from './chroma-store';

export class VectorStoreFactory {
  /**
   * Create vector store instance based on provider
   */
  static create(config: VectorStoreConfig): ChromaVectorStore {
    switch (config.provider) {
      case 'chroma':
        return new ChromaVectorStore(
          config.collectionName,
          config.persistDirectory
        );
      
      default:
        throw new Error(`Unknown vector store provider: ${config.provider}`);
    }
  }
}
```

### 7. RAG Chain

Create `src/chains/rag-chain.ts`:

```typescript
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ChromaVectorStore } from '../vectorstores/chroma-store';
import { PromptTemplate } from '@langchain/core/prompts';
import type { Document } from '@langchain/core/documents';

export class RAGChain {
  constructor(
    private model: BaseChatModel,
    private vectorStore: ChromaVectorStore
  ) {}

  /**
   * Query the RAG system
   */
  async query(question: string, k = 4): Promise<{
    answer: string;
    sources: Document[];
  }> {
    // Retrieve relevant documents
    console.log(`\n🔍 Searching for relevant context...`);
    const relevantDocs = await this.vectorStore.similaritySearch(question, k);
    console.log(`✅ Found ${relevantDocs.length} relevant chunks`);

    // Build context from retrieved documents
    const context = relevantDocs
      .map((doc, i) => {
        const source = doc.metadata?.source || 'Unknown';
        const page = doc.metadata?.loc?.pageNumber || '?';
        return `[Source ${i + 1}: ${source}, Page ${page}]\n${doc.pageContent}`;
      })
      .join('\n\n---\n\n');

    // Create prompt
    const promptTemplate = PromptTemplate.fromTemplate(
      `You are a helpful AI assistant. Answer the question based on the following context from documents.

If the context contains relevant information, provide a detailed answer citing the sources.
If the context doesn't contain enough information to answer the question, say so honestly.

Context:
{context}

Question: {question}

Answer:`
    );

    const prompt = await promptTemplate.format({ context, question });

    // Get response from LLM
    console.log(`🤖 Generating answer...`);
    const response = await this.model.invoke(prompt);

    const answer = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    return {
      answer,
      sources: relevantDocs,
    };
  }

  /**
   * Query with score threshold
   */
  async queryWithThreshold(
    question: string,
    scoreThreshold = 0.7,
    k = 4
  ): Promise<{
    answer: string;
    sources: Array<{ doc: Document; score: number }>;
  }> {
    const resultsWithScores = await this.vectorStore.similaritySearchWithScore(
      question,
      k
    );

    const filteredResults = resultsWithScores.filter(
      ([_, score]) => score >= scoreThreshold
    );

    if (filteredResults.length === 0) {
      return {
        answer: "I couldn't find any relevant information in the documents to answer this question.",
        sources: [],
      };
    }

    const context = filteredResults
      .map(([doc, score], i) => {
        const source = doc.metadata?.source || 'Unknown';
        const page = doc.metadata?.loc?.pageNumber || '?';
        return `[Source ${i + 1}: ${source}, Page ${page}, Relevance: ${(score * 100).toFixed(1)}%]\n${doc.pageContent}`;
      })
      .join('\n\n---\n\n');

    const promptTemplate = PromptTemplate.fromTemplate(
      `You are a helpful AI assistant. Answer the question based on the following context from documents.

Context:
{context}

Question: {question}

Answer:`
    );

    const prompt = await promptTemplate.format({ context, question });
    const response = await this.model.invoke(prompt);

    const answer = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    return {
      answer,
      sources: filteredResults.map(([doc, score]) => ({ doc, score })),
    };
  }
}
```

### 8. Main Application

Create `src/index.ts`:

```typescript
import { defaultConfig } from './config';
import { PDFParser } from './parsers/pdf-parser';
import { EmbeddingFactory } from './embeddings/embedding-factory';
import { ModelFactory } from './models/model-factory';
import { VectorStoreFactory } from './vectorstores/vector-store-factory';
import { RAGChain } from './chains/rag-chain';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🚀 Starting RAG Application\n');
  console.log('═══════════════════════════════════════');

  try {
    // 1. Initialize embeddings
    console.log('\n📦 Step 1: Loading Embedding Model');
    console.log('───────────────────────────────────────');
    const embeddings = EmbeddingFactory.create(defaultConfig.embedding);
    console.log(`✅ Using: ${defaultConfig.embedding.modelName}`);

    // 2. Initialize vector store
    console.log('\n💾 Step 2: Vector Store Setup');
    console.log('───────────────────────────────────────');
    const vectorStore = VectorStoreFactory.create(defaultConfig.vectorStore);

    // Check if collection exists
    const collectionInfo = await vectorStore.getCollectionInfo();

    if (collectionInfo) {
      console.log(`✅ Found existing collection: ${collectionInfo.name}`);
      console.log(`📊 Documents in store: ${collectionInfo.count}`);
      console.log('🔄 Loading existing vector store...');
      await vectorStore.loadExisting(embeddings);
    } else {
      console.log('🆕 No existing collection found');
      console.log('📄 Parsing PDFs from ./data directory...\n');

      // Get all PDF files from data directory
      const dataDir = './data';
      if (!existsSync(dataDir)) {
        throw new Error(`Data directory not found: ${dataDir}\nPlease create it and add PDF files.`);
      }

      const pdfFiles = readdirSync(dataDir)
        .filter(file => file.toLowerCase().endsWith('.pdf'))
        .map(file => join(dataDir, file));

      if (pdfFiles.length === 0) {
        throw new Error('No PDF files found in ./data directory');
      }

      console.log(`Found ${pdfFiles.length} PDF file(s):`);
      pdfFiles.forEach(file => console.log(`  - ${file}`));
      console.log();

      // Parse PDFs
      const parser = new PDFParser(
        defaultConfig.chunkSize,
        defaultConfig.chunkOverlap
      );

      const documents = await parser.parseMultiplePDFs(pdfFiles);

      // Show stats
      const stats = parser.getChunkStats(documents);
      console.log('\n📊 Chunk Statistics:');
      console.log(`  Total chunks: ${stats.totalChunks}`);
      console.log(`  Average size: ${stats.avgChunkSize} characters`);
      console.log(`  Min size: ${stats.minChunkSize} characters`);
      console.log(`  Max size: ${stats.maxChunkSize} characters`);

      // Initialize vector store
      console.log('\n💾 Storing embeddings in Chroma...');
      await vectorStore.initialize(documents, embeddings);
      console.log('✅ Vector store created and persisted');
    }

    // 3. Initialize LLM
    console.log('\n🤖 Step 3: Loading Language Model');
    console.log('───────────────────────────────────────');
    const model = ModelFactory.create(defaultConfig.model);
    console.log(`✅ Using: ${defaultConfig.model.modelName}`);

    // 4. Create RAG chain
    console.log('\n🔗 Step 4: Creating RAG Chain');
    console.log('───────────────────────────────────────');
    const ragChain = new RAGChain(model, vectorStore);
    console.log('✅ RAG chain ready');

    // 5. Example queries
    console.log('\n═══════════════════════════════════════');
    console.log('💬 RAG Application Ready!');
    console.log('═══════════════════════════════════════');

    // Example question
    const exampleQuestions = [
      'What is the main topic of these documents?',
      'Can you summarize the key points?',
    ];

    for (const question of exampleQuestions) {
      console.log(`\n❓ Question: ${question}`);
      console.log('─'.repeat(50));

      const result = await ragChain.query(question, 4);

      console.log(`\n💡 Answer:\n${result.answer}`);

      if (result.sources.length > 0) {
        console.log(`\n📚 Sources used:`);
        result.sources.forEach((doc, i) => {
          const source = doc.metadata?.source || 'Unknown';
          const page = doc.metadata?.loc?.pageNumber || '?';
          console.log(`  ${i + 1}. ${source} (Page ${page})`);
        });
      }
    }

    console.log('\n═══════════════════════════════════════');
    console.log('✨ Example queries completed!');
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the application
main();
```

### 9. Package Configuration

Update `package.json`:

```json
{
  "name": "rag-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "bun run src/index.ts",
    "dev": "bun --watch src/index.ts",
    "reset": "rm -rf chroma_db && echo 'Vector database cleared'"
  },
  "dependencies": {
    "@langchain/community": "latest",
    "@langchain/core": "latest",
    "@langchain/ollama": "latest",
    "chromadb": "latest",
    "langchain": "latest",
    "pdf-parse": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "@types/pdf-parse": "latest"
  }
}
```

### 10. TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Usage

### First Time Setup

1. **Add your PDF documents:**
```bash
cp /path/to/your/documents/*.pdf ./data/
```

2. **Run the application:**
```bash
bun run start
```

The first run will:
- Parse all PDFs in the `./data` directory
- Create embeddings
- Store them in the Chroma database
- Run example queries

### Subsequent Runs

The vector database persists in `./chroma_db/`, so subsequent runs will:
- Load the existing database
- Skip PDF parsing
- Be much faster

### Adding More Documents

To add more PDFs to an existing database:

1. Add new PDFs to the `./data` directory
2. Run the reset script to clear the database:
```bash
bun run reset
```
3. Run the app again:
```bash
bun run start
```

### Interactive Query Mode

For a simple interactive mode, create `src/interactive.ts`:

```typescript
import { defaultConfig } from './config';
import { EmbeddingFactory } from './embeddings/embedding-factory';
import { ModelFactory } from './models/model-factory';
import { VectorStoreFactory } from './vectorstores/vector-store-factory';
import { RAGChain } from './chains/rag-chain';
import * as readline from 'readline';

async function interactive() {
  console.log('🚀 Loading RAG system...\n');

  // Load embeddings
  const embeddings = EmbeddingFactory.create(defaultConfig.embedding);

  // Load vector store
  const vectorStore = VectorStoreFactory.create(defaultConfig.vectorStore);
  await vectorStore.loadExisting(embeddings);

  // Load model
  const model = ModelFactory.create(defaultConfig.model);

  // Create RAG chain
  const ragChain = new RAGChain(model, vectorStore);

  console.log('✅ System ready!\n');
  console.log('Type your questions (or "exit" to quit)\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = () => {
    rl.question('❓ Your question: ', async (question) => {
      if (question.toLowerCase() === 'exit') {
        console.log('\n👋 Goodbye!');
        rl.close();
        process.exit(0);
      }

      if (!question.trim()) {
        askQuestion();
        return;
      }

      const result = await ragChain.query(question.trim());
      console.log(`\n💡 Answer:\n${result.answer}\n`);

      askQuestion();
    });
  };

  askQuestion();
}

interactive();
```

Add to `package.json`:
```json
"scripts": {
  "start": "bun run src/index.ts",
  "interactive": "bun run src/interactive.ts",
  "dev": "bun --watch src/index.ts",
  "reset": "rm -rf chroma_db && echo 'Vector database cleared'"
}
```

Run interactive mode:
```bash
bun run interactive
```

## Customization

### Change LLM Model

Edit `src/config.ts`:

```typescript
model: {
  provider: 'ollama',
  modelName: 'llama3.1:8b', // or 'mistral', 'codellama', etc.
  baseUrl: 'http://localhost:11434',
  temperature: 0.7,
}
```

Available Ollama models:
- `llama3.2:1b` - Fast, minimal RAM
- `llama3.2` - Balanced
- `llama3.1:8b` - Better quality
- `mistral` - Good alternative
- `codellama` - For code-related docs

Pull new models with:
```bash
ollama pull <model-name>
```

### Change Chunk Size

Adjust in `src/config.ts`:

```typescript
chunkSize: 1000,      // Characters per chunk
chunkOverlap: 200,    // Overlap between chunks
```

Guidelines:
- **Small chunks (500-800)**: Better for precise retrieval
- **Medium chunks (1000-1500)**: Balanced (recommended)
- **Large chunks (2000+)**: More context, but less precise

### Add API-Based Models

To add OpenAI support:

```bash
bun add @langchain/openai
```

Update `src/models/model-factory.ts`:

```typescript
case 'openai':
  const { ChatOpenAI } = await import('@langchain/openai');
  return new ChatOpenAI({
    apiKey: config.apiKey,
    modelName: config.modelName,
    temperature: config.temperature,
  });
```

Update config:
```typescript
model: {
  provider: 'openai',
  modelName: 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7,
}
```

### Improve Retrieval Quality

1. **Use MMR (Maximum Marginal Relevance):**

Update `src/chains/rag-chain.ts`:

```typescript
// Instead of similaritySearch, use:
const relevantDocs = await this.vectorStore.store?.maxMarginalRelevanceSearch(
  question,
  {
    k: k,
    fetchK: k * 3, // Fetch more, then diversify
  }
);
```

2. **Add metadata filtering:**

```typescript
const relevantDocs = await this.vectorStore.similaritySearch(
  question,
  k,
  { source: 'specific-document.pdf' } // Filter by metadata
);
```

3. **Adjust retrieval count:**

```typescript
// Retrieve more documents for complex questions
const result = await ragChain.query(question, 8); // Instead of 4
```

### Custom Prompt Template

Edit `src/chains/rag-chain.ts`:

```typescript
const promptTemplate = PromptTemplate.fromTemplate(
  `You are an expert analyst. Use the following context to answer the question.
  
Rules:
- Only use information from the context
- If unsure, say "I don't have enough information"
- Cite page numbers when possible
- Be concise but thorough

Context:
{context}

Question: {question}

Expert Analysis:`
);
```

## Troubleshooting

### Ollama Connection Issues

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not running, start it
ollama serve

# Check available models
ollama list
```

### Chroma Database Issues

```bash
# Reset the database
bun run reset

# Or manually
rm -rf chroma_db
```

### Memory Issues

If you run out of memory:

1. Use a smaller model:
```bash
ollama pull llama3.2:1b
```

2. Reduce chunk size:
```typescript
chunkSize: 500,
chunkOverlap: 50,
```

3. Process fewer documents at once

### PDF Parsing Errors

Some PDFs may fail to parse. To handle this:

```typescript
// In src/parsers/pdf-parser.ts
async parsePDF(filePath: string): Promise<Document[]> {
  try {
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();
    return await this.splitter.splitDocuments(docs);
  } catch (error) {
    console.error(`Failed to parse ${filePath}:`, error);
    return []; // Skip problematic PDFs
  }
}
```

### Slow Embedding Generation

Embeddings are cached in Chroma, so:
- First run is slow (one-time cost)
- Subsequent queries are fast
- Only regenerate when adding new documents

To check progress:
```typescript
// Add logging to pdf-parser.ts
console.log(`Processing chunk ${i + 1}/${chunks.length}`);
```

### Port Already in Use

If Ollama port is in use:

```bash
# Check what's using port 11434
lsof -i :11434

# Kill the process or change Ollama port
OLLAMA_HOST=0.0.0.0:11435 ollama serve
```

Update config:
```typescript
baseUrl: 'http://localhost:11435',
```

## Performance Tips

1. **First Run Optimization:**
   - Start with 1-2 PDFs to test
   - Gradually add more documents

2. **Query Optimization:**
   - Cache frequently asked questions
   - Adjust `k` parameter based on question complexity

3. **Hardware Recommendations:**
   - 8GB RAM: `llama3.2:1b`, small PDFs
   - 16GB RAM: `llama3.2`, medium workloads
   - 32GB+ RAM: `llama3.1:8b`, large documents

4. **Embedding Speed:**
   - `nomic-embed-text` is fast and good quality
   - Consider `all-minilm` for faster (but lower quality) embeddings

## Next Steps

### Add Web UI

Consider adding a simple web interface:

```bash
bun add hono @hono/node-server
```

Create `src/server.ts`:

```typescript
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { ragChain } from './index'; // Export from index.ts

const app = new Hono();

app.post('/query', async (c) => {
  const { question } = await c.req.json();
  const result = await ragChain.query(question);
  return c.json(result);
});

serve(app, (info) => {
  console.log(`Server running on http://localhost:${info.port}`);
});
```

### Add Streaming Responses

For real-time response streaming:

```typescript
import { StringOutputParser } from '@langchain/core/output_parsers';

const parser = new StringOutputParser();
const stream = await this.model.stream(prompt);

for await (const chunk of stream) {
  process.stdout.write(chunk.content);
}
```

### Add Multi-Modal Support

Process images in PDFs:

```bash
bun add @langchain/community
```

Use LLaVA model:
```bash
ollama pull llava
```

### Add Conversation Memory

For follow-up questions:

```typescript
import { BufferMemory } from 'langchain/memory';

const memory = new BufferMemory();
// Implement conversation history tracking
```

## Resources

- [Ollama Models](https://ollama.com/library)
- [LangChain Documentation](https://js.langchain.com/docs/)
- [Chroma Documentation](https://docs.trychroma.com/)
- [Bun Documentation](https://bun.sh/docs)

## License

This guide is provided as-is for educational purposes.

---

**Happy RAG Building! 🚀**