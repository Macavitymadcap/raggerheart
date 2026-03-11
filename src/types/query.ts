// src/types/query.ts
// UPDATED WITH EXTENDED METADATA FIELDS
export type ContentType = 
  | 'adversary'
  | 'environment' 
  | 'community'
  | 'class'
  | 'domain_card'
  | 'equipment'
  | 'weapon'
  | 'armor'
  | 'loot'
  | 'consumable'
  | 'ancestry'
  | 'general';

export type QueryIntent = 
  | 'show_adversary_statblock'
  | 'show_environment_statblock'
  | 'show_equipment_table'
  | 'show_class_features'
  | 'show_domain_cards'
  | 'explain_concept'
  | 'compare_items';

export interface QueryClassification {
  contentType: ContentType;
  intent: QueryIntent;
  entities: string[]; // Extracted names to filter by
  k: number; // Number of chunks to retrieve
  requiresTable: boolean;
  filterKeys?: string[]; // Metadata keys to filter on
}

/**
 * Enhanced metadata with YAML frontmatter support
 */
export interface EnhancedMetadata {
  // Core fields
  source: string;
  filename?: string;
  section: string;
  sectionType: string;
  documentType: ContentType;
  
  // Entity identification
  entityName?: string; // "Skeleton Archer", "Jagged Knife Bandit", "Grace Domain"
  name?: string; // Alternative name field from frontmatter
  title?: string; // Document title from frontmatter
  
  // Hierarchical fields
  tier?: number; // 1-5 for adversaries, equipment
  level?: number; // 1-10 for domain cards, class features
  category?: string; // "minion", "solo", "elite", "weapon", "armor", etc.
  
  // Adversary-specific
  role?: string; // For adversaries: "Minion", "Solo", "Support", "Striker"
  difficulty?: string; // Difficulty rating
  hp?: number;
  stress?: number;
  thresholds?: string;
  attack_modifier?: string;
  features?: string[]; // List of feature names
  tactics?: string; // Motives & Tactics text
  
  // Domain card-specific
  domain?: string; // "Grace", "Blade", "Codex", etc.
  card_type?: string; // "spell", "ability", "passive"
  recall_cost?: string; // Hope cost to use
  
  // Equipment-specific
  equipmentType?: string; // "weapon", "armor", "consumable", "tool"
  equipment_type?: string; // Alternative naming
  weapon_trait?: string; // "finesse", "heavy", "thrown"
  damage?: string; // Damage dice
  burden?: string; // Burden value
  
  // Tagging and relationships
  tags?: string[]; // ["combat", "magic", "support", "ranged"]
  related_adversaries?: string[]; // Links to related entities
  related_domains?: string[]; // Links to related domains
  related_topics?: string[]; // Links to related mechanics/topics
  prerequisites?: string[]; // Required knowledge/features
  
  // Content classification
  complexity?: string; // "beginner", "intermediate", "advanced"
  player_facing?: boolean; // Content for players
  gm_facing?: boolean; // Content for GMs
  sections?: string[]; // List of subsections
  
  // Chunking metadata
  chunkIndex?: number; // For split documents
  
  // Allow any additional fields from frontmatter
  [key: string]: any;
}