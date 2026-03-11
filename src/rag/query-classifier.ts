// src/rag/query-classifier.ts
// UPDATED WITH TAG-AWARE FILTERING
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
        return 3;  // single file = 1 chunk, grab 3 for safety
      
      case 'show_environment_statblock':
        return 4;  // environments are similar to adversaries
      
      case 'show_equipment_table':
        return 8;  // weapons.md produced 200 chunks, but a specific query
                  // should land on the right tier section quickly
      
      case 'show_class_features':
        return 12; // seraph = 8 chunks, druid = 13, ranger = 9
                  // 12 gets most classes fully covered
      
      case 'show_domain_cards':
        return 8;  // individual domain card files = 1 chunk each,
                  // 8 gets a good spread for a single domain
      
      case 'compare_items':
        return 8;  // need chunks for both sides of comparison
      
      case 'explain_concept':
      case 'explain_mechanics':
        return 6;  // core-mechanics.md = 77 chunks, but a focused
                  // query should surface the right 4-6
      
      default:
        return 5;
    }
  }
  private static requiresTableFormat(intent: QueryIntent): boolean {
    return intent === 'show_equipment_table';
  }

  /**
   * Get metadata filter keys for enhanced retrieval
   * NOW INCLUDES TAGS for better filtering
   */
  private static getFilterKeys(contentType: ContentType): string[] {
    const filterMap: Record<ContentType, string[]> = {
      adversary: [
        'entityName', 
        'tier', 
        'role', 
        'documentType', 
        'tags',           // NEW: Tag filtering
        'category',       // NEW: Category filtering
        'difficulty'      // NEW: Difficulty filtering
      ],
      environment: [
        'entityName', 
        'tier', 
        'documentType', 
        'tags',           // NEW
        'category'        // NEW
      ],
      equipment: [
        'equipmentType', 
        'documentType', 
        'tags',           // NEW
        'tier',
        'category'        // NEW
      ],
      weapon: [
        'equipmentType', 
        'documentType', 
        'tags',           // NEW
        'weapon_trait'    // NEW
      ],
      armor: [
        'equipmentType', 
        'documentType', 
        'tags'            // NEW
      ],
      consumable: [
        'equipmentType', 
        'documentType', 
        'tags',           // NEW
        'category'        // NEW
      ],
      loot: [
        'documentType', 
        'tags',           // NEW
        'tier'
      ],
      class: [
        'section', 
        'documentType', 
        'tags',           // NEW
        'related_topics'  // NEW
      ],
      domain_card: [
        'domain', 
        'documentType', 
        'tags',           // NEW
        'level',
        'card_type',      // NEW
        'related_domains' // NEW
      ],
      community: [
        'documentType', 
        'tags',           // NEW
        'category'        // NEW
      ],
      ancestry: [
        'documentType', 
        'tags',           // NEW
        'related_topics'  // NEW
      ],
      general: [
        'section', 
        'tags',           // NEW
        'complexity',     // NEW
        'player_facing',  // NEW
        'gm_facing'       // NEW
      ],
    };
    
    return filterMap[contentType] || ['section', 'tags'];
  }
}