// src/rag/parsers/smart-ttrpg-parser.ts
// UPDATED FOR NEW MARKDOWN FORMAT
import { Document } from '@langchain/core/documents';
import { readFileSync, readdirSync, statSync } from 'fs';
import { basename, join } from 'path';
import type { ChunkStats, DocumentParser } from './parser.interface';
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
 * Smart TTRPG Parser - Updated for clean markdown format
 * 
 * NEW FORMAT SUPPORT:
 * - Clean headers: # TITLE, ## TIER 1
 * - Features: ***Name - Type:*** Description
 * - No italic wrappers around tier info
 * - Standard markdown tables
 */
export class SmartTTRPGParser implements DocumentParser {
  private maxChunkSize: number;
  private chunkOverlap: number;

  constructor(maxChunkSize = 1200, chunkOverlap = 200) {
    this.maxChunkSize = maxChunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  async parseDocument(filePath: string): Promise<Document[]> {
    console.log(`  📄 Loading: ${basename(filePath)}`);
    
    const content = readFileSync(filePath, 'utf-8');
    const filename = basename(filePath);
    const documentType = this.detectDocumentType(filename);
    const entities = this.extractEntities(content, documentType, filePath);
    
    console.log(`  🎯 Found ${entities.length} entities`);
    
    const documents: Document[] = [];
    
    for (const entity of entities) {
      if (entity.content.length > this.maxChunkSize) {
        console.log(`  ✂️  Splitting: ${entity.title} (${entity.content.length} chars)`);
        const subChunks = this.splitLargeEntity(entity);
        documents.push(...subChunks);
      } else {
        documents.push(
          new Document({
            pageContent: entity.content,
            metadata: {
              source: basename(filePath),
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
        } else if (item.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
    }
    
    return files;
  }

  private detectDocumentType(filename: string): ContentType {
    const lower = filename.toLowerCase();
    
    // Adversaries and environments
    if (lower.includes('adversaries') || lower.includes('adversary')) return 'adversary';
    if (lower.includes('environments') || lower.includes('environment')) return 'environment';
    
    // Classes and content
    if (lower.includes('-class.md') || lower.includes('bard')) return 'class';
    if (lower.includes('domain-cards.md') || lower.includes('blade-domain')) return 'domain_card';
    if (lower.includes('weapons.md')) return 'equipment';
    if (lower.includes('armor.md')) return 'equipment';
    if (lower.includes('consumables.md')) return 'consumable';
    if (lower.includes('ancestries.md')) return 'ancestry';
    
    // GM guidance
    if (lower.includes('guidance') || lower.includes('running') || lower.includes('using')) {
      return 'general';
    }
    
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
      case 'equipment':
      case 'consumable':
        return this.extractEquipmentSections(lines, filePath, documentType);
      case 'ancestry':
        return this.extractAncestries(lines, filePath);
      default:
        return this.extractGenericSections(lines, filePath);
    }
  }

  // ============================================================================
  // STAT BLOCKS (Adversaries & Environments)
  // ============================================================================

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
    let inStatBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      const trimmed = line.trim();
      
      // Match ## TITLE or ### TITLE format (all caps)
      const headerMatch = trimmed.match(/^#{2,3}\s+([A-Z\s&'-]+)$/);
      
      if (headerMatch && trimmed.length > 5) {
        // Save previous block
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
                sectionType: 'stat_block',
              },
              startLine: blockStart,
              endLine: i - 1,
            });
          }
        }

        // Start new block
        blockTitle = headerMatch[1]!.trim();
        currentBlock = [line];
        blockStart = i;
        inStatBlock = true;
        tier = undefined;
        continue;
      }

      if (inStatBlock) {
        currentBlock.push(line);
        
        // Extract tier from "***Tier X Type***" format
        if (!tier) {
          const tierMatch = trimmed.match(/\*\*\*Tier\s+(\d+)/i);
          if (tierMatch) {
            tier = parseInt(tierMatch[1]!);
          }
        }
      }
    }

