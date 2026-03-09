import { defaultConfig } from '../rag/config';
import { EmbeddingFactory } from '../rag/embeddings/embedding-factory';
import { ModelFactory } from '../rag/models/model-factory';
import { VectorStoreFactory } from '../rag/vectorstores/vector-store-factory';
import { QueryClassifier } from '../rag/query-classifier';
import { getPromptForIntent } from './enhanced-prompts';
import { CLIFormatter } from './cli-formatter';
import chalk from 'chalk';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Store } from '../rag/vectorstores/store.interface';

// ============================================================================
// DISPLAY FUNCTIONS
// ============================================================================

function showWelcome(chunkCount: number) {
  console.log(chalk.hex('#FFD700').bold('\n🚀 Daggerheart RAG System\n'));
  console.log(chalk.green(`✅ Loaded ${chunkCount} document chunks`));
  console.log(chalk.green('✅ System ready!\n'));
  
  console.log(chalk.hex('#87CEEB')('💡 Examples:'));
  console.log(chalk.gray('  • "show me the skeleton archer statblock"'));
  console.log(chalk.gray('  • "list all seraph class features"'));
  console.log(chalk.gray('  • "what weapons are available?"'));
  console.log(chalk.gray('  • "show grace domain cards"\n'));
  
  console.log(chalk.hex('#87CEEB')('📖 Commands:'));
  console.log(chalk.gray('  • exit    - Quit'));
  console.log(chalk.gray('  • help    - Show help'));
  console.log(chalk.gray('  • debug   - Toggle debug mode\n'));
}

function showHelp() {
  console.log('\n' + chalk.hex('#87CEEB').bold('📖 Query Types:') + '\n');
  console.log(chalk.gray('  Stat blocks  - "show [name] statblock"'));
  console.log(chalk.gray('  Class info   - "seraph class features"'));
  console.log(chalk.gray('  Equipment    - "list weapons"'));
  console.log(chalk.gray('  Domain cards - "grace domain cards"\n'));
}

function showAnalysis(classification: any) {
  console.log(chalk.gray('\n┌─ Analysis ' + '─'.repeat(55)));
  console.log(chalk.gray('│ ') + chalk.hex('#87CEEB')('Type:   ') + chalk.white(classification.contentType));
  console.log(chalk.gray('│ ') + chalk.hex('#87CEEB')('Intent: ') + chalk.white(classification.intent));
  console.log(chalk.gray('│ ') + chalk.hex('#87CEEB')('Chunks: ') + chalk.white(classification.k));
  console.log(chalk.gray('└' + '─'.repeat(65)));
}

// ============================================================================
// MODEL SELECTION
// ============================================================================

function selectModel(classification: any, fastModel: BaseChatModel, accurateModel: BaseChatModel) {
  // CURRENTLY: Always use 3b for better accuracy
  // When you upgrade RAM, uncomment the logic below to use smart switching
  
  const USE_SMART_SWITCHING = false; // Set to true when you have more RAM
  
  if (USE_SMART_SWITCHING) {
    const useAccurateModel = [
      'show_adversary_statblock',
      'show_environment_statblock',
      'show_class_features',
      'show_domain_cards',
      'compare_items',
    ].includes(classification.intent);
    
    const model = useAccurateModel ? accurateModel : fastModel;
    const modelName = useAccurateModel ? '3b' : '1b';
    
    console.log(chalk.gray('🤖 Using ') + chalk.hex('#98FB98')(modelName) + chalk.gray(' model'));
    
    return model;
  } else {
    // Use 3b for everything for better accuracy
    console.log(chalk.gray('🤖 Using ') + chalk.hex('#98FB98')('3b') + chalk.gray(' model'));
    return accurateModel;
  }
}

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

function buildContext(relevantDocs: any[]): string {
  return relevantDocs
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
}

// ============================================================================
// QUERY PROCESSING
// ============================================================================

