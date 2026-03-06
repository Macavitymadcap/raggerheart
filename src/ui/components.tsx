import type { Document } from '@langchain/core/documents';

export function UserMessage({ question }: { question: string }) {
  return (
    <article class="message user">
      <span class="message-header">You</span>
      <div class="message-content">
        <p>{question}</p>
      </div>
    </article>
  );
}

export function AssistantMessage({ 
  content, 
  sources 
}: { 
  content: string; 
  sources?: { docs: Document[]; scores: number[] } 
}) {
  return (
    <article class="message assistant">
      <span class="message-header">Assistant</span>
      <div class="message-content" dangerouslySetInnerHTML={{ __html: content }} />
      {sources && <Sources docs={sources.docs} scores={sources.scores} />}
    </article>
  );
}

export function ErrorMessage({ error }: { error: string }) {
  return (
    <article class="message assistant">
      <div class="message-content">
        <p>❌ {error}</p>
      </div>
    </article>
  );
}

function Sources({ docs, scores }: { docs: Document[]; scores: number[] }) {
  if (docs.length === 0) return null;
  
  return (
    <section class="sources">
      <details>
        <summary>📚 Sources</summary>
        <ol class="source-list">
          {docs.map((doc, i) => {
            const source = doc.metadata?.source || 'Unknown';
            const page = doc.metadata?.loc?.pageNumber || '?';
            const score = scores[i] || 0;
            
            return (
              <li key={i} data-number={i + 1}>
                <div class="source-details">
                  <div class="source-name">{source}</div>
                  <div class="source-meta">
                    Page {page} • {(score * 100).toFixed(1)}% relevant
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </details>
    </section>
  );
}

export function WeaponTable({ 
  weapons 
}: { 
  weapons: Array<{
    name: string;
    trait: string;
    range: string;
    damage: string;
    burden: string;
    feature: string;
  }> 
}) {
  if (weapons.length === 0) return null;
  
  return (
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
        {weapons.map((w, i) => (
          <tr key={i}>
            <td><strong>{w.name}</strong></td>
            <td>{w.trait}</td>
            <td>{w.range}</td>
            <td>{w.damage}</td>
            <td>{w.burden}</td>
            <td>{w.feature}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StatBlock({ content }: { content: string }) {
  return (
    <div class="stat-block">
      <pre>{content}</pre>
    </div>
  );
}