    // Save last block
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
            sectionType: 'stat_block',
          },
          startLine: blockStart,
          endLine: lines.length - 1,
        });
      }
    }

    return entities;
  }

  // ============================================================================
  // CLASS CONTENT
  // ============================================================================

  private extractClassContent(lines: string[], filePath: string): EntityBlock[] {
    const entities: EntityBlock[] = [];
    const className = basename(filePath).replace('-class.md', '').toUpperCase();
    
    let currentSection: string[] = [];
    let sectionTitle = className;
    let sectionStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      const trimmed = line.trim();
      
      // ## HEADER or ### HEADER
      const headerMatch = trimmed.match(/^#{2,3}\s+([A-Z\s&'-]+)$/);
      
      if (headerMatch && currentSection.length > 3) {
        const content = currentSection.join('\n').trim();
        if (content.length > 0) {
          entities.push({
            type: 'class_feature',
            title: `${className} - ${sectionTitle}`,
            content,
            metadata: {
              documentType: 'class',
              entityName: className,
              sectionType: 'class_features',
            },
            startLine: sectionStart,
            endLine: i - 1,
          });
        }

        sectionTitle = headerMatch[1]!.trim();
        currentSection = [line];
        sectionStart = i;
      } else {
        currentSection.push(line);
      }
    }

    // Save last section
    if (currentSection.length > 3) {
      const content = currentSection.join('\n').trim();
      if (content.length > 0) {
        entities.push({
          type: 'class_feature',
          title: `${className} - ${sectionTitle}`,
          content,
          metadata: {
            documentType: 'class',
            entityName: className,
            sectionType: 'class_features',
          },
          startLine: sectionStart,
          endLine: lines.length - 1,
        });
      }
    }

    return entities;
  }

  // ============================================================================
  // DOMAIN CARDS
  // ============================================================================

  private extractDomainCards(lines: string[], filePath: string): EntityBlock[] {
    const entities: EntityBlock[] = [];
    const domainName = basename(filePath).replace('-domain-cards.md', '').toUpperCase();
    
    let currentCard: string[] = [];
    let cardTitle = '';
    let cardStart = 0;
    let level: number | undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      const trimmed = line.trim();
      
      // ## CARD NAME format
      const headerMatch = trimmed.match(/^##\s+([A-Z\s&'-]+)$/);
      
      if (headerMatch) {
        // Save previous card
        if (currentCard.length > 2) {
          const content = currentCard.join('\n').trim();
          if (content.length > 0) {
            entities.push({
              type: 'domain_card',
              title: cardTitle,
              content,
              metadata: {
                documentType: 'domain_card',
                entityName: cardTitle,
                domain: domainName,
                level,
                sectionType: 'domain_card',
              },
              startLine: cardStart,
              endLine: i - 1,
            });
          }
        }

        // Start new card
        cardTitle = headerMatch[1]!.trim();
        currentCard = [line];
        cardStart = i;
        level = undefined;
        continue;
      }

      if (currentCard.length > 0) {
        currentCard.push(line);
        
        // Extract level from "**Level X Domain Ability**"
        if (!level) {
          const levelMatch = trimmed.match(/\*\*Level\s+(\d+)/i);
          if (levelMatch) {
            level = parseInt(levelMatch[1]!);
          }
        }
      }
    }

    // Save last card
    if (currentCard.length > 2) {
      const content = currentCard.join('\n').trim();
      if (content.length > 0) {
        entities.push({
          type: 'domain_card',
          title: cardTitle,
          content,
          metadata: {
            documentType: 'domain_card',
            entityName: cardTitle,
            domain: domainName,
            level,
            sectionType: 'domain_card',
          },
          startLine: cardStart,
          endLine: lines.length - 1,
        });
      }
    }

    return entities;
  }

  // ============================================================================
  // EQUIPMENT (Weapons, Armor, Consumables)
  // ============================================================================

  private extractEquipmentSections(
    lines: string[],
    filePath: string,
    type: ContentType
  ): EntityBlock[] {
    const entities: EntityBlock[] = [];
    let currentSection: string[] = [];
    let sectionTitle = '';
    let sectionStart = 0;
    let tier: number | undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      const trimmed = line.trim();
      
      // ## TIER X or ## Section Name
      const headerMatch = trimmed.match(/^##\s+(.+)$/);
      
      if (headerMatch && currentSection.length > 2) {
        const content = currentSection.join('\n').trim();
        if (content.length > 0) {
          entities.push({
            type: 'equipment_table',
            title: sectionTitle,
            content,
            metadata: {
              documentType: type,
              tier,
              sectionType: 'equipment_table',
            },
            startLine: sectionStart,
            endLine: i - 1,
          });
        }

        sectionTitle = headerMatch[1]!.trim();
        currentSection = [line];
        sectionStart = i;
        
        // Extract tier from "Tier X (Level Y-Z)" format
        const tierMatch = sectionTitle.match(/Tier\s+(\d+)/i);
        tier = tierMatch ? parseInt(tierMatch[1]!) : undefined;
      } else {
        currentSection.push(line);
      }
    }

    // Save last section
    if (currentSection.length > 2) {
      const content = currentSection.join('\n').trim();
      if (content.length > 0) {
        entities.push({
          type: 'equipment_table',
          title: sectionTitle,
          content,
          metadata: {
            documentType: type,
            tier,
            sectionType: 'equipment_table',
          },
          startLine: sectionStart,
          endLine: lines.length - 1,
        });
      }
    }

    return entities;
  }

  // ============================================================================
  // ANCESTRIES
  // ============================================================================

  private extractAncestries(lines: string[], filePath: string): EntityBlock[] {
    const entities: EntityBlock[] = [];
    let currentSection: string[] = [];
    let sectionTitle = '';
    let sectionStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      const trimmed = line.trim();
      
      // ## ANCESTRY NAME
      const headerMatch = trimmed.match(/^##\s+([A-Z\s&'-]+)$/);
      
      if (headerMatch && currentSection.length > 3) {
        const content = currentSection.join('\n').trim();
        if (content.length > 0) {
          entities.push({
            type: 'section',
            title: sectionTitle,
            content,
            metadata: {
              documentType: 'ancestry',
              entityName: sectionTitle,
              sectionType: 'ancestry',
            },
            startLine: sectionStart,
            endLine: i - 1,
          });
        }

        sectionTitle = headerMatch[1]!.trim();
        currentSection = [line];
        sectionStart = i;
      } else {
        currentSection.push(line);
      }
    }

    // Save last section
    if (currentSection.length > 3) {
      const content = currentSection.join('\n').trim();
      if (content.length > 0) {
        entities.push({
          type: 'section',
          title: sectionTitle,
          content,
          metadata: {
            documentType: 'ancestry',
            entityName: sectionTitle,
            sectionType: 'ancestry',
          },
          startLine: sectionStart,
          endLine: lines.length - 1,
        });
      }
    }

    return entities;
  }

  // ============================================================================
  // GENERIC SECTIONS (GM Guidance, etc.)
  // ============================================================================

  private extractGenericSections(lines: string[], filePath: string): EntityBlock[] {
    const entities: EntityBlock[] = [];
    let currentSection: string[] = [];
    let sectionTitle = basename(filePath).replace('.md', '');
    let sectionStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      const trimmed = line.trim();
      
      // # Title, ## Section, or ### Subsection
      const headerMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
      
      if (headerMatch && currentSection.length > 3) {
        const content = currentSection.join('\n').trim();
        if (content.length > 0) {
          entities.push({
            type: 'section',
            title: sectionTitle,
            content,
            metadata: {
              documentType: 'general',
              section: sectionTitle,
              sectionType: 'general',
            },
            startLine: sectionStart,
            endLine: i - 1,
          });
        }

        sectionTitle = headerMatch[2]!.trim();
        currentSection = [line];
        sectionStart = i;
      } else {
        currentSection.push(line);
      }
    }

    // Save last section
    if (currentSection.length > 3) {
      const content = currentSection.join('\n').trim();
      if (content.length > 0) {
        entities.push({
          type: 'section',
          title: sectionTitle,
          content,
          metadata: {
            documentType: 'general',
            section: sectionTitle,
            sectionType: 'general',
          },
          startLine: sectionStart,
          endLine: lines.length - 1,
        });
      }
    }

    return entities;
  }

  // ============================================================================
  // SPLITTING LARGE ENTITIES
  // ============================================================================

  private splitLargeEntity(entity: EntityBlock): Document[] {
    const documents: Document[] = [];
    const lines = entity.content.split('\n');
    
    // Try to split by tables first
    if (entity.content.includes('|')) {
      return this.splitByTable(entity);
    }
    
    // Otherwise split by paragraphs
    let currentChunk: string[] = [];
    let currentSize = 0;
    
    for (const line of lines) {
      const lineSize = line.length + 1;
      
      if (currentSize + lineSize > this.maxChunkSize && currentChunk.length > 0) {
        documents.push(
          new Document({
            pageContent: currentChunk.join('\n'),
            metadata: {
              ...entity.metadata,
              section: entity.title,
              chunkIndex: documents.length,
            },
          })
        );
        
        // Keep overlap
        const overlapLines = currentChunk.slice(-2);
        currentChunk = overlapLines;
        currentSize = overlapLines.join('\n').length;
      }
      
      currentChunk.push(line);
      currentSize += lineSize;
    }
    
    // Add final chunk
    if (currentChunk.length > 0) {
      documents.push(
        new Document({
          pageContent: currentChunk.join('\n'),
          metadata: {
            ...entity.metadata,
            section: entity.title,
            chunkIndex: documents.length,
          },
        })
      );
    }
    
    return documents;
  }

  private splitByTable(entity: EntityBlock): Document[] {
    const documents: Document[] = [];
    const lines = entity.content.split('\n');
    
    let header: string[] = [];
    let currentChunk: string[] = [];
    let inTable = false;
    let tableHeader: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      const isTableRow = line.includes('|');
      const isTableSeparator = line.match(/^\|[\s:-]+\|/);
      
      if (isTableRow && !inTable) {
        // Starting a table - save header
        inTable = true;
        tableHeader = [line];
        continue;
      }
      
      if (isTableSeparator) {
        tableHeader.push(line);
        continue;
      }
      
      if (isTableRow && inTable) {
        const chunkWithRow = [...currentChunk, ...tableHeader, line].join('\n');
        
        if (chunkWithRow.length > this.maxChunkSize && currentChunk.length > 0) {
          // Save current chunk
          documents.push(
            new Document({
              pageContent: [...header, ...currentChunk].join('\n'),
              metadata: {
                ...entity.metadata,
                section: entity.title,
                chunkIndex: documents.length,
              },
            })
          );
          currentChunk = [];
        }
        
        currentChunk.push(...tableHeader, line);
        tableHeader = [...tableHeader];  // Keep header for next rows
      } else {
        // Not in table
        inTable = false;
        if (i < 5) {
          header.push(line);  // Keep first few lines as context
        }
        currentChunk.push(line);
      }
    }
    
    // Save final chunk
    if (currentChunk.length > 0) {
      documents.push(
        new Document({
          pageContent: [...header, ...currentChunk].join('\n'),
          metadata: {
            ...entity.metadata,
            section: entity.title,
            chunkIndex: documents.length,
          },
        })
      );
    }
    
    return documents;
  }

  getChunkStats(documents: Document[]): ChunkStats {
    const sizes = documents.map(doc => doc.pageContent.length);
    const withMetadata = documents.filter(doc => 
      doc.metadata.documentType || doc.metadata.entityName
    ).length;
    
    const byType: Record<string, number> = {};
    const byTier: Record<string, number> = {};
    
    for (const doc of documents) {
      // Count by document type
      const docType = doc.metadata.documentType || 'unknown';
      byType[docType] = (byType[docType] || 0) + 1;
      
      // Count by tier (for adversaries/equipment)
      if (doc.metadata.tier) {
        const tierKey = `Tier ${doc.metadata.tier}`;
        byTier[tierKey] = (byTier[tierKey] || 0) + 1;
      }
    }
    
    const uniqueSections = new Set(
      documents
        .filter(doc => doc.metadata.section)
        .map(doc => doc.metadata.section)
    ).size;
    
    const uniqueSources = new Set(
      documents.map(doc => doc.metadata.source || doc.metadata.filename)
    ).size;

    return {
      totalChunks: documents.length,
      avgChunkSize: Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length),
      minChunkSize: Math.min(...sizes),
      maxChunkSize: Math.max(...sizes),
      byType,
      byTier,
      withMetadata,
      uniqueSections,
      uniqueSources,
    };
  }
}