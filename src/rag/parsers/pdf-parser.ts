import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import type { Document } from '@langchain/core/documents';
import type { DocumentParser, ChunkStats } from './parser.interface';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

export class PDFParser implements DocumentParser {
  private splitter: RecursiveCharacterTextSplitter;

  constructor(chunkSize = 800, chunkOverlap = 100) {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: [
        '\n## ',      // Section headers
        '\n### ',     // Subsection headers
        '\nTier ',    // Stat blocks
        '\n\n',       // Paragraphs
        '\n',
        ' ',
      ],
    });
  }

  async parseDocument(filePath: string): Promise<Document[]> {
    console.log(`  📄 Loading: ${filePath}`);
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();
    
    console.log(`  ✂️  Splitting into chunks...`);
    const chunks = await this.splitter.splitDocuments(docs);
    console.log(`  ✅ Created ${chunks.length} chunks`);
    
    return chunks;
  }

  async parseMultipleDocuments(filePaths: string[]): Promise<Document[]> {
    const allChunks: Document[] = [];
    
    for (const path of filePaths) {
      const chunks = await this.parseDocument(path);
      allChunks.push(...chunks);
    }
    
    console.log(`\n📊 Total PDF chunks: ${allChunks.length}`);
    return allChunks;
  }

  /**
   * Get all PDF files from a directory recursively
   */
  getFilesFromDirectory(dirPath: string): string[] {
    const files: string[] = [];
    
    try {
      const items = readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = join(dirPath, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...this.getFilesFromDirectory(fullPath));
        } else if (item.toLowerCase().endsWith('.pdf')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${dirPath}`);
    }
    
    return files;
  }

  getChunkStats(documents: Document[]): ChunkStats {
    const sizes = documents.map(doc => doc.pageContent.length);
    
    return {
      totalChunks: documents.length,
      avgChunkSize: Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length),
      minChunkSize: Math.min(...sizes),
      maxChunkSize: Math.max(...sizes),
    };
  }
}