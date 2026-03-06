// src/rag/parsers/smart-ttrpg-parser.ts
// FINAL OPTIMIZED VERSION - Handles tables correctly
import { Document } from '@langchain/core/documents';
import { readFileSync, readdirSync, statSync } from 'fs';
import { basename, join } from 'path';
import type { DocumentParser, ChunkStats } from './parser.interface';
import type { ContentType, EnhancedMetadata } from '../../types/query';

interface EntityBlock {
  type: 'stat_block' | 'class_feature' | 'domain_card' | 'equipment_table' | 'section';
  title: string;
  content: string;
  metadata: Partial<EnhancedMetadata>;
  startLine: number;
  endLine: number;
}

/**
 * FINAL OPTIMIZED Smart TTRPG Parser
 * - Strict 800 char limit (safe for all embedding models)
 * - Smart table splitting (by rows, not paragraphs)
 * - All content types supported
 */
export class SmartTTRPGParser implements DocumentParser {
  private maxChunkSize: number;
  private chunkOverlap: number;

  constructor(maxChunkSize = 800, chunkOverlap = 80) {
    this.maxChunkSize = maxChunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  async parseDocument(filePath: string): Promise<Document[]> {
    console.log(`  📄 Loading: ${filePath}`);
    
    const content = readFileSync(filePath, 'utf-8');
    const filename = basename(filePath);
    const documentType = this.detectDocumentType(filename);
    const entities = this.extractEntities(content, documentType, filePath);
    
    console.log(`  🎯 Found ${entities.length} complete entities`);
    
    const documents: Document[] = [];
    
    for (const entity of entities) {
      if (entity.content.length > this.maxChunkSize) {
        console.log(`  ⚠️  Splitting: ${entity.title} (${entity.content.length} chars)`);
        const subChunks = this.splitLargeEntity(entity);
        documents.push(...subChunks);
      } else {
        documents.push(
          new Document({
            pageContent: entity.content,
            metadata: {
              source: filePath,
              filename,
              section: entity.title,
              documentType,
              ...entity.metadata,
            },
          })
        );
      }
    }
    
    console.log(`  ✅ Created ${documents.length} chunks`);
    return documents;
  }

  async parseMultipleDocuments(filePaths: string[]): Promise<Document[]> {
    const allChunks: Document[] = [];
    for (const path of filePaths) {
      const chunks = await this.parseDocument(path);
      allChunks.push(...chunks);
    }
    console.log(`\n📊 Total chunks: ${allChunks.length}`);
    return allChunks;
  }

  async parseDirectory(dirPath: string): Promise<Document[]> {
    console.log(`\n📂 Scanning directory: ${dirPath}`);
    const files = this.getFilesFromDirectory(dirPath);
    
    if (files.length === 0) {
      throw new Error(`No markdown files found in ${dirPath}`);
    }
    
    console.log(`📝 Found ${files.length} markdown files\n`);
    return this.parseMultipleDocuments(files);
  }

  private getFilesFromDirectory(dirPath: string): string[] {
    const files: string[] = [];
    
    try {
      const items = readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = join(dirPath, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...this.getFilesFromDirectory(fullPath));
        } else if (item.endsWith('.md') || item.endsWith('.markdown') || item.endsWith('.mdx')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${dirPath}`);
    }
    
    return files;
  }

  private detectDocumentType(filename: string): ContentType {
    const lower = filename.toLowerCase();
    
    if (lower.includes('adversaries-tier')) return 'adversary';
    if (lower.includes('environments-tier')) return 'environment';
    if (lower.includes('-class.md')) return 'class';
    if (lower.includes('-domain-cards.md')) return 'domain_card';
    if (lower.includes('weapons.md')) return 'weapon';
    if (lower.includes('armor.md')) return 'armor';
    if (lower.includes('consumables.md')) return 'consumable';
    if (lower.includes('loot.md')) return 'loot';
    if (lower.includes('ancestries.md')) return 'ancestry';
    if (lower.includes('communities.md')) return 'community';
    
    return 'general';
  }

  private extractEntities(
    content: string,
    documentType: ContentType,
    filePath: string
  ): EntityBlock[] {
    const lines = content.split('\n');
    
    switch (documentType) {
      case 'adversary':
      case 'environment':
        return this.extractStatBlocks(lines, documentType, filePath);
      case 'class':
        return this.extractClassContent(lines, filePath);
      case 'domain_card':
        return this.extractDomainCards(lines, filePath);
      case 'weapon':
      case 'armor':
      case 'consumable':
      case 'loot':
        return this.extractEquipmentSections(lines, filePath, documentType);
      default:
        return this.extractGenericSections(lines, filePath);
    }
  }

  private extractStatBlocks(
    lines: string[],
    type: 'adversary' | 'environment',
    filePath: string
  ): EntityBlock[] {
    const entities: EntityBlock[] = [];
    let currentBlock: string[] = [];
    let blockTitle = '';
    let blockStart = 0;
    let tier: number | undefined;
    let role: string | undefined;
    let inStatBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      const trimmed = line.trim();
      const headerMatch = trimmed.match(/^#{2,3}\s+([A-Z\s&'-]+)$/);
      
      if (headerMatch && trimmed.length > 5) {
        if (inStatBlock && currentBlock.length > 3) {
          const content = currentBlock.join('\n').trim();
          if (content.length > 0) {
            entities.push({
              type: 'stat_block',
              title: blockTitle,
              content,
              metadata: {
                documentType: type,
                entityName: blockTitle,
                tier,
                role,
                sectionType: 'stat_block',
              },
              startLine: blockStart,
              endLine: i - 1,
            });
          }
        }

        blockTitle = headerMatch[1]!.trim();
        currentBlock = [line];
        blockStart = i;
        inStatBlock = true;
        tier = undefined;
        role = undefined;
        continue;
      }

      if (inStatBlock) {
        currentBlock.push(line);
        if (!tier) {
          const tierMatch = trimmed.match(/Tier\s+(\d+)/i);
          if (tierMatch) tier = parseInt(tierMatch[1]!);
        }
        if (!role && type === 'adversary') {
          const roleMatch = trimmed.match(/Tier\s+\d+\s+(Minion|Standard|Support|Leader|Solo|Bruiser)/i);
          if (roleMatch) role = roleMatch[1];
        }
      }
    }

    if (currentBlock.length > 3 && inStatBlock) {
      const content = currentBlock.join('\n').trim();
      if (content.length > 0) {
        entities.push({
          type: 'stat_block',
          title: blockTitle,
          content,
          metadata: {
            documentType: type,
            entityName: blockTitle,
            tier,
            role,
            sectionType: 'stat_block',
          },
          startLine: blockStart,
          endLine: lines.length - 1,
        });
      }
    }

    return entities;
  }

  private extractClassContent(lines: string[], filePath: string): EntityBlock[] {
    const entities: EntityBlock[] = [];
    const className = this.extractClassName(filePath);
    
    let currentSection: string[] = [];
    let sectionTitle = `${className}`;
    let sectionType = 'description';
    let sectionStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      const trimmed = line.trim();
      const majorHeader = trimmed.match(/^#{2,3}\s+(.+)$/);
      
      if (majorHeader) {
        if (currentSection.length > 2) {
          const content = currentSection.join('\n').trim();
          entities.push({
            type: 'class_feature',
            title: sectionTitle,
            content,
            metadata: {
              documentType: 'class',
              section: sectionTitle,
              sectionType,
            },
            startLine: sectionStart,
            endLine: i - 1,
          });
        }

        const headerText = majorHeader[1]!.toUpperCase();
        
        if (headerText.includes('FOUNDATION')) {
          sectionType = 'foundation_features';
        } else if (headerText.includes('SPECIALIZATION')) {
          sectionType = 'specialization_features';
        } else if (headerText.includes('MASTERY')) {
          sectionType = 'mastery_features';
        } else if (headerText.includes('SUBCLASS')) {
          sectionType = 'subclasses';
        } else {
          sectionType = 'description';
        }
        
        sectionTitle = `${className} - ${majorHeader[1]}`;
        currentSection = [line];
        sectionStart = i;
      } else {
        currentSection.push(line);
      }
    }

    if (currentSection.length > 2) {
      const content = currentSection.join('\n').trim();
      entities.push({
        type: 'class_feature',
        title: sectionTitle,
        content,
        metadata: {
          documentType: 'class',
          section: sectionTitle,
          sectionType,
        },
        startLine: sectionStart,
        endLine: lines.length - 1,
      });
    }

    return entities;
  }

  private extractDomainCards(lines: string[], filePath: string): EntityBlock[] {
    const entities: EntityBlock[] = [];
    const domain = this.extractDomainName(filePath);
    
    let currentCard: string[] = [];
    let cardTitle = '';
    let cardStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      const trimmed = line.trim();
      const cardHeader = trimmed.match(/^###\s+(.+)$/);

      if (cardHeader) {
        if (currentCard.length > 1) {
          const content = currentCard.join('\n').trim();
          if (content.length > 0) {
            entities.push({
              type: 'domain_card',
              title: cardTitle,
              content,
              metadata: {
                documentType: 'domain_card',
                domain,
                section: cardTitle,
                sectionType: 'domain_card',
              },
              startLine: cardStart,
              endLine: i - 1,
            });
          }
        }

        cardTitle = cardHeader[1]!.trim();
        currentCard = [line];
        cardStart = i;
      } else {
        currentCard.push(line);
      }
    }

    if (currentCard.length > 1) {
      const content = currentCard.join('\n').trim();
      if (content.length > 0) {
        entities.push({
          type: 'domain_card',
          title: cardTitle,
          content,
          metadata: {
            documentType: 'domain_card',
            domain,
            section: cardTitle,
            sectionType: 'domain_card',
          },
          startLine: cardStart,
          endLine: lines.length - 1,
        });
      }
    }

    return entities;
  }

  private extractEquipmentSections(
    lines: string[],
    filePath: string,
    equipmentType: ContentType
  ): EntityBlock[] {
    const entities: EntityBlock[] = [];
    let currentSection: string[] = [];
    let sectionTitle = '';
    let sectionStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      const trimmed = line.trim();
      const header = trimmed.match(/^#{2,3}\s+(.+)$/);

      if (header) {
        if (currentSection.length > 1) {
          const content = currentSection.join('\n').trim();
          if (content.length > 0) {
            entities.push({
              type: 'equipment_table',
              title: sectionTitle,
              content,
              metadata: {
                documentType: equipmentType,
                equipmentType: equipmentType,
                section: sectionTitle,
                sectionType: 'equipment_section',
              },
              startLine: sectionStart,
              endLine: i - 1,
            });
          }
        }

        sectionTitle = header[1]!.trim();
        currentSection = [line];
        sectionStart = i;
      } else {
        currentSection.push(line);
      }
    }

    if (currentSection.length > 1) {
      const content = currentSection.join('\n').trim();
      if (content.length > 0) {
        entities.push({
          type: 'equipment_table',
          title: sectionTitle,
          content,
          metadata: {
            documentType: equipmentType,
            equipmentType: equipmentType,
            section: sectionTitle,
            sectionType: 'equipment_section',
          },
          startLine: sectionStart,
          endLine: lines.length - 1,
        });
      }
    }

    return entities;
  }

  private extractGenericSections(lines: string[], filePath: string): EntityBlock[] {
    const entities: EntityBlock[] = [];
    let currentSection: string[] = [];
    let sectionTitle = '';
    let sectionStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      const trimmed = line.trim();
      const header = trimmed.match(/^#{1,3}\s+(.+)$/);

      if (header) {
        if (currentSection.length > 2) {
          const content = currentSection.join('\n').trim();
          if (content.length > 0) {
            entities.push({
              type: 'section',
              title: sectionTitle,
              content,
              metadata: {
                section: sectionTitle,
                sectionType: 'generic',
              },
              startLine: sectionStart,
              endLine: i - 1,
            });
          }
        }

        sectionTitle = header[1]!.trim();
        currentSection = [line];
        sectionStart = i;
      } else {
        currentSection.push(line);
      }
    }

    if (currentSection.length > 2) {
      const content = currentSection.join('\n').trim();
      if (content.length > 0) {
        entities.push({
          type: 'section',
          title: sectionTitle,
          content,
          metadata: {
            section: sectionTitle,
            sectionType: 'generic',
          },
          startLine: sectionStart,
          endLine: lines.length - 1,
        });
      }
    }

    return entities;
  }

  /**
   * OPTIMIZED: Smart splitting with table awareness
   */
  private splitLargeEntity(entity: EntityBlock): Document[] {
    const chunks: Document[] = [];
    const content = entity.content;
    
    // Check if content contains markdown tables
    if (content.includes('|') && content.match(/\|.*\|.*\|/)) {
      return this.splitTableContent(entity);
    }
    
    // Otherwise split by paragraphs/sentences
    return this.splitTextContent(entity);
  }

  /**
   * Split markdown tables by rows (not paragraphs!)
   */
  private splitTableContent(entity: EntityBlock): Document[] {
    const chunks: Document[] = [];
    const lines = entity.content.split('\n');
    
    let header: string[] = [];
    let currentChunk: string[] = [];
    let partNum = 1;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Table header row (contains | but not just dashes)
      if (trimmed.includes('|') && !trimmed.match(/^[\|\s\-:]+$/)) {
        // If no header yet, this is the header
        if (header.length === 0) {
          header.push(line);
          // Also grab the separator line if next
          continue;
        }
        
        // Add row to current chunk
        currentChunk.push(line);
        
        // Check if chunk is getting too big
        const chunkSize = (header.join('\n') + '\n' + currentChunk.join('\n')).length;
        if (chunkSize > this.maxChunkSize) {
          // Save current chunk (without this last row)
          currentChunk.pop();
          if (currentChunk.length > 0) {
            chunks.push(new Document({
              pageContent: (header.join('\n') + '\n' + currentChunk.join('\n')).trim(),
              metadata: {
                ...entity.metadata,
                section: `${entity.title} (Part ${partNum})`,
                partialEntity: true,
              },
            }));
            partNum++;
          }
          // Start new chunk with this row
          currentChunk = [line];
        }
      } else if (trimmed.match(/^[\|\s\-:]+$/)) {
        // Separator line (|---|---|)
        if (header.length > 0) {
          header.push(line);
        }
      } else if (trimmed.length > 0) {
        // Non-table content
        currentChunk.push(line);
      }
    }
    
    // Save final chunk
    if (currentChunk.length > 0) {
      const finalContent = header.length > 0 
        ? (header.join('\n') + '\n' + currentChunk.join('\n')).trim()
        : currentChunk.join('\n').trim();
      
      chunks.push(new Document({
        pageContent: finalContent,
        metadata: {
          ...entity.metadata,
          section: `${entity.title}${chunks.length > 0 ? ` (Part ${partNum})` : ''}`,
          partialEntity: chunks.length > 0,
        },
      }));
    }
    
    return chunks.length > 0 ? chunks : [this.splitTextContent(entity)[0]!];
  }

  /**
   * Split regular text content by paragraphs
   */
  private splitTextContent(entity: EntityBlock): Document[] {
    const chunks: Document[] = [];
    const paragraphs = entity.content.split(/\n\n+/);
    let currentChunk = '';
    let partNum = 1;

    for (const para of paragraphs) {
      if ((currentChunk + '\n\n' + para).length > this.maxChunkSize && currentChunk.length > 0) {
        chunks.push(new Document({
          pageContent: currentChunk.trim(),
          metadata: {
            ...entity.metadata,
            section: `${entity.title} (Part ${partNum})`,
            partialEntity: true,
          },
        }));
        partNum++;
        currentChunk = para;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(new Document({
        pageContent: currentChunk.trim(),
        metadata: {
          ...entity.metadata,
          section: `${entity.title}${chunks.length > 0 ? ` (Part ${partNum})` : ''}`,
          partialEntity: chunks.length > 0,
        },
      }));
    }

    return chunks;
  }

  private extractClassName(filePath: string): string {
    const filename = basename(filePath, '.md');
    return filename
      .replace(/-class$/, '')
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private extractDomainName(filePath: string): string {
    const filename = basename(filePath, '.md');
    return filename
      .replace(/-domain-cards$/, '')
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  getChunkStats(documents: Document[]): ChunkStats {
    const sizes = documents.map(doc => doc.pageContent.length);
    const byType: Record<string, number> = {};
    const bySection = new Set<string>();

    for (const doc of documents) {
      const type = doc.metadata.documentType || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
      if (doc.metadata.section) {
        bySection.add(doc.metadata.section);
      }
    }

    return {
      totalChunks: documents.length,
      avgChunkSize: Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length),
      minChunkSize: Math.min(...sizes),
      maxChunkSize: Math.max(...sizes),
      byType,
      uniqueSections: bySection.size,
    };
  }
}