import type { Document } from '@langchain/core/documents';
import { PDFParser } from './pdf-parser';
import { MarkdownParser } from './markdown-parser';
import type { DocumentParser, ChunkStats } from './parser.interface';
import { existsSync } from 'fs';
import { extname } from 'path';

export type DocumentType = 'pdf' | 'markdown' | 'unknown';

export class UnifiedParser implements DocumentParser {
  private pdfParser: PDFParser;
  private markdownParser: MarkdownParser;

  constructor(chunkSize = 800, chunkOverlap = 100) {
    this.pdfParser = new PDFParser(chunkSize, chunkOverlap);
    this.markdownParser = new MarkdownParser(chunkSize, chunkOverlap, true);
  }

  static detectType(filePath: string): DocumentType {
    const ext = extname(filePath).toLowerCase();
    
    if (ext === '.pdf') return 'pdf';
    if (['.md', '.markdown', '.mdx'].includes(ext)) return 'markdown';
    
    return 'unknown';
  }

  async parseDocument(filePath: string): Promise<Document[]> {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const type = UnifiedParser.detectType(filePath);

    switch (type) {
      case 'pdf':
        return this.pdfParser.parseDocument(filePath);
      
      case 'markdown':
        return this.markdownParser.parseDocument(filePath);
      
      default:
        throw new Error(`Unsupported file type: ${filePath}`);
    }
  }

  async parseMultipleDocuments(filePaths: string[]): Promise<Document[]> {
    const allChunks: Document[] = [];
    
    const filesByType: Record<DocumentType, string[]> = {
      pdf: [],
      markdown: [],
      unknown: [],
    };

    for (const path of filePaths) {
      const type = UnifiedParser.detectType(path);
      filesByType[type].push(path);
    }

    if (filesByType.pdf.length > 0) {
      console.log(`\n📄 Found ${filesByType.pdf.length} PDF files`);
      const pdfChunks = await this.pdfParser.parseMultipleDocuments(filesByType.pdf);
      allChunks.push(...pdfChunks);
    }

    if (filesByType.markdown.length > 0) {
      console.log(`\n📝 Found ${filesByType.markdown.length} Markdown files`);
      const mdChunks = await this.markdownParser.parseMultipleDocuments(filesByType.markdown);
      allChunks.push(...mdChunks);
    }

    if (filesByType.unknown.length > 0) {
      console.warn(`\n⚠️  Skipping ${filesByType.unknown.length} unsupported files:`);
      filesByType.unknown.forEach(file => console.warn(`  - ${file}`));
    }

    console.log(`\n📊 Total chunks across all formats: ${allChunks.length}`);
    return allChunks;
  }

  async parseDirectory(dirPath: string): Promise<Document[]> {
    if (!existsSync(dirPath)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

    const allFiles: string[] = [];
    
    // Collect all supported files
    const pdfFiles = this.pdfParser.getFilesFromDirectory(dirPath);
    const mdFiles = this.markdownParser.getFilesFromDirectory(dirPath);
    
    allFiles.push(...pdfFiles, ...mdFiles);

    if (allFiles.length === 0) {
      throw new Error(`No supported documents found in ${dirPath}`);
    }

    return this.parseMultipleDocuments(allFiles);
  }

  getChunkStats(documents: Document[]): ChunkStats {
    const byFormat: Record<string, number> = {};
    const sizes = documents.map(doc => doc.pageContent.length);
    const withSections = documents.filter(doc => doc.metadata.section).length;
    const uniqueSources = new Set(documents.map(doc => doc.metadata.source)).size;

    for (const doc of documents) {
      const source = doc.metadata.source || '';
      const ext = extname(source).toLowerCase() || 'unknown';
      byFormat[ext] = (byFormat[ext] || 0) + 1;
    }

    return {
      totalChunks: documents.length,
      byFormat,
      avgChunkSize: Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length),
      minChunkSize: Math.min(...sizes),
      maxChunkSize: Math.max(...sizes),
      withSections,
      uniqueSources,
    };
  }
}