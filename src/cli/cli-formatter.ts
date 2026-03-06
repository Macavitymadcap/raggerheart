// src/ui/cli-formatter.ts
/**
 * Beautiful CLI formatting for Daggerheart RAG responses
 * 
 * Install dependencies:
 * bun add chalk boxen cli-table3 strip-ansi
 */

import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import stripAnsi from 'strip-ansi';
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

      // Name (all caps)
      if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !trimmed.includes('FEATURES')) {
        name = trimmed;
        formatted += chalk.hex('#FFD700').bold(trimmed) + '\n';
        continue;
      }

      // Tier/Role
      if (trimmed.match(/^Tier\s+\d+/i)) {
        tier = trimmed;
        formatted += chalk.hex('#DAA520')(trimmed) + '\n';
        continue;
      }

      // Section headers
      if (trimmed.match(/^(Motives?\s+&\s+Tactics?|FEATURES)$/i)) {
        formatted += '\n' + chalk.hex('#FF6347').bold(trimmed) + '\n';
        continue;
      }

      // Stats line
      if (trimmed.match(/Difficulty:|Thresholds:|HP:|Stress:/)) {
        formatted += chalk.hex('#87CEEB')(trimmed) + '\n';
        continue;
      }

      // Attack line
      if (trimmed.match(/^⚔.*ATK|^\+\d+.*\|/)) {
        formatted += chalk.hex('#FF4500').bold(trimmed) + '\n';
        continue;
      }

      // XP line
      if (trimmed.match(/^XP:/i)) {
        formatted += chalk.hex('#9370DB')(trimmed) + '\n';
        continue;
      }

      // Features
      if (trimmed.match(/^[•\-*]\s+/)) {
        const [featurePart, ...descParts] = trimmed.replace(/^[•\-*]\s+/, '').split(':');
        if (descParts.length > 0) {
          formatted += chalk.hex('#FFA500')(`• ${featurePart}:`) + 
                      chalk.gray(descParts.join(':')) + '\n';
        } else {
          formatted += chalk.gray(`• ${featurePart}`) + '\n';
        }
        continue;
      }

      // Regular text
      formatted += chalk.gray(trimmed) + '\n';
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

      // Skip template artifacts
      if (trimmed.includes('[Feature Name]') || 
          trimmed.includes('[Type]:') ||
          trimmed.includes('[... all')) {
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

      // Features
      if (trimmed.match(/^[•\-*]\s+/) && inFeatures) {
        const featureText = trimmed.replace(/^[•\-*]\s+/, '');
        const [namePart, ...rest] = featureText.split('-');
        
        if (rest.length > 0) {
          const [typePart, ...descParts] = rest.join('-').split(':');
          formatted += chalk.hex('#FFA500').bold(`• ${namePart?.trim()}`) +
                      chalk.hex('#98FB98')(` - ${typePart?.trim()}`) +
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
   * Format domain cards
   */
  private formatDomainCards(text: string): string {
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

    return formattedCards.join('\n');
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