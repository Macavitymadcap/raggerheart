import { PromptTemplate } from '@langchain/core/prompts';
import type { QueryIntent } from '../types/query';

// ============================================================================
// ADVERSARY & ENVIRONMENT STAT BLOCKS
// ============================================================================

const adversaryStatBlockPrompt = PromptTemplate.fromTemplate(`You are extracting a complete stat block for an adversary or creature from Daggerheart TTRPG.

Extract EVERY piece of information available including:
- Name and tier
- Description/lore
- Motives & Tactics
- Difficulty rating
- Experience Thresholds
- HP and Stress
- Attack values (⚔ ATK)
- XP reward
- ALL Features (with complete descriptions)
- Any special abilities or notes

OUTPUT FORMAT: Present the complete stat block with ALL fields filled in. If a field is present in the source, include it. Do not leave sections empty.

Context:
{context}

Question: {question}

Complete Stat Block:`);

const environmentStatBlockPrompt = PromptTemplate.fromTemplate(`You are extracting environment/hazard stat blocks from Daggerheart TTRPG.

Extract EVERY detail including:
- Environment name and type
- Description
- Difficulty
- Effects and mechanics
- Duration/frequency
- Damage or consequences
- How to overcome/interact

OUTPUT FORMAT: Present all available information in an organized stat block format.

Context:
{context}

Question: {question}

Environment Stat Block:`);

// ============================================================================
// CLASS & ANCESTRY INFORMATION
// ============================================================================

const classGuidePrompt = PromptTemplate.fromTemplate(`You are extracting ALL features and abilities for a class from Daggerheart TTRPG.

Extract EVERY feature with complete details:
- ALL Foundation Features (Level 1) with full descriptions
- ALL Specialization Features (Levels 2-4) with full descriptions
- ALL Mastery Features (Levels 5-10) with full descriptions

For EACH feature include:

- Feature Name - Type (Action/Reaction/Passive): Complete description with mechanics

Do NOT leave bullet points empty. If you find a feature name but partial details, include what you have. If features reference game mechanics (Hope, Fear, Stress, etc.), explain them.

Context:
{context}

Question: {question}

Complete Class Feature List:`);

const ancestryGuidePrompt = PromptTemplate.fromTemplate(`You are extracting ancestry information from Daggerheart TTRPG.

Extract ALL details including:
- Ancestry name and description
- Core attributes and bonuses
- Starting abilities
- Cultural background
- Special traits or features
- Any mechanical bonuses
- Recommended classes or domains

OUTPUT FORMAT: Present complete ancestry information with all mechanical and narrative details.

Context:
{context}

Question: {question}

Complete Ancestry Guide:`);

// ============================================================================
// DOMAIN CARDS & SPELLS
// ============================================================================

const domainCardsPrompt = PromptTemplate.fromTemplate(`You are extracting domain cards for a specific domain from Daggerheart TTRPG.

Extract ALL cards for this domain with complete details:
- Card name and tier
- Hope cost or requirements
- Complete effect description
- Range and targeting
- Duration
- Any special conditions or limitations

List EVERY card you find. Do not summarize or omit cards.

OUTPUT FORMAT:
For each card:

- [CARD NAME] - [TIER]
  Cost: [Hope cost]
  Effect: [Complete description]
  
Context:
{context}

Question: {question}

Complete Domain Card List:`);

const spellListPrompt = PromptTemplate.fromTemplate(`You are compiling a complete list of spells or magical abilities.

Extract ALL spells with:
- Spell name
- Domain/source
- Level/tier requirement
- Cost (Hope, Stress, etc.)
- Complete effect description
- Range, duration, targets
- Any special notes

Present as a comprehensive list with all available details.

Context:
{context}

Question: {question}

Complete Spell List:`);

// ============================================================================
// EQUIPMENT & ITEMS
// ============================================================================

