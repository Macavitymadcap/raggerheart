// src/cli/cli-formatter.ts - FIXED VERSION
/**
 * Beautiful CLI formatting for Daggerheart RAG responses
 * 
 * Install dependencies:
 * bun add chalk boxen cli-table3 strip-ansi
 */

import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import type { QueryIntent } from '../types/query';

export interface FormatterOptions {
  intent: QueryIntent;
  rawText: string;
  width?: number;
}

export class CLIFormatter {
  private width: number;

  constructor(width = 80) {
    this.width = Math.min(width, process.stdout.columns || 80);
  }

  /**
   * Format response based on query intent
   */
  format(options: FormatterOptions): string {
    const { intent, rawText } = options;

    // Remove any prompt template artifacts
    const cleanText = this.removePromptArtifacts(rawText);

    switch (intent) {
      case 'show_adversary_statblock':
      case 'show_environment_statblock':
        return this.formatStatBlock(cleanText, intent === 'show_adversary_statblock');

      case 'show_equipment_table':
        return this.formatEquipmentTable(cleanText);

      case 'show_class_features':
        return this.formatClassGuide(cleanText);

      case 'show_domain_cards':
        return this.formatDomainCards(cleanText);

      case 'compare_items':
        return this.formatComparison(cleanText);

      default:
        return this.formatGeneral(cleanText);
    }
  }

  /**
   * Remove prompt template artifacts from LLM output
   */
  private removePromptArtifacts(text: string): string {
    // Remove extraction rules sections
    text = text.replace(/EXTRACTION RULES:[\s\S]*$/im, '');
    
    // Remove template structure markers
    text = text.replace(/┌─+┐[\s\S]*?└─+┘/g, '');
    text = text.replace(/\[Feature Name\].*?\[Type\]:.*?\[Full description\]/gi, '');
    text = text.replace(/\[\.\.\. all .*? features\]/gi, '');
    
    // Remove "Note:" sections that explain missing data
    text = text.replace(/Note:.*?$/ims, '');
    
    return text.trim();
  }

  /**
   * Format adversary or environment stat block
   */
  private formatStatBlock(text: string, isAdversary = true): string {
    if (text.includes('NOT FOUND:')) {
      const name = text.replace('NOT FOUND:', '').trim();
      return boxen(
        chalk.red.bold('⚠️  Not Found\n\n') +
        chalk.gray(`No stat block found for: ${chalk.white(name)}\n`) +
        chalk.gray('Try checking the spelling or searching for a different entity.'),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'red',
        }
      );
    }

    const lines = text.split('\n').filter(l => l.trim());
    let formatted = '';
    let name = '';
    let tier = '';

    for (const line of lines) {
      const trimmed = line.trim();

      // Name (all caps or **NAME**)
      if ((trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !trimmed.includes('FEATURES')) ||
          trimmed.match(/^\*\*[A-Z\s]+\*\*$/)) {
        name = trimmed.replace(/\*\*/g, '');
        formatted += chalk.hex('#FFD700').bold(name) + '\n';
        continue;
      }

      // Tier/Role
      if (trimmed.match(/^_?\*?\*?Tier\s+\d+/i)) {
        tier = trimmed.replace(/[_*]/g, '');
        formatted += chalk.hex('#DAA520')(tier) + '\n';
        continue;
      }

      // Section headers
      if (trimmed.match(/^(Motives?\s+&\s+Tactics?|FEATURES|Experience)$/i)) {
        formatted += '\n' + chalk.hex('#FF6347').bold(trimmed) + '\n';
        continue;
      }

      // Stats line
      if (trimmed.match(/Difficulty:|Thresholds:|HP:|Stress:/)) {
        formatted += chalk.hex('#87CEEB')(trimmed) + '\n';
        continue;
      }

      // Attack line
      if (trimmed.match(/^⚔.*ATK|^\*\*⚔.*ATK|^\+\d+.*\|/)) {
        formatted += chalk.hex('#FF4500').bold(trimmed.replace(/\*\*/g, '')) + '\n';
        continue;
      }

      // XP/Experience line
      if (trimmed.match(/^(XP:|Experience:)/i)) {
        formatted += chalk.hex('#9370DB')(trimmed) + '\n';
        continue;
      }

      // Features
      if (trimmed.match(/^[•\-*]\s+/) || trimmed.match(/^_\*\*/)) {
        const [featurePart, ...descParts] = trimmed
          .replace(/^[•\-*]\s+/, '')
          .replace(/^_\*\*/, '')
          .replace(/\*\*_?:/, ':')
          .split(':');
        
        if (descParts.length > 0) {
          formatted += chalk.hex('#FFA500')(`• ${featurePart}:`) + 
                      chalk.gray(descParts.join(':').trim()) + '\n';
        } else {
          formatted += chalk.gray(`• ${featurePart}`) + '\n';
        }
        continue;
      }

      // Regular text
      if (trimmed && !trimmed.startsWith('Based on')) {
        formatted += chalk.gray(trimmed) + '\n';
      }
    }

