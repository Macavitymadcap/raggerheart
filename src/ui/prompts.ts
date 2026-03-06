import { PromptTemplate } from "@langchain/core/prompts";

export const statBlockPrompt = PromptTemplate.fromTemplate(`Extract the requested adversary stat block. Output ONLY the stat block text with NO additional commentary.

Structure to look for:
- Title (adversary name in caps)
- Tier and Type (e.g., "Tier 1 Support")
- Description line
- Motives & Tactics
- Difficulty/Thresholds/HP/Stress
- ATK and attack details
- Experience
- FEATURES section

CRITICAL:
- If found: Output the stat block text ONLY, preserving exact wording and line breaks
- If NOT found: Output exactly: "NOT FOUND: [name]"
- NO explanations, NO commentary, NO extra text

Context:
{context}

Question: {question}

Stat Block:.`);


export const equipmentPrompt = PromptTemplate.fromTemplate(`
You are a Daggerheart SRD assistant. Extract weapon or equipment information from tables.

RULES:
- Weapons are in tables with: NAME, TRAIT, RANGE, DAMAGE, BURDEN, FEATURE
- Extract exact row(s) matching the requested weapon
- Format as: "NAME | TRAIT | RANGE | DAMAGE | BURDEN | FEATURE"
- If not found, say "No weapon found for [name]"
- Do NOT invent stats

Context:
{context}

Question: {question}

Answer (format as: NAME | TRAIT | RANGE | DAMAGE | BURDEN | FEATURE):`);


export const standardPrompt = PromptTemplate.fromTemplate(`
You are a Daggerheart SRD assistant. Answer based ONLY on the provided context.

RULES:
- Only use information from the context
- If information isn't in the context, say so
- Be concise and accurate

Context:
{context}

Question: {question}

Answer:`.trim());