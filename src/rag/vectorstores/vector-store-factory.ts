import type { VectorStoreConfig } from '../config';
import { LanceDBStore } from './lance-store';
import { SimpleStore } from './simple-store';
import type { Store } from './store.interface';

export class VectorStoreFactory {
  /**
   * Create vector store instance based on provider
   */
  static create(config: VectorStoreConfig): Store {
    switch (config.provider) {
      case 'memory': {
        return new SimpleStore(
          config.collectionName,
          config.persistDirectory
        );
      }
      case 'lance':
        return new LanceDBStore(
          config.collectionName,
          config.persistDirectory
        );
      
      default:
        throw new Error(`Unknown vector store provider: ${config.provider}`);
    }
  }
}