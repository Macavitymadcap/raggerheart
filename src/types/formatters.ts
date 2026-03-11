import { EnhancedMetadata } from "./query";

export interface EntityBlock {
  type: 'stat_block' | 'class_feature' | 'domain_card' | 'equipment_table' | 'section';
  title: string;
  content: string;
  metadata: Partial<EnhancedMetadata>;
  startLine: number;
  endLine: number;
}


export interface YAMLFrontmatter {
  type?: string;
  tier?: number;
  category?: string;
  name?: string;
  difficulty?: string;
  domain?: string;
  level?: number;
  card_type?: string;
  tags?: string[];
  related_adversaries?: string[];
  related_domains?: string[];
  // ... etc
}