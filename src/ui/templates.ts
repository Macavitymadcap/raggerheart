// HTML template builders for different response types

export function userMessage(question: string): string {
  return `
    <article class="message user">
      <span class="message-header">You</span>
      <div class="message-content">
        <p>${escapeHtml(question)}</p>
      </div>
    </article>
  `;
}

export function assistantMessage(content: string, sourcesHTML: string = ''): string {
  return `
    <article class="message assistant">
      <span class="message-header">Assistant</span>
      <div class="message-content">
        ${content}
      </div>
      ${sourcesHTML}
    </article>
  `;
}

export function errorMessage(error: string): string {
  return `
    <article class="message assistant">
      <div class="message-content">
        <p>❌ ${escapeHtml(error)}</p>
      </div>
    </article>
  `;
}

export function sourcesSection(docs: Array<{metadata: any}>, scores: number[]): string {
  if (docs.length === 0) return '';
  
  return `
    <section class="sources">
      <details>
        <summary>📚 Sources</summary>
        <ol>
          ${docs.map((doc, i) => {
            const source = doc.metadata?.source || 'Unknown';
            const page = doc.metadata?.loc?.pageNumber || '?';
            const score = scores[i] || 0;
            return sourceListItem(i + 1, source, page, score);
          }).join('')}
        </ol>
      </details>
    </section>
  `;
}

function sourceListItem(number: number, source: string, page: string | number, score: number): string {
  return `
    <li data-number="${number}">
      <div class="source-details">
        <div class="source-name">${escapeHtml(source)}</div>
        <div class="source-meta">Page ${page} • ${(score * 100).toFixed(1)}% relevant</div>
      </div>
    </li>
  `;
}

export function weaponTable(weapons: Array<{
  name: string;
  trait: string;
  range: string;
  damage: string;
  burden: string;
  feature: string;
}>): string {
  if (weapons.length === 0) return '';
  
  return `
    <table class="weapon-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Trait</th>
          <th>Range</th>
          <th>Damage</th>
          <th>Burden</th>
          <th>Feature</th>
        </tr>
      </thead>
      <tbody>
        ${weapons.map(w => `
          <tr>
            <td><strong>${escapeHtml(w.name)}</strong></td>
            <td>${escapeHtml(w.trait)}</td>
            <td>${escapeHtml(w.range)}</td>
            <td>${escapeHtml(w.damage)}</td>
            <td>${escapeHtml(w.burden)}</td>
            <td>${escapeHtml(w.feature)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

export function statBlock(content: string): string {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);
  
  let title = '';
  let tier = '';
  let description = '';
  let html = '<div class="stat-block">';
  
  // Parse stat block structure
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) break;
    
    // Title (usually all caps at start)
    if (i === 0 && line === line.toUpperCase()) {
      title = line;
      continue;
    }
    
    // Tier line (e.g., "Tier 1 Support")
    if (line.match(/^Tier\s+\d+/i)) {
      tier = line;
      continue;
    }
    
    // Description (italic text after tier)
    if (i <= 3 && !line.includes(':') && !line.match(/^(Difficulty|Motives|ATK|Experience|FEATURES)/i)) {
      description = line;
      continue;
    }
    
    // Section headers
    if (line === 'FEATURES') {
      html += `<div class="stat-section-header">${line}</div>`;
      continue;
    }
    
    // Key-value pairs (e.g., "Difficulty: 13 | Thresholds: 5/9 | HP: 4 | Stress: 4")
    if (line.includes(':')) {
      const parts = line.split('|').map(p => p.trim());
      html += '<div class="stat-row">';
      parts.forEach(part => {
        const [key, value] = part.split(':').map(s => s.trim());
        html += `<div class="stat-item"><span class="stat-label">${key}:</span> <span class="stat-value">${value}</span></div>`;
      });
      html += '</div>';
      continue;
    }
    
    // Feature entries (bold start)
    if (line.match(/^[\w\s]+ - (Action|Reaction|Passive):/)) {
      const [name, rest] = line.split(/:\s*/, 2);
      html += `<div class="feature"><strong>${name}:</strong> ${rest}</div>`;
      continue;
    }
    
    // Regular text
    html += `<div class="stat-text">${line}</div>`;
  }
  
  html += '</div>';
  
  // Build final HTML with title, tier, description at top
  return `
    <div class="stat-block">
      ${title ? `<div class="stat-title">${title}</div>` : ''}
      ${tier ? `<div class="stat-tier">${tier}</div>` : ''}
      ${description ? `<div class="stat-description">${description}</div>` : ''}
      ${html.replace('<div class="stat-block">', '').replace('</div>', '')}
    </div>
  `;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]!);
}