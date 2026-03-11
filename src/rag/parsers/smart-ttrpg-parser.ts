// src/rag/parsers/smart-ttrpg-parser.ts
// UPDATED FOR YAML FRONTMATTER SUPPORT
import { Document } from '@langchain/core/documents';
import { readFileSync, readdirSync, statSync } from 'fs';
import { basename, join } from 'path';
import type { ChunkStats, DocumentParser } from './parser.interface';
import type { ContentType, EnhancedMetadata } from '../../types/query';

interface YAMLFrontmatter {
  // Common fields
  type?: string;
  category?: string;
  title?: string;
  tags?: string[];
  
  // Adversary-specific
  tier?: number;
  name?: string;
  difficulty?: string;
  hp?: number;
  stress?: number;
  thresholds?: string;
  attack_modifier?: string;
  features?: string[];
  tactics?: string;
  related_adversaries?: string[];
  
  // Domain card-specific
  domain?: string;
  level?: number;
  card_type?: string;
  recall_cost?: string;
  related_domains?: string[];
  
  // Equipment-specific
  equipment_type?: string;
  weapon_trait?: string;
  damage?: string;
  burden?: string;
  
  // General metadata
  sections?: string[];
  complexity?: string;
  prerequisites?: string[];
  related_topics?: string[];
  player_facing?: boolean;
  gm_facing?: boolean;
  
  // Allow any additional fields
  [key: string]: any;
}

interface EntityBlock {
  type: 'stat_block' | 'class_feature' | 'domain_card' | 'equipment_table' | 'section';
  title: string;
  content: string;
  metadata: Partial<EnhancedMetadata>;
  startLine: number;
  endLine: number;
}

