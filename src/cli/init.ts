import { defaultConfig } from '../rag/config';
import { PDFParser } from '../rag/parsers/pdf-parser';
import { EmbeddingFactory } from '../rag/embeddings/embedding-factory';
import { VectorStoreFactory } from '../rag/vectorstores/vector-store-factory';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';

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

    console.log('\n📄 Parsing PDFs from ./data directory...\n');

    const dataDir = './data';
    if (!existsSync(dataDir)) {
      throw new Error(`Data directory not found: ${dataDir}`);
    }

    const pdfFiles = readdirSync(dataDir)
      .filter(file => file.toLowerCase().endsWith('.pdf'))
      .map(file => join(dataDir, file));

    if (pdfFiles.length === 0) {
      throw new Error('No PDF files found in ./data directory');
    }

    console.log(`Found ${pdfFiles.length} PDF file(s):`);
    pdfFiles.forEach(file => console.log(`  - ${file}`));
    console.log();

    const parser = new PDFParser(
      defaultConfig.chunkSize,
      defaultConfig.chunkOverlap
    );

    const documents = await parser.parseMultiplePDFs(pdfFiles);

    const stats = parser.getChunkStats(documents);
    console.log('\n📊 Chunk Statistics:');
    console.log(`  Total chunks: ${stats.totalChunks}`);
    console.log(`  Average size: ${stats.avgChunkSize} characters`);
    console.log(`  Min size: ${stats.minChunkSize} characters`);
    console.log(`  Max size: ${stats.maxChunkSize} characters`);

    console.log('\n💾 Creating vector database...');
    await vectorStore.initialize(documents, embeddings);
    
    console.log('\n═══════════════════════════════════════');
    console.log('✅ Database initialized successfully!');
    console.log('═══════════════════════════════════════');
    console.log('\nRun queries with: bun run query\n');

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (import.meta.main) {
  init();
}