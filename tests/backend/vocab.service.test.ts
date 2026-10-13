import { describe, it, expect } from 'vitest';
import { vocabService } from '../../src/services/vocab.service.js';

describe('VocabService Unit Tests', () => {
  it('retrieves all Master AWL vocabulary (>= 450 words)', () => {
    const all = vocabService.getAll();
    expect(all.length).toBeGreaterThanOrEqual(450);
  });

  it('retrieves word by ID or word string', () => {
    const byId = vocabService.getById('#001');
    expect(byId).not.toBeNull();
    expect(byId?.word.toLowerCase()).toBe('abandon');

    const byWord = vocabService.getById('acquire');
    expect(byWord).not.toBeNull();
    expect(byWord?.word.toLowerCase()).toBe('acquire');
  });

  it('searches words with keyword and optional POS filter', () => {
    const results = vocabService.search('acquire');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].word).toContain('acquire');

    const verbResults = vocabService.search('acquire', 'v');
    expect(verbResults.length).toBeGreaterThanOrEqual(1);
    expect(verbResults[0].pos).toBe('v');
  });

  it('returns due words and learned words with proper scores', () => {
    const due = vocabService.getDueWords(10);
    expect(due.length).toBeGreaterThanOrEqual(1);

    const learned = vocabService.getLearnedWords(2.0);
    expect(learned.length).toBeGreaterThanOrEqual(1);
    const words = learned.map(w => w.word);
    expect(words).toContain('acquire');
    expect(words).toContain('hinder');
  });
});