async function processQuery(
  question: string,
  vectorStore: Store,
  fastModel: BaseChatModel,
  accurateModel: BaseChatModel,
  formatter: CLIFormatter,
  debugMode: boolean
): Promise<void> {
  try {
    // Classify the query
    const classification = QueryClassifier.classify(question);
    showAnalysis(classification);

    // Select appropriate model
    const model = selectModel(classification, fastModel, accurateModel);

    // Retrieve relevant documents
    const relevantDocs = await vectorStore.similaritySearchWithScore(
      question,
      classification.k
    );

    if (relevantDocs.length === 0) {
      console.log(CLIFormatter.warning('No relevant documents found.'));
      return;
    }

    // DEBUG: Show top sources
    if (debugMode) {
      console.log(chalk.hex('#87CEEB')('\n📚 Top Sources:\n'));
      relevantDocs.slice(0, 5).forEach(([doc, score]: any, i: number) => {
        const source = doc.metadata?.source || 'Unknown';
        const section = doc.metadata?.section || '';
        console.log(chalk.gray(`  ${i + 1}. ${section || source} (${(score * 100).toFixed(1)}% match)`));
      });
      console.log();
    }

    // Build context from documents
    const context = buildContext(relevantDocs);

    // Get appropriate prompt template
    const promptTemplate = getPromptForIntent(classification.intent);
    const prompt = await promptTemplate.format({ context, question });

    // DEBUG: Show prompt and context info
    if (debugMode) {
      console.log(chalk.gray(`📝 Prompt: ${prompt.length} chars, Context: ${context.length} chars`));
      console.log(chalk.gray(`📊 Retrieved ${relevantDocs.length} document chunks\n`));
    }

    // Generate response
    console.log(chalk.hex('#87CEEB')('\n💡 Answer:\n'));
    
    const response = await model.invoke(prompt);
    const fullResponse = typeof response.content === 'string' ? response.content : '';

    // DEBUG: Show raw response
    if (debugMode) {
      console.log(chalk.gray(`\n📊 Raw response length: ${fullResponse.length} chars`));
      console.log(chalk.gray('📄 First 200 chars of raw response:'));
      console.log(chalk.yellow(fullResponse.substring(0, 200) + '...\n'));
    }

    // Format and display
    const formatted = formatter.format({
      intent: classification.intent,
      rawText: fullResponse,
    });

    console.log(formatted);

  } catch (error) {
    console.error(CLIFormatter.error(
      error instanceof Error ? error.message : 'Unknown error'
    ));
    
    if (debugMode && error instanceof Error) {
      console.error(chalk.gray('\n' + error.stack));
    }
  }
}

// ============================================================================
// READLINE INTERFACE (Node.js compatible)
// ============================================================================

async function createReadlineInterface() {
  // Try to use Node's readline if available, otherwise fallback
  try {
    const readline = await import('readline');
    return readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
  } catch {
    // Readline not available, return null to use alternative
    return null;
  }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function beautifulQuery() {
  try {
    // Load embeddings
    const embeddings = EmbeddingFactory.create(defaultConfig.embedding);

    // Load vector store
    const vectorStore = VectorStoreFactory.create(defaultConfig.vectorStore);
    const collectionInfo = await vectorStore.getCollectionInfo();

    if (!collectionInfo) {
      console.error(CLIFormatter.error('No database found. Please run: bun run init'));
      process.exit(1);
    }

    await vectorStore.loadExisting(embeddings);

    // Load both models
    const fastModel = ModelFactory.create(defaultConfig.fastModel);
    const accurateModel = ModelFactory.create(defaultConfig.accurateModel);

    // Show welcome screen
    showWelcome(collectionInfo.count);

    // State
    let debugMode = false;
    const formatter = new CLIFormatter(process.stdout.columns || 80);

    // Try to use readline
    const rl = await createReadlineInterface();
    
    if (rl) {
      // Use readline interface
      const askQuestion = () => {
        rl.question(chalk.hex('#FFD700')('\n❓ Your question: '), async (answer) => {
          const question = answer.trim();

          if (!question) {
            askQuestion();
            return;
          }

          // Handle commands
          if (question.toLowerCase() === 'exit') {
            console.log(chalk.hex('#9370DB')('\n👋 Goodbye!\n'));
            rl.close();
            process.exit(0);
          }

          if (question.toLowerCase() === 'debug') {
            debugMode = !debugMode;
            console.log(debugMode 
              ? CLIFormatter.success('Debug mode enabled')
              : CLIFormatter.info('Debug mode disabled')
            );
            askQuestion();
            return;
          }

          if (question.toLowerCase() === 'help') {
            showHelp();
            askQuestion();
            return;
          }

          // Process the query
          await processQuery(question, vectorStore, fastModel, accurateModel, formatter, debugMode);
          
          // Ask next question
          askQuestion();
        });
      };

      askQuestion();
      
    } else {
      // Fallback: Use simple stdin reading
      console.log(chalk.yellow('⚠️  Using simple stdin mode (readline not available)\n'));
      
      process.stdin.setEncoding('utf8');
      process.stdout.write(chalk.hex('#FFD700')('\n❓ Your question: '));

      for await (const line of console) {
        const question = line.trim();

        if (!question) {
          process.stdout.write(chalk.hex('#FFD700')('\n❓ Your question: '));
          continue;
        }

        if (question.toLowerCase() === 'exit') {
          console.log(chalk.hex('#9370DB')('\n👋 Goodbye!\n'));
          process.exit(0);
        }

        if (question.toLowerCase() === 'debug') {
          debugMode = !debugMode;
          console.log(debugMode 
            ? CLIFormatter.success('Debug mode enabled')
            : CLIFormatter.info('Debug mode disabled')
          );
          process.stdout.write(chalk.hex('#FFD700')('\n❓ Your question: '));
          continue;
        }

        if (question.toLowerCase() === 'help') {
          showHelp();
          process.stdout.write(chalk.hex('#FFD700')('\n❓ Your question: '));
          continue;
        }

        // Process the query
        await processQuery(question, vectorStore, fastModel, accurateModel, formatter, debugMode);
        
        process.stdout.write(chalk.hex('#FFD700')('\n❓ Your question: '));
      }
    }

  } catch (error) {
    console.error(CLIFormatter.error(
      error instanceof Error ? error.message : 'Unknown error'
    ));
    process.exit(1);
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

if (import.meta.main) {
  beautifulQuery();
}