const equipmentTablePrompt = PromptTemplate.fromTemplate(`You are extracting equipment information from Daggerheart TTRPG.

Extract ALL items requested with complete stats:
- Item name
- Type (weapon, armor, tool, etc.)
- Damage dice (for weapons)
- Properties (finesse, heavy, thrown, etc.)
- Range (if applicable)
- Cost/value
- Special abilities or features
- Any tags or keywords

Present as a complete table or list with all mechanical details.

Context:
{context}

Question: {question}

Complete Equipment List:`);

const lootTablePrompt = PromptTemplate.fromTemplate(`You are extracting loot tables or treasure from Daggerheart TTRPG.

Extract complete loot information:
- Loot category/tier
- Individual items with descriptions
- Rarity or value
- Special properties
- Any roll tables or random generation rules

Present all loot items with full details.

Context:
{context}

Question: {question}

Complete Loot Information:`);

const consumablesPrompt = PromptTemplate.fromTemplate(`You are extracting consumable items (potions, scrolls, bombs, etc.) from Daggerheart TTRPG.

Extract ALL consumables with:
- Item name
- Type (potion, scroll, etc.)
- Effect description
- Duration
- Cost/rarity
- How to use
- Any special notes

Present complete information for each consumable.

Context:
{context}

Question: {question}

Complete Consumables List:`);

// ============================================================================
// COMMUNITY & DOWNTIME
// ============================================================================

const communityCardsPrompt = PromptTemplate.fromTemplate(`You are extracting community cards from Daggerheart TTRPG.

Extract ALL community features with:
- Card name and type
- Description
- Mechanical effects
- Requirements or costs
- How it impacts the community
- Any special rules

Present complete details for each community card.

Context:
{context}

Question: {question}

Complete Community Cards:`);

const downtimePrompt = PromptTemplate.fromTemplate(`You are explaining downtime mechanics from Daggerheart TTRPG.

Extract complete downtime information:
- Available downtime activities
- How to use downtime
- Costs and benefits
- Roll mechanics
- Examples
- Any special rules or limitations

Provide a comprehensive explanation of the downtime system.

Context:
{context}

Question: {question}

Complete Downtime Guide:`);

// ============================================================================
// CORE MECHANICS & CONCEPTS
// ============================================================================

const mechanicsPrompt = PromptTemplate.fromTemplate(`You are explaining core game mechanics from Daggerheart TTRPG.

Provide a COMPLETE explanation including:
- What the mechanic is
- How it works step-by-step
- When to use it
- Rules and limitations
- Examples
- How it interacts with other mechanics

Be thorough and clear. Include all relevant rules.

Context:
{context}

Question: {question}

Complete Mechanics Explanation:`);

const hopeAndFearPrompt = PromptTemplate.fromTemplate(`You are explaining the Hope and Fear system from Daggerheart TTRPG.

Provide COMPLETE information about:
- What Hope and Fear are
- How players gain them
- How they're used mechanically
- The Action Roll system (Hope = success, Fear = GM gets a token)
- How Fear tokens work for the GM
- Examples of Hope and Fear in play
- Special rules or edge cases

Be comprehensive and include all mechanical details.

Context:
{context}

Question: {question}

Complete Hope & Fear Explanation:`);

// ============================================================================
// COMPARISON & ANALYSIS
// ============================================================================

const compareItemsPrompt = PromptTemplate.fromTemplate(`You are comparing multiple items, classes, or options from Daggerheart TTRPG.

For each option, provide:
- Complete stats and mechanics
- Strengths and weaknesses
- Best use cases
- Key differences between options
- Recommendations based on playstyle

Present a thorough comparison with all relevant details.

Context:
{context}

Question: {question}

Complete Comparison:`);

// ============================================================================
// GENERAL QUERIES
// ============================================================================

const explainConceptPrompt = PromptTemplate.fromTemplate(`You are explaining a concept, rule, or system from Daggerheart TTRPG.

Provide a clear, complete explanation that includes:
- What it is
- How it works
- Why it matters
- Examples
- Any important details or edge cases

Base your answer ONLY on the provided context. Be thorough but concise.

Context:
{context}

Question: {question}

Answer:`);

