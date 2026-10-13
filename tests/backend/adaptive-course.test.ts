import { describe, it, expect, beforeAll } from 'vitest';
import { courseService, COURSES } from '../../src/services/course.service.js';
import { vocabService } from '../../src/services/vocab.service.js';
import { synthesisService } from '../../src/services/synthesis.service.js';
import { fsrsService } from '../../src/services/fsrs.service.js';
import { getDatabase } from '../../src/db/sqlite.js';

describe('Adaptive Course & Real-Time Question Sequencing Engine', () => {
  const db = getDatabase();

  beforeAll(() => {
    // Ensure test user exists
    db.prepare(`
      INSERT OR REPLACE INTO users (id, username, target_band, starting_band, onboarding_completed)
      VALUES ('test_adaptive_user', 'adaptive_tester', '3.5 - 4.0', '3.5', 1)
    `).run();
  });

  it('verifies all 5 leveled courses are defined with valid metadata and units', () => {
    const all = courseService.getAllCourses();
    const levels = ['starter', 'foundation', 'intermediate', 'advanced', 'mastery'];

    levels.forEach(lvl => {
      expect(all[lvl]).toBeDefined();
      expect(all[lvl].units.length).toBeGreaterThanOrEqual(2);
      expect(all[lvl].targetBand).toBeDefined();
      expect(all[lvl].vocabCount).toBeGreaterThan(0);
      expect(all[lvl].units[0].nodes.length).toBe(5);
    });
  });

  it('verifies starter course has survival units and green theme', () => {
    const starter = courseService.getCourse('starter');
    expect(starter.levelKey).toBe('starter');
    expect(starter.units[0].colorTheme).toBe('green');
    expect(starter.units[0].title).toContain('Sinh Tồn A1-A2');
    expect(starter.vocabRange).toEqual([0, 80]);
  });

  it('verifies mastery course has elite nuance units and red theme', () => {
    const mastery = courseService.getCourse('mastery');
    expect(mastery.levelKey).toBe('mastery');
    expect(mastery.units[0].colorTheme).toBe('red');
    expect(mastery.units[0].title).toContain('Nuance 50');
    expect(mastery.targetBand).toContain('8.5');
  });

  it('verifies vocabService.getByLevel filters vocab partitions correctly', () => {
    const starterWords = vocabService.getByLevel('starter');
    const masteryWords = vocabService.getByLevel('mastery');

    expect(starterWords.length).toBe(80);
    expect(masteryWords.length).toBe(300);

    // Starter contains early survival words, Mastery contains advanced words
    expect(starterWords[0].id).toBe('#001');
  });

  it('verifies getCourseForUser dynamically resolves assigned course from DB', () => {
    courseService.assignCourse('test_adaptive_user', 'starter');
    const info = courseService.getCourseForUser('test_adaptive_user');

    expect(info.levelKey).toBe('starter');
    expect(info.course.title).toContain('Khởi Đầu');

    // Switch user to advanced
    courseService.assignCourse('test_adaptive_user', 'advanced');
    const updated = courseService.getCourseForUser('test_adaptive_user');
    expect(updated.levelKey).toBe('advanced');
    expect(updated.course.title).toContain('Nâng Cao');
  });

  it('verifies Real-Time Adaptive Sequencing: Mistakes and "Cần học" words are immediately prioritized in next round', () => {
    // 1. Mark word #001 as lapsed / "Cần học" (rating 1)
    fsrsService.reviewWord('#001', 1);

    // 2. Request synthesis round for adaptive user
    const round = synthesisService.getSynthesisRound(undefined, 5, 'test_adaptive_user', 'starter');

    expect(round.length).toBe(5);
    // Word #001 MUST be present in the newly generated round because of recent lapse
    const containsWeakWord = round.some(q => q.target_word_id === '#001');
    expect(containsWeakWord).toBe(true);
  });
});
