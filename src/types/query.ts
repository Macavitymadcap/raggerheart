// src/types/query.ts
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

export interface EnhancedMetadata {
  source: string;
  section: string;
  sectionType: string;
  documentType: ContentType;
  entityName?: string; // "Skeleton Archer", "Jagged Knife Bandit"
  tier?: number;
  level?: number;
  role?: string; // For adversaries: "Minion", "Solo", etc.
  domain?: string; // For domain cards
  equipmentType?: string; // "weapon", "armor", "consumable"
}