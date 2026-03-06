import { QdrantVectorStore } from '@langchain/qdrant';
import { QdrantClient } from '@qdrant/js-client-rest';
import type { Document } from '@langchain/core/documents';
import type { Embeddings } from '@langchain/core/embeddings';
import type { Store } from './store.interface';

export interface QdrantConfig {
  url: string;
  apiKey?: string;
  collectionName: string;
  onDisk?: boolean;
  quantization?: boolean;
  memmap?: boolean;
}

export class QdrantStore implements Store {
  private store: QdrantVectorStore | null = null;
  private client: QdrantClient;
  private config: QdrantConfig;

  constructor(config: QdrantConfig) {
    this.config = config;
    this.client = new QdrantClient({
      url: config.url,
      apiKey: config.apiKey,
    });
  }

  async initialize(documents: Document[], embeddings: Embeddings): Promise<void> {
    console.log('  🔧 Creating Qdrant collection...');
    
    try {
      await this.client.deleteCollection(this.config.collectionName);
      console.log('  🗑️  Deleted existing collection');
    } catch (error) {
      // Collection doesn't exist, that's fine
    }

    await this.createCollection(embeddings);

    console.log('  🔢 Creating embeddings and storing vectors...');
    this.store = await QdrantVectorStore.fromDocuments(
      documents,
      embeddings,
      {
        url: this.config.url,
        collectionName: this.config.collectionName,
        apiKey: this.config.apiKey,
      }
    );
    
    console.log('  ✅ Vectors stored in Qdrant');
  }

  private async createCollection(embeddings: Embeddings): Promise<void> {
    const testEmbedding = await embeddings.embedQuery('test');
    const vectorSize = testEmbedding.length;

    await this.client.createCollection(this.config.collectionName, {
      vectors: {
        size: vectorSize,
        distance: 'Cosine',
        on_disk: this.config.onDisk,
      },
      optimizers_config: {
        memmap_threshold: this.config.memmap ? 20000 : undefined,
      },
      quantization_config: this.config.quantization
        ? {
            scalar: {
              type: 'int8',
              quantile: 0.99,
              always_ram: true,
            },
          }
        : undefined,
    });
  }

  async loadExisting(embeddings: Embeddings): Promise<void> {
    this.store = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url: this.config.url,
        collectionName: this.config.collectionName,
        apiKey: this.config.apiKey,
      }
    );
  }

  async similaritySearch(query: string, k = 4): Promise<Document[]> {
    if (!this.store) {
      throw new Error('Vector store not initialized');
    }
    return this.store.similaritySearch(query, k);
  }

  async similaritySearchWithScore(query: string, k = 4): Promise<[Document, number][]> {
    if (!this.store) {
      throw new Error('Vector store not initialized');
    }
    return this.store.similaritySearchWithScore(query, k);
  }

  async addDocuments(documents: Document[]): Promise<void> {
    if (!this.store) {
      throw new Error('Vector store not initialized');
    }
    await this.store.addDocuments(documents);
  }

  async getCollectionInfo(): Promise<any> {
    try {
      const info = await this.client.getCollection(this.config.collectionName);
      return {
        name: this.config.collectionName,
        count: info.points_count || 0,
        vectorsCount: info.indexed_vectors_count || 0,
        status: info.status,
      };
    } catch (error) {
      return null;
    }
  }

  async createPayloadIndex(fieldName: string): Promise<void> {
    await this.client.createPayloadIndex(this.config.collectionName, {
      field_name: fieldName,
      field_schema: 'keyword',
    });
    console.log(`  📇 Created payload index for: ${fieldName}`);
  }
}