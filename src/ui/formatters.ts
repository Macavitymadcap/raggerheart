import type { QueryType } from '../server';
import { weaponTable, statBlock } from './templates';

export function formatAnswer(text: string, query: QueryType): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  // Detect if response contains pipe-separated table data
  const hasPipes = lines.some(l => l.includes('|'));
  
  if (hasPipes && query === 'equipment') {
    return formatEquipmentData(lines);
  }
  
  // Check for adversary stat block format
  const isStatBlock = lines.some(l => 
    l.match(/^(Tier\s+\d+|Difficulty:|FEATURES|Motives\s+&\s+Tactics)/i)
  );
  
  if (isStatBlock) {
    return statBlock(lines.join('\n'));
  }
  
  // Default formatting - paragraphs and lists
  return formatParagraphs(lines);
}

function formatEquipmentData(lines: string[]): string {
  const weapons: Array<{
    name: string;
    trait: string;
    range: string;
    damage: string;
    burden: string;
    feature: string;
  }> = [];
  
  for (const line of lines) {
    if (!line.includes('|')) continue;
    
    const parts = line.split('|').map(p => p.trim());
    if (parts.length >= 5) {
      weapons.push({
        name: parts[0] as string,
        trait: parts[1] as string,
        range: parts[2] as string,
        damage: parts[3] as string,
        burden: parts[4] as string,
        feature: parts[5] || '—'
      });
    }
  }
  
  if (weapons.length === 0) {
    return formatParagraphs(lines);
  }
  
  return weaponTable(weapons);
}

function formatParagraphs(lines: string[]): string {
  let html = '';
  let inList = false;
  
  for (const line of lines) {
    // Detect bullet points
    if (line.match(/^[-*•]\s/)) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${line.replace(/^[-*•]\s/, '')}</li>`;
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<p>${line}</p>`;
    }
  }
  
  if (inList) {
    html += '</ul>';
  }
  
  return html || `<p>${lines.join(' ')}</p>`;
}