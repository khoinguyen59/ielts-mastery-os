import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MarkdownSyncService } from '../../src/services/markdown-sync.service.js';
import fs from 'fs';
import path from 'path';

describe('MarkdownSyncService (Invariant 18 In-Place Token Replacement)', () => {
  const tempDir = path.resolve(process.cwd(), 'temp_test_vocab');
  let syncService: MarkdownSyncService;

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    // Fixture with headword and 2 derivative items
    const fixtureContent = `01. **acquire** (v) | /əˈkwaɪər/ | tiếp thu | 5.00 | gain = obtain | acquire knowledge | She acquired basic skills.
  a. **acquisition** (n) | /ˌæk.wɪˈzɪʃ.ən/ | sự tiếp thu | language acquisition
  b. **acquisitive** (adj) | /əˈkwɪz.ə.tɪv/ | thích thâu tóm | acquisitive instincts
`;
    fs.writeFileSync(path.join(tempDir, 'week_01.md'), fixtureContent, 'utf-8');
    syncService = new MarkdownSyncService(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('updates headword score in-place preserving 100% of derivative rows', () => {
    const success = syncService.updateWordScore('acquire', 6.5);
    expect(success).toBe(true);

    const updatedContent = fs.readFileSync(path.join(tempDir, 'week_01.md'), 'utf-8');
    const lines = updatedContent.split('\n');

    // Check headword line has updated score
    expect(lines[0]).toContain('| 6.50 |');
    // Check derivatives are preserved exactly
    expect(lines[1]).toContain('a. **acquisition** (n)');
    expect(lines[2]).toContain('b. **acquisitive** (adj)');
  });

  it('reads all markdown scores accurately', () => {
    const scores = syncService.readAllMarkdownScores();
    expect(scores['acquire']).toBe(5.0);
  });
});
