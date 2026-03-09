// src/ui/enhanced-formatters.tsx
import type { QueryIntent } from '../types/query';

export interface FormatOptions {
  intent: QueryIntent;
  rawText: string;
  isStreaming?: boolean;
}

/**
 * Format response based on query intent and content type
 */
export function formatResponse(options: FormatOptions): string {
  const { intent, rawText } = options;
  
  switch (intent) {
    case 'show_adversary_statblock':
      return formatAdversaryStatBlock(rawText);
    
    case 'show_environment_statblock':
      return formatEnvironmentStatBlock(rawText);
    
    case 'show_equipment_table':
      return formatEquipmentTable(rawText);
    
    case 'show_class_features':
      return formatClassGuide(rawText);
    
    case 'show_domain_cards':
      return formatDomainCards(rawText);
    
    case 'compare_items':
      return formatComparison(rawText);
    
    default:
      return formatGeneral(rawText);
  }
}

/**
 * Format adversary stat block with proper styling
 */
function formatAdversaryStatBlock(text: string): string {
  if (text.trim().startsWith('NOT FOUND:')) {
    return `<div class="not-found">
      <p>⚠️ ${text.trim()}</p>
      <p class="hint">Try checking the spelling or searching for a different adversary.</p>
    </div>`;
  }
  
  const lines = text.split('\n');
  let html = '<div class="stat-block adversary">\n';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() || '';
    
    if (!line) {
      html += '<div class="spacer"></div>\n';
      continue;
    }
    
    // Name line (all caps)
    if (line === line.toUpperCase() && i < 3 && !line.includes('FEATURES')) {
      html += `<h2 class="stat-name">${line}</h2>\n`;
      continue;
    }
    
    // Tier/Role line
    if (line.match(/^Tier\s+\d+/i)) {
      html += `<p class="tier-role">${line}</p>\n`;
      continue;
    }
    
    // Section headers
    if (line.match(/^(Motives?\s+&\s+Tactics?|FEATURES)$/i)) {
      html += `<h3 class="section-header">${line}</h3>\n`;
      continue;
    }
    
    // Stats line
    if (line.match(/Difficulty:|Thresholds:|HP:|Stress:/)) {
      html += `<p class="stats-line">${line}</p>\n`;
      continue;
    }
    
    // Attack line
    if (line.match(/^⚔\s+ATK/)) {
      html += `<p class="attack-line">${line}</p>\n`;
      continue;
    }
    
    // XP line
    if (line.match(/^XP:/i)) {
      html += `<p class="xp-line">${line}</p>\n`;
      continue;
    }
    
    // Features (bullet points)
    if (line.match(/^[
-\-*]\s+/)) {
      const featureText = line.replace(/^[
-\-*]\s+/, '');
      const [name, ...rest] = featureText.split(':');
      
      if (rest.length > 0) {
        html += `<div class="feature">
          <strong class="feature-name">${name}:</strong>
          <span class="feature-desc">${rest.join(':').trim()}</span>
        </div>\n`;
      } else {
        html += `<div class="feature">${featureText}</div>\n`;
      }
      continue;
    }
    
    // Regular text
    html += `<p>${line}</p>\n`;
  }
  
  html += '</div>';
  return html;
}

/**
 * Format environment stat block
 */
function formatEnvironmentStatBlock(text: string): string {
  if (text.trim().startsWith('NOT FOUND:')) {
    return `<div class="not-found">
      <p>⚠️ ${text.trim()}</p>
      <p class="hint">Try checking the spelling or searching for a different environment.</p>
    </div>`;
  }
  
  // Similar to adversary but with different styling
  const lines = text.split('\n');
  let html = '<div class="stat-block environment">\n';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!trimmed) {
      html += '<div class="spacer"></div>\n';
      continue;
    }
    
    if (trimmed === trimmed.toUpperCase() && !trimmed.includes('FEATURES')) {
      html += `<h2 class="stat-name">${trimmed}</h2>\n`;
    } else if (trimmed.match(/^Tier\s+\d+/i)) {
      html += `<p class="tier">${trimmed}</p>\n`;
    } else if (trimmed === 'FEATURES') {
      html += `<h3 class="section-header">${trimmed}</h3>\n`;
    } else if (trimmed.match(/^[
-\-*]\s+/)) {
      const featureText = trimmed.replace(/^[
-\-*]\s+/, '');
      html += `<div class="feature">
- ${featureText}</div>\n`;
    } else {
      html += `<p>${trimmed}</p>\n`;
    }
  }
  
  html += '</div>';
  return html;
}

/**
 * Format equipment as an HTML table
 */
