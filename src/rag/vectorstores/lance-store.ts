import { LanceDB } from '@langchain/community/vectorstores/lancedb';
import { connect, WriteMode } from 'vectordb';
import type { Document } from '@langchain/core/documents';
import type { Embeddings } from '@langchain/core/embeddings';
import type { Store } from './store.interface';

export class LanceDBStore implements Store {
  private store: LanceDB | null = null;
  private tableName: string;
  private dbPath: string;

  constructor(
    tableName = 'rag_documents',
    dbPath = './lancedb'
  ) {
    this.tableName = tableName;
    this.dbPath = dbPath;
  }

  async initialize(documents: Document[], embeddings: Embeddings): Promise<void> {
    console.log('  🔢 Creating embeddings...');
    const db = await connect(this.dbPath);
    
    // Create table first
    const table = await db.createTable(this.tableName, [
      { vector: Array(384).fill(0), text: '', metadata: {} }
    ], { writeMode: WriteMode.Overwrite });
    
    this.store = await LanceDB.fromDocuments(
      documents,
      embeddings,
      { 
        table: table as any,  // Type assertion to work around interface mismatch
      }
    );
    console.log('  💾 Stored in LanceDB database');
  }

  async loadExisting(embeddings: Embeddings): Promise<void> {
    const db = await connect(this.dbPath);
    const table = await db.openTable(this.tableName);
    
    this.store = new LanceDB(embeddings, { 
      table: table as any,  // Type assertion
    });
  }

  async similaritySearch(query: string, k = 4): Promise<Document[]> {
    if (!this.store) {
      throw new Error('Vector store not initialized. Call initialize() or loadExisting() first.');
    }
    return this.store.similaritySearch(query, k);
  }

  async similaritySearchWithScore(
    query: string,
    k = 4
  ): Promise<[Document, number][]> {
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
      const db = await connect(this.dbPath);
      const tableNames = await db.tableNames();
      
      if (tableNames.includes(this.tableName)) {
        const table = await db.openTable(this.tableName);
        const count = await table.countRows();
        return {
          name: this.tableName,
          count: count,
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }
}