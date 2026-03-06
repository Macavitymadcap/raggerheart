import { defaultConfig } from '../rag/config';
import { EmbeddingFactory } from '../rag/embeddings/embedding-factory';
import { ModelFactory } from '../rag/models/model-factory';
import { VectorStoreFactory } from '../rag/vectorstores/vector-store-factory';
import { PromptTemplate } from '@langchain/core/prompts';
import * as readline from 'readline';

async function query() {
  console.log('🚀 Loading RAG system...\n');

  try {
    // Load embeddings
    const embeddings = EmbeddingFactory.create(defaultConfig.embedding);

    // Load vector store
    const vectorStore = VectorStoreFactory.create(defaultConfig.vectorStore);
    const collectionInfo = await vectorStore.getCollectionInfo();

    if (!collectionInfo) {
      console.error('❌ No database found. Please run: bun run init\n');
      process.exit(1);
    }

    console.log(`📚 Loaded ${collectionInfo.count} document chunks`);
    await vectorStore.loadExisting(embeddings);

    // Load model
    const model = ModelFactory.create(defaultConfig.model);

    console.log('✅ System ready!\n');
    console.log('💡 Tips:');
    console.log('  - Type "exit" to quit');
    console.log('  - Type "help" for commands');
    console.log('  - Adjust k=N to retrieve more chunks (default k=8)\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let retrievalCount = 8; // Default to 8 chunks

    const askQuestion = () => {
      rl.question('\n❓ Your question: ', async (input) => {
        const question = input.trim();

        if (!question) {
          askQuestion();
          return;
        }

        if (question.toLowerCase() === 'exit') {
          console.log('\n👋 Goodbye!');
          rl.close();
          process.exit(0);
        }

        if (question.toLowerCase() === 'help') {
          console.log('\n📖 Commands:');
          console.log('  exit          - Quit the application');
          console.log('  help          - Show this help');
          console.log('  k=N           - Set number of chunks to retrieve (e.g., "k=10")');
          console.log(`  Current k: ${retrievalCount}\n`);
          askQuestion();
          return;
        }

        // Handle k=N command
        const kMatch = question.match(/^k=(\d+)$/i);
        if (kMatch) {
          retrievalCount = parseInt(kMatch[1] as string);
          console.log(`✅ Retrieval count set to ${retrievalCount}`);
          askQuestion();
          return;
        }

        try {
          // Retrieve relevant documents
          console.log(`\n🔍 Searching ${retrievalCount} most relevant chunks...\n`);
          const relevantDocs = await vectorStore.similaritySearchWithScore(
            question,
            retrievalCount
          );

          if (relevantDocs.length === 0) {
            console.log('❌ No relevant documents found.');
            askQuestion();
            return;
          }

          // Show sources
          console.log('📚 Sources:');
          relevantDocs.forEach(([doc, score], i) => {
            const source = doc.metadata?.source || 'Unknown';
            const page = doc.metadata?.loc?.pageNumber || '?';
            console.log(`  ${i + 1}. ${source} (Page ${page}) - Relevance: ${(score * 100).toFixed(1)}%`);
          });

          // Build context
          const context = relevantDocs
            .map(([doc, score], i) => {
              const source = doc.metadata?.source || 'Unknown';
              const page = doc.metadata?.loc?.pageNumber || '?';
              return `[Source ${i + 1}: ${source}, Page ${page}, Relevance: ${(score * 100).toFixed(1)}%]\n${doc.pageContent}`;
            })
            .join('\n\n---\n\n');

          // Create prompt
          const promptTemplate = PromptTemplate.fromTemplate(
            `
You are a helpful AI assistant for the Daggerheart TTRPG. Answer questions based on the following context from the Daggerheart SRD.

If the context contains relevant information, provide a detailed answer citing the sources.
If the context doesn't contain enough information, say so honestly.

Context:
{context}

Question: {question}

Answer:`.trim()
          );

          const prompt = await promptTemplate.format({ context, question });

          // Stream response
          console.log('\n💡 Answer:\n');
          
          const stream = await model.stream(prompt);
          
          for await (const chunk of stream) {
            const text = typeof chunk.content === 'string' 
              ? chunk.content 
              : '';
            process.stdout.write(text);
          }
          
          console.log('\n');

        } catch (error) {
          console.error('❌ Error:', error instanceof Error ? error.message : error);
        }

        askQuestion();
      });
    };

    askQuestion();

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (import.meta.main) {
  query();
}