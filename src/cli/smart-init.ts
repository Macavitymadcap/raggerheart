// src/cli/init.ts
import { defaultConfig } from '../rag/config';
import { SmartTTRPGParser } from '../rag/parsers/smart-ttrpg-parser';
import { EmbeddingFactory } from '../rag/embeddings/embedding-factory';
import { VectorStoreFactory } from '../rag/vectorstores/vector-store-factory';
import { existsSync } from 'fs';

async function init() {
  console.log('🚀 Initializing RAG Database with Smart TTRPG Parser\n');
  console.log('═'.repeat(60) + '\n');

  try {
    // Check if data directory exists
    const dataDir = './data';
    if (!existsSync(dataDir)) {
      console.error(`❌ Data directory not found: ${dataDir}`);
      console.error('Please create a ./data directory with your markdown files\n');
      process.exit(1);
    }

    // Initialize smart parser with STRICT size limits
    // Max 1000 chars = ~250 tokens, safe for any embedding model
    console.log('📄 Parsing documents with Smart TTRPG Parser...\n');
    const parser = new SmartTTRPGParser(
      1000,  // maxChunkSize - STRICT limit to prevent embedding errors
      100    // chunkOverlap
    );

    // Parse all documents
    const documents = await parser.parseDirectory(dataDir);

    // Show chunk statistics
    const stats = parser.getChunkStats(documents);
    console.log('\n📊 Chunk Statistics:');
    console.log(`  Total chunks: ${stats.totalChunks}`);
    console.log(`  Average size: ${stats.avgChunkSize} characters`);
    console.log(`  Min size: ${stats.minChunkSize} characters`);
    console.log(`  Max size: ${stats.maxChunkSize} characters`);
    console.log(`  Unique sections: ${stats.uniqueSections}`);
    
    if (stats.byType) {
      console.log('  By content type:');
      Object.entries(stats.byType).forEach(([type, count]) => {
        console.log(`    ${type}: ${count} chunks`);
      });
    }

    // CRITICAL: Verify no chunks exceed safe size
    const oversized = documents.filter(doc => doc.pageContent.length > 1200);
    if (oversized.length > 0) {
      console.error('\n⚠️  WARNING: Found oversized chunks that may cause embedding errors:');
      oversized.forEach(doc => {
        console.error(`  - ${doc.metadata.section}: ${doc.pageContent.length} chars`);
      });
      console.error('\nReducing maxChunkSize and re-running is recommended.\n');
    }

    // Create embeddings
    console.log('\n💾 Creating vector database...');
    const embeddings = EmbeddingFactory.create(defaultConfig.embedding);

    // Initialize vector store
    const vectorStore = VectorStoreFactory.create(defaultConfig.vectorStore);
    
    try {
      await vectorStore.initialize(documents, embeddings);
    } catch (error: any) {
      if (error.message?.includes('context length')) {
        console.error('\n❌ EMBEDDING ERROR: A chunk is too large for the embedding model.');
        console.error('This usually means a chunk exceeds ~8000 tokens.\n');
        console.error('Solutions:');
        console.error('  1. Reduce maxChunkSize in parser (try 800 or 600)');
        console.error('  2. Check which chunks are largest in the stats above');
        console.error('  3. Use a different embedding model with larger context\n');
        throw error;
      }
      throw error;
    }

    // Create payload indexes for better filtering (if supported)
    if (vectorStore.createPayloadIndex) {
      console.log('\n📇 Creating payload indexes...');
      
      const indexFields = [
        'source',
        'section',
        'documentType',
        'entityName',
        'tier',
        'role',
        'domain',
        'equipmentType',
        'sectionType',
      ];

      for (const field of indexFields) {
        try {
          await vectorStore.createPayloadIndex(field);
        } catch (error) {
          // Field may not exist in all docs, that's fine
        }
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Database initialized successfully!');
    console.log('═'.repeat(60) + '\n');
    console.log('Run queries with: bun run src/cli/beautiful-query.ts');
    console.log('Or standard query: bun run src/cli/query.ts\n');

  } catch (error) {
    console.error('\n❌ Error during initialization:');
    console.error(error instanceof Error ? error.message : error);
    
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

if (import.meta.main) {
  init();
}