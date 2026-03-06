// src/cli/enhanced-query.ts
import { defaultConfig } from '../rag/config';
import { EmbeddingFactory } from '../rag/embeddings/embedding-factory';
import { ModelFactory } from '../rag/models/model-factory';
import { VectorStoreFactory } from '../rag/vectorstores/vector-store-factory';
import { QueryClassifier } from '../rag/query-classifier';
import { getPromptForIntent } from '../ui/enhanced-prompts';
import * as readline from 'readline';

async function enhancedQuery() {
  console.log('🚀 Loading Enhanced RAG system...\n');

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

    // Load both models
    const fastModel = ModelFactory.create(defaultConfig.fastModel);
    const accurateModel = ModelFactory.create(defaultConfig.accurateModel);

    console.log('✅ System ready!\n');
    console.log('💡 Tips:');
    console.log('  - Type "exit" to quit');
    console.log('  - Type "help" for commands');
    console.log('  - Type "debug" to toggle debug mode');
    console.log('  - Examples:');
    console.log('    • "show me the skeleton archer statblock"');
    console.log('    • "list all seraph class features"');
    console.log('    • "what weapons are available?"');
    console.log('    • "show grace domain cards"\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let debugMode = false;

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
          console.log('  exit    - Quit the application');
          console.log('  help    - Show this help');
          console.log('  debug   - Toggle debug information');
          console.log('\n📝 Query Types:');
          console.log('  Stat blocks  - "show [name] statblock" or "stats for [name]"');
          console.log('  Class info   - "seraph class features" or "warrior abilities"');
          console.log('  Equipment    - "list weapons" or "show armor table"');
          console.log('  Domain cards - "grace domain cards" or "show codex spells"');
          console.log('  General      - "how does downtime work?" or "explain hope"\n');
          askQuestion();
          return;
        }

        if (question.toLowerCase() === 'debug') {
          debugMode = !debugMode;
          console.log(`${debugMode ? '✅' : '❌'} Debug mode ${debugMode ? 'enabled' : 'disabled'}`);
          askQuestion();
          return;
        }

        try {
          // Classify the query
          const classification = QueryClassifier.classify(question);
          
          if (debugMode) {
            console.log('\n🔍 Query Classification:');
            console.log(`  Content Type: ${classification.contentType}`);
            console.log(`  Intent: ${classification.intent}`);
            console.log(`  Entities: ${classification.entities.join(', ') || 'none'}`);
            console.log(`  Chunks to retrieve: ${classification.k}`);
            console.log(`  Requires table: ${classification.requiresTable}`);
          }

          // Select model based on complexity
          const useAccurateModel = [
            'show_adversary_statblock',
            'show_environment_statblock',
            'show_class_features',
            'show_domain_cards',
            'compare_items'
          ].includes(classification.intent);
          
          const model = useAccurateModel ? accurateModel : fastModel;
          const modelName = useAccurateModel ? '3b (accurate)' : '1b (fast)';
          
          console.log(`\n🤖 Using ${modelName} model`);
          console.log(`📊 Content type: ${classification.contentType}`);
          console.log(`🎯 Intent: ${classification.intent}`);

          // Retrieve relevant documents
          console.log(`🔍 Searching ${classification.k} most relevant chunks...\n`);
          const relevantDocs = await vectorStore.similaritySearchWithScore(
            question,
            classification.k
          );

          if (relevantDocs.length === 0) {
            console.log('❌ No relevant documents found.');
            askQuestion();
            return;
          }

          // Show sources
          console.log('📚 Sources:');
          relevantDocs.forEach(([doc, score]: any, i: number) => {
            const source = doc.metadata?.source || 'Unknown';
            const section = doc.metadata?.section || '';
            const page = doc.metadata?.loc?.pageNumber || '?';
            
            const sourceInfo = section 
              ? `${source} → ${section} (Page ${page})`
              : `${source} (Page ${page})`;
            
            console.log(`  ${i + 1}. ${sourceInfo}`);
            console.log(`     Relevance: ${(score * 100).toFixed(1)}%`);
            
            if (debugMode && i < 3) {
              const preview = doc.pageContent.substring(0, 100).replace(/\n/g, ' ');
              console.log(`     Preview: ${preview}...`);
            }
          });

          // Build context
          const context = relevantDocs
            .map(([doc, score]: any, i: number) => {
              const source = doc.metadata?.source || 'Unknown';
              const section = doc.metadata?.section || '';
              const page = doc.metadata?.loc?.pageNumber || '?';
              
              const header = section
                ? `[Source ${i + 1}: ${source} → ${section}, Page ${page}]`
                : `[Source ${i + 1}: ${source}, Page ${page}]`;
              
              return `${header}\n${doc.pageContent}`;
            })
            .join('\n\n---\n\n');

          // Get appropriate prompt template
          const promptTemplate = getPromptForIntent(classification.intent);
          const prompt = await promptTemplate.format({ context, question });

          if (debugMode) {
            console.log('\n📝 Prompt Preview:');
            console.log(prompt.substring(0, 300) + '...\n');
          }

          // Stream response
          console.log('\n💡 Answer:\n');
          console.log('─'.repeat(60));
          
          const stream = await model.stream(prompt);
          let fullResponse = '';
          
          for await (const chunk of stream) {
            const text = typeof chunk.content === 'string' 
              ? chunk.content 
              : '';
            process.stdout.write(text);
            fullResponse += text;
          }
          
          console.log('\n' + '─'.repeat(60));

          // Show quality hints
          if (!debugMode && fullResponse.includes('NOT FOUND:')) {
            console.log('\n💡 Tip: Try different wording or check spelling');
          }

          if (!debugMode && classification.intent === 'show_adversary_statblock' && fullResponse.length < 200) {
            console.log('\n⚠️  Response seems incomplete. Try increasing chunk count or being more specific.');
          }

        } catch (error) {
          console.error('❌ Error:', error instanceof Error ? error.message : error);
          
          if (debugMode && error instanceof Error) {
            console.error('\nStack trace:', error.stack);
          }
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
  enhancedQuery();
}