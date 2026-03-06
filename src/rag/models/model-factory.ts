import { ChatOllama } from '@langchain/ollama';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ModelConfig } from '../config';

export class ModelFactory {
  static create(config: ModelConfig): BaseChatModel {
    switch (config.provider) {
      case 'ollama':
        return new ChatOllama({
          model: config.modelName,
          baseUrl: config.baseUrl || 'http://localhost:11434',
          temperature: config.temperature || 0.7,
          numCtx: config.numCtx || 4096,
        });
      
      case 'openai':
        throw new Error('OpenAI not implemented yet');
      
      case 'anthropic':
        throw new Error('Anthropic not implemented yet');
      
      default:
        throw new Error(`Unknown model provider: ${config.provider}`);
    }
  }
}