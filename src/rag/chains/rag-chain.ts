import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { PromptTemplate } from '@langchain/core/prompts';
import type { Document } from '@langchain/core/documents';
import type { Store } from '../vectorstores/store.interface';

export class RAGChain {
  constructor(
    private model: BaseChatModel,
    private vectorStore: Store 
  ) {}

  /**
   * Query the RAG system
   */
  async query(question: string, k = 15): Promise<{
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