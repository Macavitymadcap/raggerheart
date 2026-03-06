import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import type { Document } from '@langchain/core/documents';

export class PDFParser {
  private splitter: RecursiveCharacterTextSplitter;

  constructor(chunkSize = 1000, chunkOverlap = 200) {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: ['\n\n', '\n', ' ', ''],
    });
  }

  /**
   * Parse a single PDF file into chunks
   */
  async parsePDF(filePath: string): Promise<Document[]> {
    console.log(`  📄 Loading: ${filePath}`);
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();
    
    console.log(`  ✂️  Splitting into chunks...`);
    const chunks = await this.splitter.splitDocuments(docs);
    console.log(`  ✅ Created ${chunks.length} chunks`);
    
    return chunks;
  }

  /**
   * Parse multiple PDF files
   */
  async parseMultiplePDFs(filePaths: string[]): Promise<Document[]> {
    const allChunks: Document[] = [];
    
    for (const path of filePaths) {
      const chunks = await this.parsePDF(path);
      allChunks.push(...chunks);
    }
    
    console.log(`\n📊 Total chunks: ${allChunks.length}`);
    return allChunks;
  }

  /**
   * Get chunk statistics
   */
  getChunkStats(documents: Document[]): {
    totalChunks: number;
    avgChunkSize: number;
    minChunkSize: number;
    maxChunkSize: number;
  } {
    const sizes = documents.map(doc => doc.pageContent.length);
    
    return {
      totalChunks: documents.length,
      avgChunkSize: Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length),
      minChunkSize: Math.min(...sizes),
      maxChunkSize: Math.max(...sizes),
    };
  }
}