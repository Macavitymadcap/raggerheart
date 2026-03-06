// src/rag/query-classifier.ts
import type { QueryClassification, ContentType, QueryIntent } from '../types/query';

export class QueryClassifier {
  /**
   * Classify a user query to determine content type, intent, and retrieval parameters
   */
  static classify(query: string): QueryClassification {
    const lowerQuery = query.toLowerCase();
    
    // Extract entity names (capitalized words or quoted strings)
    const entities = this.extractEntities(query);
    
    // Determine content type
    const contentType = this.detectContentType(lowerQuery, entities);
    
    // Determine intent
    const intent = this.detectIntent(lowerQuery, contentType);
    
    // Set retrieval parameters
    const k = this.determineChunkCount(intent, contentType);
    const requiresTable = this.requiresTableFormat(intent);
    const filterKeys = this.getFilterKeys(contentType);
    
    return {
      contentType,
      intent,
      entities,
      k,
      requiresTable,
      filterKeys,
    };
  }

  private static extractEntities(query: string): string[] {
    const entities: string[] = [];
    
    // Extract quoted strings
    const quotedMatches = query.match(/"([^"]+)"|'([^']+)'/g);
    if (quotedMatches) {
      entities.push(...quotedMatches.map(m => m.replace(/['"]/g, '')));
    }
    
    // Extract capitalized sequences (proper nouns)
    const capitalizedMatches = query.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
    if (capitalizedMatches) {
      entities.push(...capitalizedMatches);
    }
    
    // Extract specific patterns
    const patterns = [
      /skeleton\s+\w+/gi,
      /jagged\s+knife\s+\w+/gi,
      /\w+\s+domain/gi,
    ];
    
    for (const pattern of patterns) {
      const matches = query.match(pattern);
      if (matches) {
        entities.push(...matches);
      }
    }
    
    return [...new Set(entities)]; // Remove duplicates
  }

  private static detectContentType(query: string, entities: string[]): ContentType {
    // Adversary patterns
    if (query.match(/\b(adversary|adversaries|enemy|enemies|monster|creature|npc|foe)\b/i) ||
        query.match(/\b(skeleton|bandit|dragon|demon|spirit|golem|elemental|beast)\b/i) ||
        query.match(/stat\s*block/i)) {
      return 'adversary';
    }
    
    // Environment patterns
    if (query.match(/\b(environment|environments|hazard|hazards|trap|traps)\b/i) ||
        query.match(/\b(temple|dungeon|forest|ruins|cavern|lair)\b/i)) {
      return 'environment';
    }
    
    // Equipment patterns
    if (query.match(/\b(weapon|weapons|armor|armour|equipment|gear|item|items)\b/i) ||
        query.match(/\b(sword|axe|bow|knife|dagger|staff|shield|plate|leather)\b/i)) {
      return 'equipment';
    }
    
    // Specific equipment sub-types
    if (query.match(/\b(consumable|consumables|potion|potions|scroll|scrolls)\b/i)) {
      return 'consumable';
    }
    
    if (query.match(/\bloot\b/i)) {
      return 'loot';
    }
    
    // Class patterns
    if (query.match(/\b(class|classes|seraph|warrior|wizard|rogue|ranger|bard|druid|guardian|sorcerer)\b/i) ||
        query.match(/\b(features|abilities|foundation|specialization|mastery)\b/i)) {
      return 'class';
    }
    
    // Domain card patterns
    if (query.match(/\b(domain\s+card|domain\s+cards|spell|spells)\b/i) ||
        query.match(/\b(grace|sage|codex|bone|midnight|valor|blade|arcana|splendor)\s+domain/i)) {
      return 'domain_card';
    }
    
    // Community patterns
    if (query.match(/\b(community|communities|faction|factions|settlement|settlements)\b/i)) {
      return 'community';
    }
    
    // Ancestry patterns
    if (query.match(/\b(ancestry|ancestries|heritage|lineage)\b/i) ||
        query.match(/\b(human|elf|dwarf|halfling|orc|goblin|dragonborn)\b/i)) {
      return 'ancestry';
    }
    
    return 'general';
  }

  private static detectIntent(query: string, contentType: ContentType): QueryIntent {
    // Stat block intents
    if (query.match(/\bstat\s*block/i) || query.match(/\bstatistics\b/i)) {
      if (contentType === 'adversary') return 'show_adversary_statblock';
      if (contentType === 'environment') return 'show_environment_statblock';
    }
    
    // Show/display patterns for adversaries
    if (contentType === 'adversary' && query.match(/\b(show|display|give|find)\b/i)) {
      return 'show_adversary_statblock';
    }
    
    // Equipment table intent
    if (contentType === 'equipment' && query.match(/\b(list|table|all|show)\b/i)) {
      return 'show_equipment_table';
    }
    
    // Class features intent
    if (contentType === 'class' && query.match(/\b(features|abilities|all)\b/i)) {
      return 'show_class_features';
    }
    
    // Domain cards intent
    if (contentType === 'domain_card') {
      return 'show_domain_cards';
    }
    
    // Comparison intent
    if (query.match(/\b(compare|versus|vs|difference|better)\b/i)) {
      return 'compare_items';
    }
    
    return 'explain_concept';
  }

  private static determineChunkCount(intent: QueryIntent, contentType: ContentType): number {
    switch (intent) {
      case 'show_adversary_statblock':
        return 12; // Need multiple chunks to get complete stat block
      
      case 'show_environment_statblock':
        return 10;
      
      case 'show_equipment_table':
        return 15; // Tables are often spread across chunks
      
      case 'show_class_features':
        return 20; // Classes have many features
      
      case 'show_domain_cards':
        return 25; // Domain cards are numerous
      
      case 'compare_items':
        return 12;
      
      default:
        return 8;
    }
  }

  private static requiresTableFormat(intent: QueryIntent): boolean {
    return intent === 'show_equipment_table';
  }

  private static getFilterKeys(contentType: ContentType): string[] {
    const filterMap: Record<ContentType, string[]> = {
      adversary: ['entityName', 'tier', 'role', 'documentType'],
      environment: ['entityName', 'tier', 'documentType'],
      equipment: ['equipmentType', 'documentType'],
      weapon: ['equipmentType', 'documentType'],
      armor: ['equipmentType', 'documentType'],
      consumable: ['equipmentType', 'documentType'],
      loot: ['documentType'],
      class: ['section', 'documentType'],
      domain_card: ['domain', 'documentType'],
      community: ['documentType'],
      ancestry: ['documentType'],
      general: ['section'],
    };
    
    return filterMap[contentType] || ['section'];
  }
}