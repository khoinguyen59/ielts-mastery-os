import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function checkDirectory(dir: string, violations: string[]) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '__pycache__' && entry.name !== '.pytest_cache') {
        checkDirectory(fullPath, violations);
      }
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.ts') || entry.name.endsWith('.py') || entry.name.endsWith('.js') || entry.name.endsWith('.css') || entry.name.endsWith('.html')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n').length;
        if (lines > 400) {
          violations.push(`${path.relative(process.cwd(), fullPath)}: ${lines} lines`);
        }
      }
    }
  }
}

describe('Invariant 05: Code Cap <= 400 Lines Verification', () => {
  it('enforces that zero source files in src/ and ai_engine/ exceed 400 lines', () => {
    const violations: string[] = [];
    checkDirectory(path.resolve(process.cwd(), 'src'), violations);
    checkDirectory(path.resolve(process.cwd(), 'ai_engine'), violations);

    expect(violations).toEqual([]);
  });
});
