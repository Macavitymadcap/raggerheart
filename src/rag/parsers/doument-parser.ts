import type { Document } from '@langchain/core/documents';
import { PDFParser } from './pdf-parser';
import { MarkdownParser } from './markdown-parser';
import { existsSync } from 'fs';
import { extname } from 'path';

/**
 * Supported document types
 */
export type DocumentType = 'pdf' | 'markdown' | 'unknown';

/**
 * Unified document parser that handles multiple formats
 */
export class DocumentParser {
  private pdfParser: PDFParser;
  private markdownParser: MarkdownParser;

  constructor(chunkSize = 1000, chunkOverlap = 200) {
    this.pdfParser = new PDFParser(chunkSize, chunkOverlap);
    this.markdownParser = new MarkdownParser(chunkSize, chunkOverlap, true);
  }

  /**
   * Detect document type from file extension
   */
  static detectType(filePath: string): DocumentType {
    const ext = extname(filePath).toLowerCase();
    
    if (ext === '.pdf') return 'pdf';
    if (['.md', '.markdown', '.mdx'].includes(ext)) return 'markdown';
    
    return 'unknown';
  }

  /**
   * Parse a single document (auto-detect format)
   */
  async parseDocument(filePath: string): Promise<Document[]> {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const type = DocumentParser.detectType(filePath);

    switch (type) {
      case 'pdf':
        return this.pdfParser.parsePDF(filePath);
      
      case 'markdown':
        return this.markdownParser.parseMarkdown(filePath);
      
      default:
        throw new Error(`Unsupported file type: ${filePath}`);
    }
  }

  /**
   * Parse multiple documents (mixed formats supported)
   */
  async parseMultipleDocuments(filePaths: string[]): Promise<Document[]> {
    const allChunks: Document[] = [];
    
    // Group files by type for batch processing
    const filesByType: Record<DocumentType, string[]> = {
      pdf: [],
      markdown: [],
      unknown: [],
    };

    for (const path of filePaths) {
      const type = DocumentParser.detectType(path);
      filesByType[type].push(path);
    }

    // Process PDFs
    if (filesByType.pdf.length > 0) {
      console.log(`\n📄 Processing ${filesByType.pdf.length} PDF files...`);
      const pdfChunks = await this.pdfParser.parseMultiplePDFs(filesByType.pdf);
      allChunks.push(...pdfChunks);
    }

    // Process Markdown
    if (filesByType.markdown.length > 0) {
      console.log(`\n📝 Processing ${filesByType.markdown.length} Markdown files...`);
      const mdChunks = await this.markdownParser.parseMultipleMarkdown(filesByType.markdown);
      allChunks.push(...mdChunks);
    }

    // Warn about unknown types
    if (filesByType.unknown.length > 0) {
      console.warn(`\n⚠️  Skipping ${filesByType.unknown.length} unsupported files:`);
      filesByType.unknown.forEach(file => console.warn(`  - ${file}`));
    }

    console.log(`\n📊 Total chunks across all formats: ${allChunks.length}`);
    return allChunks;
  }

  /**
   * Parse all documents in a directory (auto-detect all formats)
   */
  async parseDirectory(dirPath: string): Promise<Document[]> {
    const allChunks: Document[] = [];

    // Get PDFs
    const pdfFiles = await this.pdfParser.parseMultiplePDFs([dirPath]) || [];
    if (pdfFiles.length > 0) {
      console.log(`\n📄 Found ${pdfFiles.length} PDF files`);
      const pdfChunks = await this.pdfParser.parseMultiplePDFs(pdfFiles);
      allChunks.push(...pdfChunks);
    }

    // Get Markdown files
    const mdFiles = this.markdownParser['getMarkdownFiles'](dirPath);
    if (mdFiles.length > 0) {
      console.log(`\n📝 Found ${mdFiles.length} Markdown files`);
      const mdChunks = await this.markdownParser.parseMultipleMarkdown(mdFiles);
      allChunks.push(...mdChunks);
    }

    if (allChunks.length === 0) {
      throw new Error(`No supported documents found in ${dirPath}`);
    }

    console.log(`\n📊 Total chunks: ${allChunks.length}`);
    return allChunks;
  }

  /**
   * Get comprehensive statistics
   */
  getStats(documents: Document[]): {
    totalChunks: number;
    byFormat: Record<string, number>;
    avgChunkSize: number;
    minChunkSize: number;
    maxChunkSize: number;
    withSections: number;
    uniqueSources: number;
  } {
    const byFormat: Record<string, number> = {};
    const sizes = documents.map(doc => doc.pageContent.length);
    const withSections = documents.filter(doc => doc.metadata.section).length;
    const uniqueSources = new Set(documents.map(doc => doc.metadata.source)).size;

    // Count by format
    for (const doc of documents) {
      const source = doc.metadata.source || '';
      const ext = extname(source).toLowerCase();
      const format = ext || 'unknown';
      byFormat[format] = (byFormat[format] || 0) + 1;
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