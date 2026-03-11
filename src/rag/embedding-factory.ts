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