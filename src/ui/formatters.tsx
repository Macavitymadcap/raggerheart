import { WeaponTable, StatBlock } from './components';

export function formatAnswer(text: string, isWeaponQuery: boolean): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  const hasPipes = lines.some(l => l.includes('|'));
  
  if (hasPipes && isWeaponQuery) {
    return formatEquipmentData(lines);
  }
  
  const isStatBlock = lines.some(l => 
    l.match(/^(Tier\s+\d+|Difficulty:|FEATURES|Motives\s+&\s+Tactics)/i)
  );
  
  if (isStatBlock) {
    return <StatBlock content={lines.join('\n')} /> as any;
  }
  
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
  
  return <WeaponTable weapons={weapons} /> as any;
}

function formatParagraphs(lines: string[]): string {
  const elements: any[] = [];
  let currentList: string[] = [];
  
  for (const line of lines) {
    if (line.match(/^[-*
-]\s/)) {
      currentList.push(line.replace(/^[-*
-]\s/, ''));
    } else {
      if (currentList.length > 0) {
        elements.push(
          <ul>
            {currentList.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        );
        currentList = [];
      }
      elements.push(<p>{line}</p>);
    }
  }
  
  if (currentList.length > 0) {
    elements.push(
      <ul>
        {currentList.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    );
  }
  
  return elements.length > 0 
    ? elements.join('')
    : `<p>${lines.join(' ')}</p>`;
}