const generalPrompt = PromptTemplate.fromTemplate(`You are answering a question about Daggerheart TTRPG.

Provide a helpful, accurate answer based on the context provided. Include:
- Direct answer to the question
- Supporting details
- Examples if helpful
- Any relevant mechanics or rules

Be conversational but complete.

Context:
{context}

Question: {question}

Answer:`);

// ============================================================================
// SPECIALTY PROMPTS
// ============================================================================

const combatPrompt = PromptTemplate.fromTemplate(`You are explaining combat rules and mechanics from Daggerheart TTRPG.

Provide complete combat information including:
- Initiative and turn order
- Action economy
- Attack rolls and damage
- Armor and evasion
- Special combat actions
- Examples of combat flow

Be thorough and include all relevant combat rules.

Context:
{context}

Question: {question}

Complete Combat Guide:`);

const characterCreationPrompt = PromptTemplate.fromTemplate(`You are guiding character creation in Daggerheart TTRPG.

Provide complete information about:
- Character creation steps
- Choosing class and ancestry
- Starting equipment
- Calculating stats
- Initial abilities
- Any character creation rules

Present a comprehensive guide.

Context:
{context}

Question: {question}

Complete Character Creation Guide:`);

const stressAndArmorPrompt = PromptTemplate.fromTemplate(`You are explaining Stress and Armor mechanics from Daggerheart TTRPG.

Provide COMPLETE information about:
- What Stress is and how it works
- How to gain and clear Stress
- What happens at maximum Stress
- Armor values and types
- How armor reduces damage
- Armor Slots and equipment
- Examples

Be thorough and include all mechanical details.

Context:
{context}

Question: {question}

Complete Stress & Armor Guide:`);

// ============================================================================
// PROMPT SELECTION FUNCTION
// ============================================================================

export function getPromptForIntent(intent: QueryIntent): PromptTemplate {
  const prompts: Record<QueryIntent, PromptTemplate> = {
    // Stat blocks
    show_adversary_statblock: adversaryStatBlockPrompt,
    show_environment_statblock: environmentStatBlockPrompt,
    
    // Classes & Ancestry
    show_class_features: classGuidePrompt,
    show_ancestry_features: ancestryGuidePrompt,
    
    // Magic & Abilities
    show_domain_cards: domainCardsPrompt,
    list_spells: spellListPrompt,
    
    // Equipment & Items
    show_equipment_table: equipmentTablePrompt,
    list_equipment: equipmentTablePrompt,
    show_loot_table: lootTablePrompt,
    list_consumables: consumablesPrompt,
    
    // Community & Downtime
    show_community_cards: communityCardsPrompt,
    explain_downtime: downtimePrompt,
    
    // Mechanics
    explain_mechanics: mechanicsPrompt,
    explain_hope_fear: hopeAndFearPrompt,
    explain_combat: combatPrompt,
    explain_character_creation: characterCreationPrompt,
    explain_stress_armor: stressAndArmorPrompt,
    
    // Comparison
    compare_items: compareItemsPrompt,
    compare_classes: compareItemsPrompt,
    
    // General
    explain_concept: explainConceptPrompt,
    answer_question: generalPrompt,
    general_query: generalPrompt,
  };

  return prompts[intent] || generalPrompt;
}

// Export individual prompts for testing
export {
  adversaryStatBlockPrompt,
  environmentStatBlockPrompt,
  classGuidePrompt,
  ancestryGuidePrompt,
  domainCardsPrompt,
  spellListPrompt,
  equipmentTablePrompt,
  lootTablePrompt,
  consumablesPrompt,
  communityCardsPrompt,
  downtimePrompt,
  mechanicsPrompt,
  hopeAndFearPrompt,
  compareItemsPrompt,
  explainConceptPrompt,
  generalPrompt,
  combatPrompt,
  characterCreationPrompt,
  stressAndArmorPrompt,
};