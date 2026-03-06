import type { Document } from '@langchain/core/documents';

export interface DocumentParser {
  /**
   * Parse a single document file
   */
  parseDocument(filePath: string): Promise<Document[]>;

  /**
   * Parse multiple document files
   */
  parseMultipleDocuments(filePaths: string[]): Promise<Document[]>;

  /**
   * Get statistics about parsed chunks
   */
  getChunkStats(documents: Document[]): ChunkStats;
}

export interface ChunkStats {
  totalChunks: number;
  avgChunkSize: number;
  minChunkSize: number;
  maxChunkSize: number;
  [key: string]: any; // Allow additional stats
}