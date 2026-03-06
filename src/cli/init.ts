import { defaultConfig } from '../rag/config';
import { SmartTTRPGParser } from '../rag/parsers/smart-ttrpg-parser';
import { EmbeddingFactory } from '../rag/embeddings/embedding-factory';
import { VectorStoreFactory } from '../rag/vectorstores/vector-store-factory';
import { existsSync } from 'fs';

async function init() {
  console.log('🚀 Initializing RAG Database\n');
  console.log('═══════════════════════════════════════');

  try {
    const embeddings = EmbeddingFactory.create(defaultConfig.embedding);
    const vectorStore = VectorStoreFactory.create(defaultConfig.vectorStore);
    const collectionInfo = await vectorStore.getCollectionInfo();

    if (collectionInfo) {
      console.log(`\n✅ Database already initialized!`);
      console.log(`📊 Documents in store: ${collectionInfo.count}`);
      console.log(`\nTo re-initialize, run: bun run reset && bun run init\n`);
      return;
    }

    console.log('\n📄 Parsing documents from ./data directory...\n');

    const dataDir = './data';
    if (!existsSync(dataDir)) {
      throw new Error(`Data directory not found: ${dataDir}`);
    }

    const parser = new SmartTTRPGParser(
      defaultConfig.chunkSize,
      defaultConfig.chunkOverlap
    );

    const documents = await parser.parseDirectory(dataDir);

    const stats = parser.getChunkStats(documents);
    console.log('\n📊 Chunk Statistics:');
    console.log(`  Total chunks: ${stats.totalChunks}`);
    console.log(`  Average size: ${stats.avgChunkSize} characters`);
    console.log(`  Min size: ${stats.minChunkSize} characters`);
    console.log(`  Max size: ${stats.maxChunkSize} characters`);
    console.log(`  Chunks with sections: ${stats.withSections}`);
    console.log(`  By format:`, stats.byFormat);

    console.log('\n💾 Creating vector database...');
    await vectorStore.initialize(documents, embeddings);
    
    // Create payload indexes for filtering
    if (defaultConfig.vectorStore.provider === 'qdrant') {
      console.log('\n📇 Creating payload indexes...');
      await (vectorStore as any).createPayloadIndex('source');
      await (vectorStore as any).createPayloadIndex('section');
    }
    
    console.log('\n═══════════════════════════════════════');
    console.log('✅ Database initialized successfully!');
    console.log('═══════════════════════════════════════');
    console.log('\nRun queries with: bun run query');
    console.log('Start server with: bun run dev\n');

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (import.meta.main) {
  init();
}