import type { Embeddings } from "@langchain/core/embeddings";
import type { Document } from "langchain";

export interface Store {
  url?: string
  initialize(documents: Document[], embeddings: Embeddings): Promise<void>;
  loadExisting(embeddings: Embeddings): Promise<void>;
  similaritySearch(query: string, k: number): Promise<Document[]>
  similaritySearchWithScore(query: string, k: number): Promise<[Document, number][]>
  addDocuments(documents: Document[]): Promise<void>;
  getCollectionInfo(): Promise<any>;
  createPayloadIndex?(fieldname: string): Promise<void>;
}