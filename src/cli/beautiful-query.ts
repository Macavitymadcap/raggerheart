// src/cli/beautiful-query.ts
import { defaultConfig } from '../rag/config';
import { EmbeddingFactory } from '../rag/embeddings/embedding-factory';
import { ModelFactory } from '../rag/models/model-factory';
import { VectorStoreFactory } from '../rag/vectorstores/vector-store-factory';
import { QueryClassifier } from '../rag/query-classifier';
import { getPromptForIntent } from '../ui/enhanced-prompts';
import { CLIFormatter } from './cli-formatter';
import * as readline from 'readline';
import chalk from 'chalk';

async function beautifulQuery() {
  console.log(chalk.hex('#FFD700').bold('\n🚀 Daggerheart RAG System\n'));

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

    console.log(CLIFormatter.success(`Loaded ${collectionInfo.count} document chunks`));
    await vectorStore.loadExisting(embeddings);

    // Load both models
    const fastModel = ModelFactory.create(defaultConfig.fastModel);
    const accurateModel = ModelFactory.create(defaultConfig.accurateModel);

    console.log(CLIFormatter.success('System ready!\n'));
    
    console.log(chalk.hex('#87CEEB')('💡 Examples:'));
    console.log(chalk.gray('  • "show me the skeleton archer statblock"'));
    console.log(chalk.gray('  • "list all seraph class features"'));
    console.log(chalk.gray('  • "what weapons are available?"'));
    console.log(chalk.gray('  • "show grace domain cards"\n'));
    
    console.log(chalk.hex('#87CEEB')('📖 Commands:'));
    console.log(chalk.gray('  • exit    - Quit'));
    console.log(chalk.gray('  • help    - Show help'));
    console.log(chalk.gray('  • debug   - Toggle debug mode'));
    console.log(chalk.gray('  • clear   - Clear screen\n'));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let debugMode = false;
    const formatter = new CLIFormatter(process.stdout.columns || 80);

    const askQuestion = () => {
      rl.question(chalk.hex('#FFD700')('\n❓ Your question: '), async (input) => {
        const question = input.trim();

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

        if (question.toLowerCase() === 'clear') {
          console.clear();
          console.log(chalk.hex('#FFD700').bold('\n🚀 Daggerheart RAG System\n'));
          askQuestion();
          return;
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
          console.log('\n' + chalk.hex('#87CEEB').bold('📖 Query Types:') + '\n');
          console.log(chalk.gray('  Stat blocks  - "show [name] statblock" or "stats for [name]"'));
          console.log(chalk.gray('  Class info   - "seraph class features" or "warrior abilities"'));
          console.log(chalk.gray('  Equipment    - "list weapons" or "show armor table"'));
          console.log(chalk.gray('  Domain cards - "grace domain cards" or "show codex spells"'));
          console.log(chalk.gray('  General      - "how does downtime work?" or "explain hope"\n'));
          askQuestion();
          return;
        }

        try {
          // Classify the query
          const classification = QueryClassifier.classify(question);
          
          console.log(chalk.gray('\n┌─ Query Analysis ' + '─'.repeat(60)));
          console.log(chalk.gray('│ ') + chalk.hex('#87CEEB')('Type:    ') + chalk.white(classification.contentType));
          console.log(chalk.gray('│ ') + chalk.hex('#87CEEB')('Intent:  ') + chalk.white(classification.intent));
          console.log(chalk.gray('│ ') + chalk.hex('#87CEEB')('Chunks:  ') + chalk.white(classification.k));
          
          if (classification.entities.length > 0) {
            console.log(chalk.gray('│ ') + chalk.hex('#87CEEB')('Entities:') + chalk.white(' ' + classification.entities.join(', ')));
          }
          
          console.log(chalk.gray('└' + '─'.repeat(70)));

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
          
          console.log(chalk.gray('\n🤖 Using ') + chalk.hex('#98FB98')(modelName) + chalk.gray(' model'));

          // Retrieve relevant documents
          console.log(chalk.gray(`🔍 Searching for relevant chunks...\n`));
          const relevantDocs = await vectorStore.similaritySearchWithScore(
            question,
            classification.k
          );

          if (relevantDocs.length === 0) {
            console.log(CLIFormatter.warning('No relevant documents found.'));
            askQuestion();
            return;
          }

          // Show sources
          if (debugMode) {
            console.log(chalk.hex('#87CEEB')('\n📚 Top Sources:\n'));
            relevantDocs.slice(0, 5).forEach(([doc, score]: any, i: number) => {
              const source = doc.metadata?.source || 'Unknown';
              const section = doc.metadata?.section || '';
              console.log(chalk.gray(`  ${i + 1}. ${section ? section + ' ' : ''}(${(score * 100).toFixed(1)}%)`));
            });
          }

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
            console.log(chalk.gray('\n📝 Prompt length: ' + prompt.length + ' chars\n'));
          }

          // Get response
          console.log(chalk.hex('#87CEEB')('\n💡 Answer:\n'));
          
          const stream = await model.stream(prompt);
          let fullResponse = '';
          
          for await (const chunk of stream) {
            const text = typeof chunk.content === 'string' 
              ? chunk.content 
              : '';
            fullResponse += text;
          }

          // Format and display the response
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
            console.error(chalk.gray('\nStack trace:\n' + error.stack));
          }
        }

        askQuestion();
      });
    };

    askQuestion();

  } catch (error) {
    console.error(CLIFormatter.error(
      error instanceof Error ? error.message : 'Unknown error'
    ));
    process.exit(1);
  }
}

if (import.meta.main) {
  beautifulQuery();
}