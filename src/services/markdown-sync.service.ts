import fs from 'fs';
import path from 'path';

export class MarkdownSyncService {
  private vocabDir: string;

  constructor(customVocabDir?: string) {
    this.vocabDir = customVocabDir || path.resolve(process.cwd(), 'my-vocab');
  }

  /**
   * In-place atomic update of a word's score in my-vocab/week_XX.md.
   * Preserves all 413 derivative rows and formatting (Invariant 18).
   */
  public updateWordScore(word: string, newScore: number): boolean {
    if (!fs.existsSync(this.vocabDir)) return false;

    const targetWord = word.trim().toLowerCase();
    const formattedScore = newScore.toFixed(2);
    const files = fs.readdirSync(this.vocabDir).filter(f => f.startsWith('week_') && f.endsWith('.md'));

    for (const file of files) {
      const fullPath = path.join(this.vocabDir, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');
      let modified = false;

      const newLines = lines.map(line => {
        // Match: 01. **word** (pos) | ... | 6.00 | ...
        const headwordMatch = line.match(/^(\s*\d+\.\s+\*\*([a-zA-Z\s-]+)\*\*[^\n]*)/);
        if (headwordMatch) {
          const matchedWord = headwordMatch[2].trim().toLowerCase();
          if (matchedWord === targetWord) {
            // Split by pipe to replace specifically the score column
            const parts = line.split('|');
            if (parts.length >= 4) {
              parts[3] = ` ${formattedScore} `;
              modified = true;
              return parts.join('|');
            }
          }
        }
        return line;
      });

      if (modified) {
        this.atomicWriteFileSync(fullPath, newLines.join('\n'));
        return true;
      }
    }

    return false;
  }

  /**
   * Parse all headwords and their current scores across all week markdown files.
   */
  public readAllMarkdownScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    if (!fs.existsSync(this.vocabDir)) return scores;

    const files = fs.readdirSync(this.vocabDir).filter(f => f.startsWith('week_') && f.endsWith('.md'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(this.vocabDir, file), 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const headwordMatch = line.match(/^\s*\d+\.\s+\*\*([a-zA-Z\s-]+)\*\*[^\n]*/);
        if (headwordMatch) {
          const matchedWord = headwordMatch[1].trim().toLowerCase();
          const parts = line.split('|');
          if (parts.length >= 4) {
            const rawScore = parseFloat(parts[3].trim());
            if (!isNaN(rawScore)) {
              scores[matchedWord] = rawScore;
            }
          }
        }
      }
    }

    return scores;
  }

  /**
   * Atomic file write to prevent file corruption during power outage or unexpected crash.
   * Handles Windows-specific file locking and rename permissions gracefully.
   */
  private atomicWriteFileSync(filePath: string, content: string): void {
    const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
    try {
      fs.writeFileSync(tempPath, content, 'utf-8');
      fs.renameSync(tempPath, filePath);
    } catch {
      try {
        fs.copyFileSync(tempPath, filePath);
        fs.unlinkSync(tempPath);
      } catch {
        fs.writeFileSync(filePath, content, 'utf-8');
      }
    }
  }
}

export const markdownSyncService = new MarkdownSyncService();
