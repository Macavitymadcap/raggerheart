import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

/**
 * Markdown frontmatter interface
 */
interface MarkdownFrontmatter {
  title?: string;
  author?: string;
  date?: string;
  category?: string;
  tags?: string[];
  [key: string]: any;
}

/**
 * Markdown document with parsed content and metadata
 */
interface MarkdownDocument {
  content: string;
  frontmatter: MarkdownFrontmatter;
  sections: MarkdownSection[];
}

/**
 * A section of markdown (by header)
 */
interface MarkdownSection {
  level: number;
  title: string;
  content: string;
  startLine: number;
  endLine: number;
}

/**
 * Parser for Markdown documents with intelligent chunking
 */
export class MarkdownParser {
  private splitter: RecursiveCharacterTextSplitter;

  constructor(
    private chunkSize = 1000,
    private chunkOverlap = 200,
    private splitByHeaders = true
  ) {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: ['\n\n', '\n', ' ', ''],
    });
  }

  /**
   * Parse a single markdown file
   */
  async parseMarkdown(filePath: string): Promise<Document[]> {
    console.log(`  📄 Loading: ${filePath}`);
    
    const content = readFileSync(filePath, 'utf-8');
    const parsed = this.parseMarkdownContent(content, filePath);
    
    if (this.splitByHeaders && parsed.sections.length > 0) {
      console.log(`  📑 Found ${parsed.sections.length} sections`);
      return this.chunkBySections(parsed, filePath);
    }
    
    // Fallback to standard chunking
    console.log(`  ✂️  Splitting into chunks...`);
    const chunks = await this.splitter.createDocuments(
      [parsed.content],
      [{
        source: filePath,
        filename: basename(filePath),
        ...parsed.frontmatter,
      }]
    );
    
    console.log(`  ✅ Created ${chunks.length} chunks`);
    return chunks;
  }

  /**
   * Parse multiple markdown files
   */
  async parseMultipleMarkdown(filePaths: string[]): Promise<Document[]> {
    const allChunks: Document[] = [];
    
    for (const path of filePaths) {
      const chunks = await this.parseMarkdown(path);
      allChunks.push(...chunks);
    }
    
    console.log(`\n📊 Total chunks: ${allChunks.length}`);
    return allChunks;
  }

  /**
   * Parse all markdown files in a directory
   */
  async parseDirectory(dirPath: string): Promise<Document[]> {
    const files = this.getMarkdownFiles(dirPath);
    console.log(`\n📁 Found ${files.length} markdown files in ${dirPath}`);
    
    return this.parseMultipleMarkdown(files);
  }

  /**
   * Get all markdown files recursively from a directory
   */
  private getMarkdownFiles(dirPath: string): string[] {
    const files: string[] = [];
    
    const items = readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = join(dirPath, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Recurse into subdirectories
        files.push(...this.getMarkdownFiles(fullPath));
      } else if (
        item.endsWith('.md') || 
        item.endsWith('.markdown') ||
        item.endsWith('.mdx')
      ) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  /**
   * Parse markdown content with frontmatter
   */
  private parseMarkdownContent(
    content: string,
    filePath: string
  ): MarkdownDocument {
    let frontmatter: MarkdownFrontmatter = {};
    let markdownContent = content;
    
    // Parse YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    if (frontmatterMatch) {
      const yamlContent = frontmatterMatch[1];
      markdownContent = frontmatterMatch[2]!;
      
      // Simple YAML parsing (for basic key-value pairs)
      frontmatter = this.parseYamlFrontmatter(yamlContent!);
    }
    
    // Parse sections by headers
    const sections = this.extractSections(markdownContent);
    
    return {
      content: markdownContent,
      frontmatter,
      sections,
    };
  }

  /**
   * Simple YAML frontmatter parser
   */
  private parseYamlFrontmatter(yaml: string): MarkdownFrontmatter {
    const frontmatter: MarkdownFrontmatter = {};
    
    const lines = yaml.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = trimmed.substring(0, colonIndex).trim();
      let value: string | string[] = trimmed.substring(colonIndex + 1).trim();
      
      // Remove quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      
      // Parse arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value
          .slice(1, -1)
          .split(',')
          .map(v  => v.trim().replace(/['"]/g, ''));
      }
      
      frontmatter[key] = value;
    }
    
    return frontmatter;
  }

  /**
   * Extract sections by markdown headers
   */
  private extractSections(content: string): MarkdownSection[] {
    const sections: MarkdownSection[] = [];
    const lines = content.split('\n');
    
    let currentSection: MarkdownSection | null = null;
    let currentContent: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] as string;
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headerMatch) {
        // Save previous section
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim();
          currentSection.endLine = i - 1;
          sections.push(currentSection);
        }
        
        // Start new section
        const level = headerMatch[1]!.length;
        const title = headerMatch[2]!;
        
        currentSection = {
          level,
          title,
          content: '',
          startLine: i,
          endLine: i,
        };
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }
    
    // Save last section
    if (currentSection) {
      currentSection.content = currentContent.join('\n').trim();
      currentSection.endLine = lines.length - 1;
      sections.push(currentSection);
    }
    
    return sections;
  }

  /**
   * Chunk by sections intelligently
   */
  private async chunkBySections(
    parsed: MarkdownDocument,
    filePath: string
  ): Promise<Document[]> {
    const chunks: Document[] = [];
    
    for (const section of parsed.sections) {
      // If section is small enough, keep it as one chunk
      if (section.content.length <= this.chunkSize) {
        chunks.push(
          new Document({
            pageContent: section.content,
            metadata: {
              source: filePath,
              filename: basename(filePath),
              section: section.title,
              sectionLevel: section.level,
              ...parsed.frontmatter,
            },
          })
        );
      } else {
        // Split large sections
        const sectionChunks = await this.splitter.createDocuments(
          [section.content],
          [{
            source: filePath,
            filename: basename(filePath),
            section: section.title,
            sectionLevel: section.level,
            ...parsed.frontmatter,
          }]
        );
        
        chunks.push(...sectionChunks);
      }
    }
    
    console.log(`  ✅ Created ${chunks.length} chunks from ${parsed.sections.length} sections`);
    return chunks;
  }

  /**
   * Get chunk statistics
   */
  getChunkStats(documents: Document[]): {
    totalChunks: number;
    avgChunkSize: number;
    minChunkSize: number;
    maxChunkSize: number;
    withSections: number;
    uniqueSections: number;
  } {
    const sizes = documents.map(doc => doc.pageContent.length);
    const withSections = documents.filter(doc => doc.metadata.section).length;
    const uniqueSections = new Set(
      documents
        .filter(doc => doc.metadata.section)
        .map(doc => doc.metadata.section)
    ).size;
    
    return {
      totalChunks: documents.length,
      avgChunkSize: Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length),
      minChunkSize: Math.min(...sizes),
      maxChunkSize: Math.max(...sizes),
      withSections,
      uniqueSections,
    };
  }

  /**
   * Convert markdown to plain text (strip formatting)
   */
  static stripMarkdown(markdown: string): string {
    return markdown
      // Remove headers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      // Remove links [text](url) -> text
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      // Remove images ![alt](url)
      .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}$/gm, '')
      // Clean up multiple newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Extract code blocks from markdown
   */
  static extractCodeBlocks(markdown: string): Array<{
    language: string;
    code: string;
  }> {
    const codeBlocks: Array<{ language: string; code: string }> = [];
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      codeBlocks.push({
        language: match[1] || 'plaintext',
        code: match[2]!.trim(),
      });
    }
    
    return codeBlocks;
  }
}