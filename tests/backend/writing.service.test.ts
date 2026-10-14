import { describe, it, expect } from 'vitest';
import { writingService } from '../../src/services/writing.service.js';

describe('WritingService Micro-Chunks & Band Upgrades', () => {
  it('loads predefined IELTS Task 2 micro-chunks', () => {
    const chunks = writingService.getChunks();
    expect(chunks.length).toBeGreaterThanOrEqual(4);

    const chunk1 = writingService.getChunkById('chunk_01');
    expect(chunk1).toBeDefined();
    expect(chunk1?.title).toContain('Giáo dục Đại học');
    expect(chunk1?.band_75_model).toContain('contemporary society');
    expect(chunk1?.band_85_model).toContain('tertiary education');
  });

  it('evaluates student writing and detects target academic vocabulary', () => {
    const goodTranslation = 'In contemporary society, the bulk of young individuals choose to establish a foundation for work.';
    const result = writingService.evaluateTranslation('chunk_01', goodTranslation);

    expect(result.chunk_id).toBe('chunk_01');
    expect(result.used_target_words).toContain('contemporary');
    expect(result.used_target_words).toContain('bulk');
    expect(result.used_target_words).toContain('establish');
    expect(result.coverage_ratio).toBe(1.0);
    expect(result.band_estimate).toContain('7.5');
    expect(result.band_75_model).toBeDefined();
    expect(result.band_85_model).toBeDefined();
  });

  it('warns when target words are missing or sentence is too short', () => {
    const briefTranslation = 'Young people study.';
    const result = writingService.evaluateTranslation('chunk_01', briefTranslation);

    expect(result.missing_target_words.length).toBeGreaterThan(0);
    expect(result.feedback).toContain('ngắn');
    expect(result.coverage_ratio).toBeLessThan(0.5);
  });
});
