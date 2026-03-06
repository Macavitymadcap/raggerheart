import { Document } from '@langchain/core/documents';
import type { Embeddings } from '@langchain/core/embeddings';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import type { Store } from './store.interface';

interface StoredVector {
  content: string;
  metadata: any;
  embedding: number[];
}

export class SimpleStore implements Store {
  private vectors: StoredVector[] = [];
  private persistPath: string;
  private embeddings: Embeddings | null = null;

  constructor(
    collectionName = 'rag_documents',
    persistDirectory = './vectorstore'
  ) {
    this.persistPath = `${persistDirectory}/${collectionName}.json`;
  }

  async initialize(documents: Document[], embeddings: Embeddings): Promise<void> {
    this.embeddings = embeddings;
    console.log('  🔢 Creating embeddings...');
    console.log(`  📊 Processing ${documents.length} chunks in batches...`);
    
    const batchSize = 50;
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, Math.min(i + batchSize, documents.length));
      const progress = Math.min(i + batchSize, documents.length);
      console.log(`  ⏳ Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(documents.length/batchSize)} (${progress}/${documents.length})`);
      
      // Generate embeddings for batch
      const texts = batch.map(doc => doc.pageContent);
      const batchEmbeddings = await embeddings.embedDocuments(texts);
      
      // Store vectors
      for (let j = 0; j < batch.length; j++) {
        this.vectors.push({
          content: batch[j]!.pageContent,
          metadata: batch[j]!.metadata,
          embedding: batchEmbeddings[j]!
        });
      }
    }
    
    console.log('  💾 Saving to disk...');
    this.saveToDisk();
    console.log('  ✅ Stored successfully');
  }

  async loadExisting(embeddings: Embeddings): Promise<void> {
    this.embeddings = embeddings;
    const data = JSON.parse(readFileSync(this.persistPath, 'utf-8'));
    this.vectors = data.vectors;
  }

  private saveToDisk(): void {
    const dir = this.persistPath.split('/').slice(0, -1).join('/');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    writeFileSync(this.persistPath, JSON.stringify({ vectors: this.vectors }, null, 2));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i]!, 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  async similaritySearch(query: string, k = 4): Promise<Document[]> {
    if (!this.embeddings) throw new Error('Not initialized');
    
    // Generate query embedding
    const queryEmbedding = await this.embeddings.embedQuery(query);
    
    // Calculate similarities
    const scored = this.vectors.map(vec => ({
      doc: new Document({ pageContent: vec.content, metadata: vec.metadata }),
      score: this.cosineSimilarity(queryEmbedding, vec.embedding)
    }));
    
    // Sort by score and return top k
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map(item => item.doc);
  }

  async similaritySearchWithScore(query: string, k = 4): Promise<[Document, number][]> {
    if (!this.embeddings) throw new Error('Not initialized');
    
    const queryEmbedding = await this.embeddings.embedQuery(query);
    
    const scored = this.vectors.map(vec => ({
      doc: new Document({ pageContent: vec.content, metadata: vec.metadata }),
      score: this.cosineSimilarity(queryEmbedding, vec.embedding)
    }));
    
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map(item => [item.doc, item.score]);
  }

  async addDocuments(documents: Document[]): Promise<void> {
    if (!this.embeddings) throw new Error('Not initialized');
    
    const texts = documents.map(doc => doc.pageContent);
    const embeddings = await this.embeddings.embedDocuments(texts);
    
    for (let i = 0; i < documents.length; i++) {
      this.vectors.push({
        content: documents[i]!.pageContent,
        metadata: documents[i]!.metadata,
        embedding: embeddings[i]!
      });
    }
    
    this.saveToDisk();
  }

  async getCollectionInfo(): Promise<any> {
    if (!existsSync(this.persistPath)) return null;
    const data = JSON.parse(readFileSync(this.persistPath, 'utf-8'));
    return { name: 'rag_documents', count: data.vectors.length };
  }
}