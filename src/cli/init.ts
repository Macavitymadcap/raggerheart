// src/cli/init.ts
// UPDATED WITH YAML FRONTMATTER SUPPORT AND ENHANCED METADATA
import { defaultConfig } from '../rag/config';
import { SmartTTRPGParser } from '../rag/parsers/smart-ttrpg-parser';
import { EmbeddingFactory } from '../rag/embedding-factory';
import { VectorStoreFactory } from '../rag/vectorstores/vector-store-factory';
import { existsSync } from 'fs';

async function init() {
  console.log('🚀 Initializing RAG Database with Enhanced Metadata\n');
  console.log('═'.repeat(60) + '\n');

  try {
    // Check if database already exists
    const embeddings = EmbeddingFactory.create(defaultConfig.embedding);
    const vectorStore = VectorStoreFactory.create(defaultConfig.vectorStore);
    const collectionInfo = await vectorStore.getCollectionInfo();

    if (collectionInfo) {
      console.log(`\n✅ Database already initialized!`);
      console.log(`📊 Documents in store: ${collectionInfo.count}`);
      console.log(`\nTo re-initialize, run: bun run reset && bun run init\n`);
      return;
    }

    // Check if data directory exists
    const dataDir = './data';
    if (!existsSync(dataDir)) {
      console.error(`❌ Data directory not found: ${dataDir}`);
      console.error('Please create a ./data directory with your markdown files\n');
      process.exit(1);
    }

    console.log('📄 Parsing documents with Smart TTRPG Parser (YAML frontmatter enabled)...\n');
    const parser = new SmartTTRPGParser(
      defaultConfig.chunkSize,  
      defaultConfig.chunkOverlap
    );

    // Parse all documents
    const documents = await parser.parseDirectory(dataDir);

    // Show enhanced chunk statistics
    const stats = parser.getChunkStats(documents);
    console.log('\n📊 Chunk Statistics:');
    console.log(`  Total chunks: ${stats.totalChunks}`);
    console.log(`  Average size: ${stats.avgChunkSize} characters`);
    console.log(`  Min size: ${stats.minChunkSize} characters`);
    console.log(`  Max size: ${stats.maxChunkSize} characters`);
    console.log(`  Unique sections: ${stats.uniqueSections}`);
    console.log(`  Unique sources: ${stats.uniqueSources}`);
    
    if (stats.byType) {
      console.log('\n  By content type:');
      Object.entries(stats.byType).forEach(([type, count]) => {
        console.log(`    ${type}: ${count} chunks`);
      });
    }
    
    if (stats.byTier && Object.keys(stats.byTier).length > 0) {
      console.log('\n  By tier:');
      Object.entries(stats.byTier).forEach(([tier, count]) => {
        console.log(`    ${tier}: ${count} chunks`);
      });
    }
    
    if (stats.byTags && Object.keys(stats.byTags).length > 0) {
      console.log('\n  By tags (top 10):');
      const sortedTags = Object.entries(stats.byTags)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 10);
      
      sortedTags.forEach(([tag, count]) => {
        console.log(`    ${tag}: ${count} chunks`);
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

    // Create vector database
    console.log('\n💾 Creating vector database...');
    
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

    // Create payload indexes for enhanced filtering (Qdrant only)
    // Check if createCommonIndexes method exists (type-safe check)
    if ('createCommonIndexes' in vectorStore && typeof vectorStore.createCommonIndexes === 'function') {
      console.log('\n📇 Creating payload indexes for metadata filtering...');
      await vectorStore.createCommonIndexes();
    } else if ('createPayloadIndex' in vectorStore && typeof vectorStore.createPayloadIndex === 'function') {
      // Fallback: create indexes manually if createCommonIndexes not available
      console.log('\n📇 Creating payload indexes...');
      
      const indexFields = [
        'source',
        'section',
        'documentType',
        'entityName',
        'tier',
        'level',
        'role',
        'domain',
        'equipmentType',
        'category',
        'sectionType',
        'tags',
        'difficulty',
        'card_type',
      ];

      for (const field of indexFields) {
        try {
          await (vectorStore as any).createPayloadIndex(field);
        } catch (error) {
          // Field may not exist in all docs, that's fine
        }
      }
    } else {
      console.log('\n⚠️  Payload indexes not supported for this vector store (Qdrant recommended)');
    }

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Database initialized successfully!');
    console.log('═'.repeat(60) + '\n');
    
    console.log('📋 Next steps:');
    console.log('  • Run queries: bun run query');
    console.log('  • Start server: bun run dev');
    console.log('  • Beautiful CLI: bun run query');

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