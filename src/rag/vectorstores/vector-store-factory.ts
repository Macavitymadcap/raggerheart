import type { VectorStoreConfig } from '../config';
import { SimpleStore } from './simple-store';
import { QdrantStore } from './qdrant-store';
import type { Store } from './store.interface';

export class VectorStoreFactory {
  static create(config: VectorStoreConfig): Store {
    switch (config.provider) {
      case 'memory':
        return new SimpleStore(
          config.collectionName,
          config.persistDirectory
        );
      
      
      case 'qdrant':
        return new QdrantStore({
          url: config.url || 'http://localhost:6333',
          collectionName: config.collectionName,
          onDisk: config.onDisk,
          quantization: config.quantization,
          memmap: config.memmap,
        });
      
      default:
        throw new Error(`Unknown vector store provider: ${config.provider}`);
    }
  }
}