function formatEquipmentTable(text: string): string {
  if (text.trim().startsWith('NOT FOUND:')) {
    return `<div class="not-found">
      <p>⚠️ ${text.trim()}</p>
      <p class="hint">Try checking the spelling or browsing the equipment list.</p>
    </div>`;
  }
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const rows: string[][] = [];
  
  for (const line of lines) {
    if (!line.includes('|')) continue;
    
    const cells = line.split('|').map(c => c.trim());
    if (cells.length >= 4) {
      rows.push(cells);
    }
  }
  
  if (rows.length === 0) {
    return `<div class="equipment-list"><p>${text}</p></div>`;
  }
  
  // Detect table type by column count
  const isWeaponTable = rows[0]?.length === 6;
  const isArmorTable = rows[0]?.length === 4;
  
  let html = '<div class="equipment-table-container">\n<table class="equipment-table">\n<thead>\n<tr>\n';
  
  if (isWeaponTable) {
    html += '<th>Name</th><th>Trait</th><th>Range</th><th>Damage</th><th>Burden</th><th>Feature</th>\n';
  } else if (isArmorTable) {
    html += '<th>Name</th><th>Armor Score</th><th>Slots</th><th>Feature</th>\n';
  } else {
    // Generic table
    for (let i = 0; i < (rows[0]?.length || 0); i++) {
      html += `<th>Column ${i + 1}</th>`;
    }
  }
  
  html += '</tr>\n</thead>\n<tbody>\n';
  
  for (const row of rows) {
    html += '<tr>\n';
    for (let i = 0; i < row.length; i++) {
      const cell = row[i] || '—';
      const className = i === 0 ? 'item-name' : '';
      html += `<td class="${className}">${cell}</td>`;
    }
    html += '</tr>\n';
  }
  
  html += '</tbody>\n</table>\n</div>';
  return html;
}

/**
 * Format class guide with proper sections
 */
function formatClassGuide(text: string): string {
  const lines = text.split('\n');
  let html = '<div class="class-guide">\n';
  let inSection = false;
  let currentSection = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!trimmed) continue;
    
    // Main header
    if (trimmed.startsWith('CLASS:')) {
      html += `<h1 class="class-title">${trimmed.replace('CLASS:', '').trim()}</h1>\n`;
      html += '<hr class="divider" />\n';
      continue;
    }
    
    // Section headers
    if (trimmed.match(/^(DESCRIPTION|CORE STATS|FOUNDATION FEATURES|SPECIALIZATION FEATURES|MASTERY FEATURES)$/)) {
      if (inSection) {
        html += '</div>\n';
      }
      currentSection = trimmed.toLowerCase().replace(/\s+/g, '-');
      html += `<section class="class-section ${currentSection}">\n`;
      html += `<h2 class="section-title">${trimmed}</h2>\n`;
      inSection = true;
      continue;
    }
    
    // Dividers
    if (trimmed.match(/^═+$/)) {
      html += '<hr class="divider" />\n';
      continue;
    }
    
    // Features (bullet points)
    if (trimmed.match(/^[
-\-*]\s+/)) {
      const featureText = trimmed.replace(/^[
-\-*]\s+/, '');
      const [name, ...rest] = featureText.split(':');
      
      if (rest.length > 0 && name) {
        const [type, ...desc] = rest.join(':').split('-');
        html += `<div class="feature">
          <h4 class="feature-name">${name.trim()}</h4>
          ${type ? `<span class="feature-type">${type.trim()}</span>` : ''}
          ${desc.length > 0 ? `<p class="feature-desc">${desc.join('-').trim()}</p>` : ''}
        </div>\n`;
      } else {
        html += `<p class="feature-item">
- ${featureText}</p>\n`;
      }
      continue;
    }
    
    // Regular paragraphs
    html += `<p>${trimmed}</p>\n`;
  }
  
  if (inSection) {
    html += '</section>\n';
  }
  
  html += '</div>';
  return html;
}

/**
 * Format domain cards
 */
function formatDomainCards(text: string): string {
  const cards = text.split('┌─────').filter(c => c.trim());
  
  let html = '<div class="domain-cards-container">\n';
  
  for (const card of cards) {
    const lines = card.split('\n').map(l => l.trim()).filter(l => l && !l.match(/^[┌└─│]+$/));
    
    if (lines.length === 0) continue;
    
    html += '<div class="domain-card">\n';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      
      // Card name (first line)
      if (i === 0) {
        html += `<h3 class="card-name">${line}</h3>\n`;
        continue;
      }
      
      // Domain/level line (contains 
-)
      if (line.includes('
-')) {
        html += `<p class="card-meta">${line}</p>\n`;
        continue;
      }
      
      // Card text
      html += `<p class="card-text">${line}</p>\n`;
    }
    
    html += '</div>\n';
  }
  
  html += '</div>';
  return html;
}

/**
 * Format comparison
 */
function formatComparison(text: string): string {
  return `<div class="comparison-container">\n${text.replace(/\n/g, '<br>\n')}\n</div>`;
}

/**
 * Format general response
 */
function formatGeneral(text: string): string {
  const lines = text.split('\n').filter(l => l.trim());
  let html = '<div class="general-response">\n';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Bullet points
    if (trimmed.match(/^[
-\-*]\s+/)) {
      html += `<li>${trimmed.replace(/^[
-\-*]\s+/, '')}</li>\n`;
    } else {
      html += `<p>${trimmed}</p>\n`;
    }
  }
  
  html += '</div>';
  return html;
}