    const borderColor = isAdversary ? 'red' : 'green';
    const title = name || (isAdversary ? 'Adversary Stat Block' : 'Environment Stat Block');

    return boxen(formatted.trim(), {
      title: chalk.bold(title),
      titleAlignment: 'center',
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor,
    });
  }

  /**
   * Format equipment table
   */
  private formatEquipmentTable(text: string): string {
    if (text.includes('NOT FOUND:')) {
      return chalk.red.bold('⚠️  ') + chalk.gray(text);
    }

    const lines = text.split('\n').filter(l => l.trim() && l.includes('|'));
    
    if (lines.length === 0) {
      return chalk.gray(text);
    }

    // Detect table type by column count
    const firstRow = lines[0]!.split('|').map(c => c.trim()).filter(c => c);
    const isWeaponTable = firstRow.length >= 5;

    const table = new Table({
      head: isWeaponTable
        ? [
            chalk.hex('#FFD700')('Name'),
            chalk.hex('#87CEEB')('Trait'),
            chalk.hex('#98FB98')('Range'),
            chalk.hex('#FF6347')('Damage'),
            chalk.hex('#DAA520')('Burden'),
            chalk.hex('#9370DB')('Feature'),
          ]
        : [
            chalk.hex('#FFD700')('Name'),
            chalk.hex('#87CEEB')('Armor Score'),
            chalk.hex('#98FB98')('Slots'),
            chalk.hex('#9370DB')('Feature'),
          ],
      style: {
        head: [],
        border: ['gray'],
      },
      chars: {
        'top': '═',
        'top-mid': '╤',
        'top-left': '╔',
        'top-right': '╗',
        'bottom': '═',
        'bottom-mid': '╧',
        'bottom-left': '╚',
        'bottom-right': '╝',
        'left': '║',
        'left-mid': '╟',
        'mid': '─',
        'mid-mid': '┼',
        'right': '║',
        'right-mid': '╢',
        'middle': '│',
      },
    });

    for (const line of lines) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length >= 4) {
        table.push(cells.map((cell, i) => 
          i === 0 ? chalk.white.bold(cell) : chalk.gray(cell)
        ));
      }
    }

    return '\n' + table.toString() + '\n';
  }

  /**
   * Format class guide
   */
  private formatClassGuide(text: string): string {
    const lines = text.split('\n');
    let formatted = '';
    let className = '';
    let inFeatures = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip template artifacts and intro text
      if (trimmed.includes('[Feature Name]') || 
          trimmed.includes('[Type]:') ||
          trimmed.includes('[... all') ||
          trimmed.startsWith('Based on')) {
        continue;
      }

      // Class name
      if (trimmed.startsWith('CLASS:')) {
        className = trimmed.replace('CLASS:', '').trim();
        continue;
      }

      // Section headers
      if (trimmed.match(/^(DESCRIPTION|CORE STATS|FOUNDATION FEATURES|SPECIALIZATION FEATURES|MASTERY FEATURES|SUBCLASSES)/)) {
        inFeatures = trimmed.includes('FEATURES');
        formatted += '\n' + chalk.hex('#FF6347').bold(trimmed) + '\n';
        continue;
      }

      // Dividers
      if (trimmed.match(/^═+$/)) {
        continue;
      }

      // Features (numbered or bulleted)
      if ((trimmed.match(/^[•\-*\d]+[\.\)]\s+/) || trimmed.match(/^\d+\.\s+\*\*/)) && inFeatures) {
        const featureText = trimmed
          .replace(/^[•\-*\d]+[\.\)]\s+/, '')
          .replace(/^\d+\.\s+/, '');
        
        const [namePart, ...rest] = featureText.split(/[-–:]/);
        
        if (rest.length > 0) {
          const restText = rest.join(':').trim();
          const [typePart, ...descParts] = restText.split(':');
          
          formatted += chalk.hex('#FFA500').bold(`• ${namePart?.trim()}`) +
                      (typePart ? chalk.hex('#98FB98')(` - ${typePart.trim()}`) : '') +
                      (descParts.length > 0 ? chalk.gray(`: ${descParts.join(':').trim()}`) : '') + '\n';
        } else {
          formatted += chalk.gray(`• ${featureText}`) + '\n';
        }
        continue;
      }

      // Core stats
      if (trimmed.match(/^[•\-*]\s+/) && !inFeatures) {
        formatted += chalk.hex('#87CEEB')(trimmed) + '\n';
        continue;
      }

      // Regular text
      if (trimmed) {
        formatted += chalk.gray(trimmed) + '\n';
      }
    }

    if (!className) {
      className = 'Class Guide';
    }

    return boxen(formatted.trim(), {
      title: chalk.hex('#FFD700').bold(className),
      titleAlignment: 'center',
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'yellow',
    });
  }

  /**
   * Format domain cards - FIXED VERSION
   */
  private formatDomainCards(text: string): string {
    // Try to extract cards from bullet point format
    const cardPattern = /^[•\-*]\s+(.+?)\s*-\s*Level\s+(\d+)/gmi;
    const matches = [...text.matchAll(cardPattern)];
    
    if (matches.length === 0) {
      // Fallback: try markdown headers
      return this.formatDomainCardsMarkdown(text);
    }

    const formattedCards: string[] = [];
    
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i]!;
      const cardName = match[1]?.trim();
      const level = match[2];
      const startIdx = match.index!;
      const endIdx = i < matches.length - 1 ? matches[i + 1]!.index! : text.length;
      
      const cardText = text.substring(startIdx, endIdx).trim();
      
      // Extract cost, effect, range, duration
      const costMatch = cardText.match(/Cost:\s*(.+?)(?:\n|Effect:|Range:|Duration:|$)/i);
      const effectMatch = cardText.match(/Effect:\s*(.+?)(?:\n\s*(?:Range:|Duration:|[•\-*])|\n\n|$)/is);
      const rangeMatch = cardText.match(/Range:\s*(.+?)(?:\n|Duration:|$)/i);
      const durationMatch = cardText.match(/Duration:\s*(.+?)(?:\n|$)/i);
      
      let content = chalk.hex('#FFD700').bold(`${cardName} - Level ${level}`) + '\n';
      content += chalk.gray('─'.repeat(Math.min((cardName?.length || 0) + 10, 50))) + '\n\n';
      
      if (costMatch) {
        content += chalk.hex('#87CEEB')('💎 Cost: ') + chalk.white(costMatch[1]?.trim()) + '\n';
      }
      
      if (effectMatch) {
        const effect = effectMatch[1]?.trim().replace(/\n/g, ' ');
        content += chalk.hex('#98FB98')('✨ Effect:\n  ') + chalk.gray(effect) + '\n';
      }
      
      if (rangeMatch) {
        content += chalk.hex('#FFA500')('📏 Range: ') + chalk.white(rangeMatch[1]?.trim()) + '\n';
      }
      
      if (durationMatch) {
        content += chalk.hex('#9370DB')('⏱️  Duration: ') + chalk.white(durationMatch[1]?.trim()) + '\n';
      }
      
      const formattedCard = boxen(content.trim(), {
        padding: 1,
        margin: { top: 0, bottom: 1, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: 'magenta',
      });
      
      formattedCards.push(formattedCard);
    }

    return formattedCards.length > 0 ? formattedCards.join('\n') : this.formatGeneral(text);
  }

  /**
   * Format domain cards from markdown headers (fallback)
   */
  private formatDomainCardsMarkdown(text: string): string {
    const cards = text.split(/(?=^#{2,3}\s+\w)/m).filter(c => c.trim());
    const formattedCards: string[] = [];

    for (const card of cards) {
      const lines = card.split('\n').filter(l => l.trim());
      if (lines.length === 0) continue;

      let cardName = '';
      let cardContent = '';

      for (const line of lines) {
        const trimmed = line.trim();
        const headerMatch = trimmed.match(/^#{2,3}\s+(.+)$/);

        if (headerMatch) {
          cardName = headerMatch[1]!;
        } else {
          cardContent += trimmed + '\n';
        }
      }

      if (cardName) {
        const formattedCard = boxen(
          chalk.hex('#FFD700').bold(cardName) + '\n' +
          chalk.gray('─'.repeat(Math.min(cardName.length, 40))) + '\n' +
          chalk.gray(cardContent.trim()),
          {
            padding: 1,
            margin: { top: 0, bottom: 1, left: 2, right: 2 },
            borderStyle: 'round',
            borderColor: 'magenta',
          }
        );
        formattedCards.push(formattedCard);
      }
    }

    return formattedCards.length > 0 ? formattedCards.join('\n') : this.formatGeneral(text);
  }

  /**
   * Format comparison
   */
  private formatComparison(text: string): string {
    return boxen(chalk.gray(text), {
      title: chalk.bold('Comparison'),
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
    });
  }

  /**
   * Format general response
   */
  private formatGeneral(text: string): string {
    const lines = text.split('\n').filter(l => l.trim());
    let formatted = '';

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip intro phrases
      if (trimmed.startsWith('Based on') || trimmed.startsWith('Here is')) {
        continue;
      }

      // Bullet points
      if (trimmed.match(/^[•\-*]\s+/)) {
        formatted += chalk.hex('#87CEEB')('• ') + 
                    chalk.gray(trimmed.replace(/^[•\-*]\s+/, '')) + '\n';
      } else {
        formatted += chalk.gray(trimmed) + '\n';
      }
    }

    return '\n' + formatted;
  }

  /**
   * Format error message
   */
  static error(message: string): string {
    return boxen(
      chalk.red.bold('❌ Error\n\n') + chalk.gray(message),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'red',
      }
    );
  }

  /**
   * Format success message
   */
  static success(message: string): string {
    return chalk.green('✅ ') + chalk.gray(message);
  }

  /**
   * Format info message
   */
  static info(message: string): string {
    return chalk.blue('ℹ️  ') + chalk.gray(message);
  }

  /**
   * Format warning message
   */
  static warning(message: string): string {
    return chalk.yellow('⚠️  ') + chalk.gray(message);
  }
}