import { describe, it, expect } from 'vitest';
import { aiBridgeService } from '../../src/services/ai-bridge.service.js';

describe('AIBridgeService Unit Tests', () => {
  it('calculates fallback heuristic similarity gracefully when AI Engine is offline', async () => {
    const candidate = 'higher education establishes solid foundation';
    const references = [
      'tertiary education establishes enduring foundation',
      'unrelated topic about deep sea marine biology'
    ];

    const result = await aiBridgeService.getSemanticSimilarity(candidate, references);
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(1.0);
    expect(result.best_match).toBeDefined();
    expect(typeof result.latency_ms).toBe('number');
  });

  it('validates question format using offline heuristic when service is offline', async () => {
    const validQuestion = {
      prompt: 'Which word means traditional?',
      options: ['historic', 'novel', 'recent', 'futuristic'],
      correct_index: 0
    };

    const resValid = await aiBridgeService.validateQuestion(validQuestion);
    expect(resValid.valid).toBe(true);
    expect(resValid.errors.length).toBe(0);

    const invalidQuestion = {
      prompt: 'Invalid question with duplicated options',
      options: ['same', 'same', 'other', 'another'],
      correct_index: 5
    };

    const resInvalid = await aiBridgeService.validateQuestion(invalidQuestion);
    expect(resInvalid.valid).toBe(false);
    expect(resInvalid.errors.length).toBeGreaterThan(0);
  });
});