/**
 * Smart TTRPG Parser with YAML Frontmatter Support
 * 
 * NEW FEATURES:
 * - Parses YAML frontmatter from markdown files
 * - Extracts rich metadata (tags, relationships, etc.)
 * - Supports one-file-per-entity structure
 * - Enhanced metadata for better retrieval
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
    
    // Parse YAML frontmatter FIRST
    const { frontmatter, content: markdownContent } = this.parseYAMLFrontmatter(content);
    
    const documentType = this.detectDocumentType(filename, frontmatter);
    const lines = markdownContent.split('\n');
    const entities = this.extractEntities(lines, documentType, filePath, frontmatter);
    
    console.log(`  🎯 Found ${entities.length} entities`);
    
    const documents: Document[] = [];
    
    for (const entity of entities) {
      if (entity.content.length > this.maxChunkSize) {
        console.log(`  ✂️  Splitting: ${entity.title} (${entity.content.length} chars)`);
        const subChunks = this.splitLargeEntity(entity, frontmatter);
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
              ...frontmatter, // Include all frontmatter
              ...entity.metadata, // Entity-specific metadata overrides frontmatter
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

  // ============================================================================
  // YAML FRONTMATTER PARSING
  // ============================================================================

  private parseYAMLFrontmatter(content: string): { 
    frontmatter: YAMLFrontmatter; 
    content: string 
  } {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    if (!frontmatterMatch) {
      return { frontmatter: {}, content };
    }
    
    const yamlContent = frontmatterMatch[1]!;
    const markdownContent = frontmatterMatch[2]!;
    
    const frontmatter: YAMLFrontmatter = {};
    const lines = yamlContent.split('\n');
    
    let currentKey: string | null = null;
    let currentArray: string[] = [];
    let inArray = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // Check if this is an array item
      if (trimmed.startsWith('-') && inArray && currentKey) {
        const item = trimmed.substring(1).trim();
        currentArray.push(item);
        continue;
      }
      
      // If we were in an array, save it
      if (inArray && currentKey) {
        frontmatter[currentKey] = currentArray;
        currentArray = [];
        inArray = false;
        currentKey = null;
      }
      
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = trimmed.substring(0, colonIndex).trim();
      let value: string | string[] | boolean | number = trimmed.substring(colonIndex + 1).trim();
      
      // Empty value might indicate an array follows
      if (!value) {
        currentKey = key;
        inArray = true;
        continue;
      }
      
      // Handle quoted strings
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      // Handle inline arrays [item1, item2, item3]
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value
          .slice(1, -1)
          .split(',')
          .map(v => v.trim().replace(/['"]/g, ''));
      }
      
      // Handle boolean values
      if (value === 'true') value = true;
      if (value === 'false') value = false;
      
      // Handle numbers
      if (!isNaN(Number(value)) && value !== '' && typeof value === 'string') {
        value = Number(value);
      }
      
      frontmatter[key] = value;
    }
    
    // Save final array if we ended in one
    if (inArray && currentKey && currentArray.length > 0) {
      frontmatter[currentKey] = currentArray;
    }
    
    return { frontmatter, content: markdownContent };
  }

  // ============================================================================
  // DOCUMENT TYPE DETECTION
  // ============================================================================

  private detectDocumentType(filename: string, frontmatter: YAMLFrontmatter): ContentType {
    // Check frontmatter first
    if (frontmatter.type) {
      const typeMap: Record<string, ContentType> = {
        'adversary': 'adversary',
        'environment': 'environment',
        'class': 'class',
        'domain_card': 'domain_card',
        'equipment': 'equipment',
        'weapon': 'weapon',
        'armor': 'armor',
        'consumable': 'consumable',
        'loot': 'loot',
        'ancestry': 'ancestry',
        'community': 'community',
        'general': 'general',
      };
      
      const mappedType = typeMap[frontmatter.type.toLowerCase()];
      if (mappedType) return mappedType;
    }
    
    // Fallback to filename detection
    const lower = filename.toLowerCase();
    
    if (lower.includes('adversaries') || lower.includes('adversary')) return 'adversary';
    if (lower.includes('environments') || lower.includes('environment')) return 'environment';
    if (lower.includes('-class.md') || lower.includes('bard')) return 'class';
    if (lower.includes('domain-cards.md') || lower.includes('blade-domain')) return 'domain_card';
    if (lower.includes('weapons.md')) return 'equipment';
    if (lower.includes('armor.md')) return 'equipment';
    if (lower.includes('consumables.md')) return 'consumable';
    if (lower.includes('ancestries.md')) return 'ancestry';
    if (lower.includes('guidance') || lower.includes('running') || lower.includes('using')) {
      return 'general';
    }
    
    return 'general';
  }

  // ============================================================================
  // ENTITY EXTRACTION DISPATCHER
  // ============================================================================

  private extractEntities(
    lines: string[],
    documentType: ContentType,
    filePath: string,
    frontmatter: YAMLFrontmatter
  ): EntityBlock[] {
    switch (documentType) {
      case 'adversary':
      case 'environment':
        return this.extractStatBlocks(lines, documentType, filePath, frontmatter);
      case 'class':
        return this.extractClassContent(lines, filePath, frontmatter);
      case 'domain_card':
        return this.extractDomainCards(lines, filePath, frontmatter);
      case 'equipment':
      case 'consumable':
        return this.extractEquipmentSections(lines, filePath, documentType, frontmatter);
      case 'ancestry':
        return this.extractAncestries(lines, filePath, frontmatter);
      default:
        return this.extractGenericSections(lines, filePath, frontmatter);
    }
  }

  // ============================================================================
  // STAT BLOCKS (Adversaries & Environments)
  // ============================================================================

  private extractStatBlocks(
    lines: string[],
    type: 'adversary' | 'environment',
    filePath: string,
    frontmatter: YAMLFrontmatter
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
                entityName: frontmatter.name || blockTitle,
                tier: tier || frontmatter.tier,
                difficulty: frontmatter.difficulty,
                category: frontmatter.category,
                tags: frontmatter.tags,
                related_adversaries: frontmatter.related_adversaries,
                tactics: frontmatter.tactics,
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
            entityName: frontmatter.name || blockTitle,
            tier: tier || frontmatter.tier,
            difficulty: frontmatter.difficulty,
            category: frontmatter.category,
            tags: frontmatter.tags,
            related_adversaries: frontmatter.related_adversaries,
            tactics: frontmatter.tactics,
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

  private extractClassContent(
    lines: string[], 
    filePath: string,
    frontmatter: YAMLFrontmatter
  ): EntityBlock[] {
    const entities: EntityBlock[] = [];
    const className = frontmatter.name || 
                     frontmatter.title ||
                     basename(filePath).replace('-class.md', '').toUpperCase();
    
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
              section: sectionTitle,
              tags: frontmatter.tags,
              related_topics: frontmatter.related_topics,
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
            section: sectionTitle,
            tags: frontmatter.tags,
            related_topics: frontmatter.related_topics,
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

  private extractDomainCards(
    lines: string[], 
    filePath: string,
    frontmatter: YAMLFrontmatter
  ): EntityBlock[] {
    const entities: EntityBlock[] = [];
    const domainName = frontmatter.domain ||
                      frontmatter.name ||
                      basename(filePath).replace('-domain-cards.md', '').toUpperCase();
    
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
                level: level || frontmatter.level,
                card_type: frontmatter.card_type,
                recall_cost: frontmatter.recall_cost,
                tags: frontmatter.tags,
                related_domains: frontmatter.related_domains,
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
            level: level || frontmatter.level,
            card_type: frontmatter.card_type,
            recall_cost: frontmatter.recall_cost,
            tags: frontmatter.tags,
            related_domains: frontmatter.related_domains,
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
    type: ContentType,
    frontmatter: YAMLFrontmatter
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
              tier: tier || frontmatter.tier,
              equipment_type: frontmatter.equipment_type,
              tags: frontmatter.tags,
              category: frontmatter.category,
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
            tier: tier || frontmatter.tier,
            equipment_type: frontmatter.equipment_type,
            tags: frontmatter.tags,
            category: frontmatter.category,
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

  private extractAncestries(
    lines: string[], 
    filePath: string,
    frontmatter: YAMLFrontmatter
  ): EntityBlock[] {
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
              tags: frontmatter.tags,
              related_topics: frontmatter.related_topics,
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
            tags: frontmatter.tags,
            related_topics: frontmatter.related_topics,
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

  private extractGenericSections(
    lines: string[], 
    filePath: string,
    frontmatter: YAMLFrontmatter
  ): EntityBlock[] {
    const entities: EntityBlock[] = [];
    let currentSection: string[] = [];
    let sectionTitle = frontmatter.title || 
                      basename(filePath).replace('.md', '');
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
              tags: frontmatter.tags,
              complexity: frontmatter.complexity,
              prerequisites: frontmatter.prerequisites,
              related_topics: frontmatter.related_topics,
              player_facing: frontmatter.player_facing,
              gm_facing: frontmatter.gm_facing,
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
            tags: frontmatter.tags,
            complexity: frontmatter.complexity,
            prerequisites: frontmatter.prerequisites,
            related_topics: frontmatter.related_topics,
            player_facing: frontmatter.player_facing,
            gm_facing: frontmatter.gm_facing,
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

  private splitLargeEntity(
    entity: EntityBlock,
    frontmatter: YAMLFrontmatter
  ): Document[] {
    const documents: Document[] = [];
    const lines = entity.content.split('\n');
    
    // Try to split by tables first
    if (entity.content.includes('|')) {
      return this.splitByTable(entity, frontmatter);
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
              ...frontmatter,
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
            ...frontmatter,
            ...entity.metadata,
            section: entity.title,
            chunkIndex: documents.length,
          },
        })
      );
    }
    
    return documents;
  }

  private splitByTable(
    entity: EntityBlock,
    frontmatter: YAMLFrontmatter
  ): Document[] {
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
                ...frontmatter,
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
            ...frontmatter,
            ...entity.metadata,
            section: entity.title,
            chunkIndex: documents.length,
          },
        })
      );
    }
    
    return documents;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

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

  getChunkStats(documents: Document[]): ChunkStats {
    const sizes = documents.map(doc => doc.pageContent.length);
    const withMetadata = documents.filter(doc => 
      doc.metadata.documentType || doc.metadata.entityName
    ).length;
    
    const byType: Record<string, number> = {};
    const byTier: Record<string, number> = {};
    const byTags: Record<string, number> = {};
    
    for (const doc of documents) {
      // Count by document type
      const docType = doc.metadata.documentType || 'unknown';
      byType[docType] = (byType[docType] || 0) + 1;
      
      // Count by tier (for adversaries/equipment)
      if (doc.metadata.tier) {
        const tierKey = `Tier ${doc.metadata.tier}`;
        byTier[tierKey] = (byTier[tierKey] || 0) + 1;
      }
      
      // Count by tags
      if (doc.metadata.tags && Array.isArray(doc.metadata.tags)) {
        for (const tag of doc.metadata.tags) {
          byTags[tag] = (byTags[tag] || 0) + 1;
        }
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
      byTags,
      withMetadata,
      uniqueSections,
      uniqueSources,
    };
  }
}