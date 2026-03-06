import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import type { DocumentParser, ChunkStats } from './parser.interface';

interface MarkdownFrontmatter {
  title?: string;
  author?: string;
  date?: string;
  category?: string;
  tags?: string[];
  [key: string]: any;
}

interface MarkdownDocument {
  content: string;
  frontmatter: MarkdownFrontmatter;
  sections: MarkdownSection[];
}

interface MarkdownSection {
  level: number;
  title: string;
  content: string;
  startLine: number;
  endLine: number;
}

export class MarkdownParser implements DocumentParser {
  private splitter: RecursiveCharacterTextSplitter;

  constructor(
    private chunkSize = 800,
    private chunkOverlap = 100,
    private splitByHeaders = true
  ) {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: ['\n\n', '\n', ' ', ''],
    });
  }

  async parseDocument(filePath: string): Promise<Document[]> {
    console.log(`  📄 Loading: ${filePath}`);
    
    const content = readFileSync(filePath, 'utf-8');
    const parsed = this.parseMarkdownContent(content, filePath);
    
    if (this.splitByHeaders && parsed.sections.length > 0) {
      console.log(`  📑 Found ${parsed.sections.length} sections`);
      return this.chunkBySections(parsed, filePath);
    }
    
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

  async parseMultipleDocuments(filePaths: string[]): Promise<Document[]> {
    const allChunks: Document[] = [];
    
    for (const path of filePaths) {
      const chunks = await this.parseDocument(path);
      allChunks.push(...chunks);
    }
    
    console.log(`\n📊 Total Markdown chunks: ${allChunks.length}`);
    return allChunks;
  }

  getFilesFromDirectory(dirPath: string): string[] {
    const files: string[] = [];
    
    try {
      const items = readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = join(dirPath, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...this.getFilesFromDirectory(fullPath));
        } else if (
          item.endsWith('.md') || 
          item.endsWith('.markdown') ||
          item.endsWith('.mdx')
        ) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${dirPath}`);
    }
    
    return files;
  }

  private parseMarkdownContent(content: string, filePath: string): MarkdownDocument {
    let frontmatter: MarkdownFrontmatter = {};
    let markdownContent = content;
    
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    if (frontmatterMatch) {
      const yamlContent = frontmatterMatch[1];
      markdownContent = frontmatterMatch[2]!;
      frontmatter = this.parseYamlFrontmatter(yamlContent!);
    }
    
    const sections = this.extractSections(markdownContent);
    
    return {
      content: markdownContent,
      frontmatter,
      sections,
    };
  }

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
      
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value
          .slice(1, -1)
          .split(',')
          .map(v => v.trim().replace(/['"]/g, ''));
      }
      
      frontmatter[key] = value;
    }
    
    return frontmatter;
  }

  private extractSections(content: string): MarkdownSection[] {
    const sections: MarkdownSection[] = [];
    const lines = content.split('\n');
    
    let currentSection: MarkdownSection | null = null;
    let currentContent: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] as string;
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headerMatch) {
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim();
          currentSection.endLine = i - 1;
          sections.push(currentSection);
        }
        
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
    
    if (currentSection) {
      currentSection.content = currentContent.join('\n').trim();
      currentSection.endLine = lines.length - 1;
      sections.push(currentSection);
    }
    
    return sections;
  }

  private async chunkBySections(
    parsed: MarkdownDocument,
    filePath: string
  ): Promise<Document[]> {
    const chunks: Document[] = [];
    
    for (const section of parsed.sections) {
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

  getChunkStats(documents: Document[]): ChunkStats {
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
}