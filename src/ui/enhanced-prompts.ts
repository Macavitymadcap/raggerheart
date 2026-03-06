// src/ui/enhanced-prompts.ts
import { PromptTemplate } from "@langchain/core/prompts";

/**
 * Adversary stat block extraction prompt
 */
export const adversaryStatBlockPrompt = PromptTemplate.fromTemplate(`You are extracting a Daggerheart adversary stat block. Follow these rules EXACTLY:

STRUCTURE TO EXTRACT:
┌─────────────────────────────────────┐
│ NAME (all caps, e.g., "SKELETON ARCHER")
│ Tier X [Role] (e.g., "Tier 1 Minion")
│ [Description line]
│ 
│ Motives & Tactics
│ [Motive text]
│ 
│ Difficulty: X  |  Thresholds: Major X / Severe X
│ HP: X  |  Stress: X
│ 
│ ⚔ ATK [details]
│ [Attack description]
│ 
│ XP: X
│ 
│ FEATURES
│ • Feature Name - [Type]: [Description]
│ • [Additional features...]
└─────────────────────────────────────┘

EXTRACTION RULES:
1. If found: Output ONLY the stat block preserving exact format, line breaks, and spacing
2. Include ALL sections: name, tier/role, motives, difficulty, HP/Stress, ATK, XP, FEATURES
3. Preserve bullet points (•) for features
4. Do NOT add explanations, commentary, or markdown formatting
5. If NOT found: Output exactly "NOT FOUND: [entity name]"
6. Do NOT invent or fabricate statistics

Context:
{context}

Question: {question}

Stat Block:`);

/**
 * Environment stat block extraction prompt
 */
export const environmentStatBlockPrompt = PromptTemplate.fromTemplate(`You are extracting a Daggerheart environment stat block. Follow these rules EXACTLY:

STRUCTURE TO EXTRACT:
┌─────────────────────────────────────┐
│ NAME (all caps, e.g., "COLLAPSING RUINS")
│ Tier X
│ [Description line]
│ 
│ Difficulty: X  |  Thresholds: Major X / Severe X
│ Stress: X
│ 
│ FEATURES
│ • Feature Name - [Type]: [Description]
│ • [Additional features...]
└─────────────────────────────────────┘

EXTRACTION RULES:
1. If found: Output ONLY the stat block preserving exact format and spacing
2. Include ALL sections: name, tier, difficulty, stress, features
3. Preserve bullet points (•) for features
4. Do NOT add explanations or markdown
5. If NOT found: Output exactly "NOT FOUND: [entity name]"

Context:
{context}

Question: {question}

Stat Block:`);

/**
 * Equipment table extraction prompt
 */
export const equipmentTablePrompt = PromptTemplate.fromTemplate(`You are extracting Daggerheart equipment data. Output as a structured table.

WEAPONS TABLE FORMAT:
NAME | TRAIT | RANGE | DAMAGE | BURDEN | FEATURE

ARMOR TABLE FORMAT:
NAME | ARMOR SCORE | SLOTS USED | FEATURE

EXTRACTION RULES:
1. Extract ALL matching items from the context
2. Use exact column values from source tables
3. Preserve trait keywords (Melee, Ranged, Finesse, Heavy, Two-Handed, Versatile)
4. Use "—" for empty cells
5. One item per line, pipe-separated (|)
6. Do NOT add markdown formatting or code blocks
7. If not found: "NOT FOUND: [item name]"

Context:
{context}

Question: {question}

Table:`);

/**
 * Class features extraction prompt
 */
export const classGuidePrompt = PromptTemplate.fromTemplate(`You are creating a comprehensive Daggerheart class guide. Extract and organize ALL class information.

OUTPUT STRUCTURE:
═══════════════════════════════════════
CLASS: [NAME]
═══════════════════════════════════════

DESCRIPTION
[Full class description from source]

CORE STATS
• Domains: [Primary] & [Secondary]
• Starting Evasion: [X]
• Starting HP: [X]
• Class Items: [Items]

FOUNDATION FEATURES (Level 1)
• [Feature Name] - [Type]: [Full description]
• [Feature Name] - [Type]: [Full description]
[... all foundation features]

SPECIALIZATION FEATURES (Levels 2-4)
• [Feature Name] - [Type]: [Full description]
[... all specialization features]

MASTERY FEATURES (Levels 5-10)
• [Feature Name] - [Type]: [Full description]
[... all mastery features]

═══════════════════════════════════════

EXTRACTION RULES:
1. Include COMPLETE descriptions for every feature
2. Organize by progression tier (Foundation → Specialization → Mastery)
3. Mark feature types: Passive, Action, Reaction, etc.
4. Preserve exact wording from source
5. Use bullet points (•) for features
6. If incomplete: note "[Partial - see source for full details]"

Context:
{context}

Question: {question}

Class Guide:`);

/**
 * Domain cards extraction prompt
 */
export const domainCardsPrompt = PromptTemplate.fromTemplate(`You are extracting Daggerheart domain cards. Output as structured cards.

CARD FORMAT:
┌─────────────────────────────────────┐
│ CARD NAME
│ [Domain] • [Level/Type]
│ 
│ [Full card text/description]
│ 
│ [Mechanics/effects]
└─────────────────────────────────────┘

EXTRACTION RULES:
1. Extract ALL cards matching the query
2. Preserve exact card text and formatting
3. Include level/tier if specified
4. Group by domain if showing multiple domains
5. Use box drawing for visual separation
6. Do NOT summarize or paraphrase card text
7. If asking for a specific domain, show all cards from that domain

Context:
{context}

Question: {question}

Domain Cards:`);

/**
 * Comparison prompt
 */
export const comparisonPrompt = PromptTemplate.fromTemplate(`You are comparing Daggerheart game elements. Create a structured comparison.

OUTPUT FORMAT:
═══════════════════════════════════════
COMPARISON: [Item A] vs [Item B]
═══════════════════════════════════════

[ITEM A]
[Full details with stats/features]

[ITEM B]
[Full details with stats/features]

KEY DIFFERENCES
• [Aspect]: [How they differ]
• [Aspect]: [How they differ]

RECOMMENDATIONS
[When to use each option]

═══════════════════════════════════════

RULES:
1. Show complete information for both items
2. Highlight mechanical differences
3. Be objective and balanced
4. Base recommendations on actual stats

Context:
{context}

Question: {question}

Comparison:`);

/**
 * General explanation prompt
 */
export const generalExplanationPrompt = PromptTemplate.fromTemplate(`You are a Daggerheart rules assistant. Answer based ONLY on the provided context.

RESPONSE RULES:
1. Answer clearly and concisely
2. Quote exact rules when relevant
3. Use bullet points for lists of mechanics
4. Cite page numbers when available
5. If the context doesn't contain the answer, state: "This information is not in the provided source material."
6. Do NOT invent rules or mechanics

Context:
{context}

Question: {question}

Answer:`);

/**
 * Get the appropriate prompt template based on intent
 */
export function getPromptForIntent(
  intent: string
): PromptTemplate {
  switch (intent) {
    case 'show_adversary_statblock':
      return adversaryStatBlockPrompt;
    
    case 'show_environment_statblock':
      return environmentStatBlockPrompt;
    
    case 'show_equipment_table':
      return equipmentTablePrompt;
    
    case 'show_class_features':
      return classGuidePrompt;
    
    case 'show_domain_cards':
      return domainCardsPrompt;
    
    case 'compare_items':
      return comparisonPrompt;
    
    case 'explain_concept':
    default:
      return generalExplanationPrompt;
  }
}