import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { FastifyInstance } from 'fastify';
import { getDatabase } from '../../src/db/sqlite.js';
import { synthesisService } from '../../src/services/synthesis.service.js';
import { expansionService } from '../../src/services/expansion.service.js';
import { vocabService } from '../../src/services/vocab.service.js';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('Recursive Vocabulary Expansion Flow & Dynamic Learning (5 Upgrades)', () => {
  let app: FastifyInstance;
  const db = getDatabase();
  const testUser = 'user_recursive_test';
  const rootDir = process.cwd();

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    // Seed test user
    db.prepare("INSERT OR IGNORE INTO users (id, username, display_name) VALUES (?, ?, ?)").run(testUser, testUser, testUser);
    db.prepare("INSERT OR IGNORE INTO user_stats (user_id) VALUES (?)").run(testUser);
  });

  afterAll(async () => {
    try {
      db.prepare("DELETE FROM confused_word_pairs WHERE user_id = ?").run(testUser);
      db.prepare("DELETE FROM user_vocab_progress WHERE user_id = ?").run(testUser);
      db.prepare("DELETE FROM user_stats WHERE user_id = ?").run(testUser);
      db.prepare("DELETE FROM users WHERE id = ?").run(testUser);
    } catch {}
    await app.close();
  });

  it('1. Enforces Golden Ratio Comprehensible Input (i + 1) with Thematic Clustering', () => {
    db.prepare(`
      INSERT OR REPLACE INTO user_vocab_progress (user_id, word_id, current_score, stability, difficulty)
      VALUES (?, '#001', 4.0, 5.0, 3.0)
    `).run(testUser);
    db.prepare(`
      INSERT OR REPLACE INTO user_vocab_progress (user_id, word_id, current_score, stability, difficulty)
      VALUES (?, '#002', 1.5, 0.5, 3.0)
    `).run(testUser);

    const round = synthesisService.getSynthesisRound('#003', 3, testUser);
    expect(round.length).toBeGreaterThanOrEqual(1);

    for (const q of round) {
      expect(q.embedded_word_ids.length).toBeLessThanOrEqual(2);
      for (const embId of q.embedded_word_ids) {
        expect(embId).not.toBe('#002'); // #002 score is 1.5 (< 3.0), cannot be embedded
      }
    }

    // Thematic clustering test
    const allWords = vocabService.getAll(testUser);
    const targetWord = allWords.find(w => w.word.toLowerCase() === 'alleviate') || allWords[0];
    const learnedIds = new Set(allWords.filter(w => ['conflict', 'isolation', 'adequate', 'environment'].includes(w.word.toLowerCase())).map(w => w.id));
    const thematic = expansionService.getThematicLearnedWords(targetWord, learnedIds, allWords);
    expect(thematic.length).toBeLessThanOrEqual(2);
    if (thematic.length > 0) {
      // Should prioritize words in crisis/conflict/isolation theme
      const thematicWords = thematic.map(t => t.word.toLowerCase());
      expect(thematicWords.some(w => ['conflict', 'isolation'].includes(w))).toBe(true);
    }
  });

  it('2. Progressive Question Morphing adapts question format across all 4 FSRS score tiers', () => {
    const allWords = vocabService.getAll(testUser);
    const target = allWords.find(w => w.id === '#001') || allWords[0];

    // Stage 1: Score 1.5 (Meaning & Lego roots)
    const q1 = expansionService.morphQuestionByScore(target, 1.5, [], allWords);
    expect(q1.morph_stage).toBe(1);
    expect(q1.badge).toContain('Gốc từ Lego');
    expect(q1.error_tag).toBe('[LỖI-PARAPHRASE]');
    expect(q1.options).toContain(target.meaning);

    // Stage 2: Score 3.5 (Collocation Cloze)
    const q2 = expansionService.morphQuestionByScore(target, 3.5, [], allWords);
    expect(q2.morph_stage).toBe(2);
    expect(q2.badge).toContain('Collocation');
    expect(q2.error_tag).toBe('[LỖI-COLLOCATION-CLASH]');

    // Stage 3: Score 5.2 (Derivative / Paraphrase)
    const q3 = expansionService.morphQuestionByScore(target, 5.2, [], allWords);
    expect(q3.morph_stage).toBe(3);
    expect(q3.badge).toMatch(/Họ từ|Paraphrase/);

    // Stage 4: Score 6.5 (Academic Nuance Trap)
    const q4 = expansionService.morphQuestionByScore(target, 6.5, [], allWords);
    expect(q4.morph_stage).toBe(4);
    expect(q4.badge).toContain('Sắc thái Nuance Trap');
    expect(q4.error_tag).toBe('[LỖI-SẮC-THÁI-HỌC-THUẬT]');
  });

  it('3. Sequentially links questions into continuous 3-question Chain Expansion series', () => {
    const round = synthesisService.getSynthesisRound(undefined, 6, testUser);
    expect(round).toHaveLength(6);

    // First chain (0, 1, 2)
    expect(round[0].chain_step).toBe(1);
    expect(round[0].chain_badge).toBe('Chuỗi Bậc Thang 1/3: Khởi Động');
    expect(round[1].chain_step).toBe(2);
    expect(round[1].chain_badge).toBe('Chuỗi Bậc Thang 2/3: Mở Rộng Liên Quan');
    expect(round[2].chain_step).toBe(3);
    expect(round[2].chain_badge).toBe('Chuỗi Bậc Thang 3/3: Hợp Nhất Band 7.5+');
    expect(round[0].chain_id).toBe(round[1].chain_id);
    expect(round[1].chain_id).toBe(round[2].chain_id);

    // Contextual continuity: Step 2 embeds Step 1's target word
    expect(round[1].embedded_word_ids).toContain(round[0].target_word_id);
    // Contextual continuity: Step 3 embeds both Step 1 and Step 2 target words
    expect(round[2].embedded_word_ids).toContain(round[0].target_word_id);
    expect(round[2].embedded_word_ids).toContain(round[1].target_word_id);

    // Second chain (3, 4, 5)
    expect(round[3].chain_step).toBe(1);
    expect(round[4].chain_step).toBe(2);
    expect(round[5].chain_step).toBe(3);
    expect(round[3].chain_id).not.toBe(round[0].chain_id);
  });

  it('4. Renders Word Web Mini-Card and highlights target word in Feedback Drawer', () => {
    const elements: Record<string, any> = {};

    function getElem(id: string) {
      if (!elements[id]) {
        elements[id] = {
          id, value: '', textContent: '', innerHTML: '', style: {},
          classList: { classes: new Set(), add() {}, remove() {}, contains() { return false; } },
          addEventListener() {}, appendChild() {}, closest() { return { style: {} }; }
        };
      }
      return elements[id];
    }

    const ctx: any = {
      window: {},
      document: { getElementById: getElem, createElement: () => ({ className: '', innerHTML: '', appendChild() {}, addEventListener() {} }) },
      localStorage: { getItem: () => testUser, setItem: () => {} },
      console, setTimeout, setInterval: () => 1, clearInterval: () => {}
    };
    ctx.window = ctx;
    ctx.window.localStore = { getWordScore: () => 1.0, setWordScore: () => {} };
    ctx.window.addEventListener = () => {};

    vm.createContext(ctx);
    const code = fs.readFileSync(path.resolve(rootDir, 'src/ui/js/quiz_blitz.js'), 'utf-8');
    vm.runInContext(code, ctx);

    const qb = ctx.quizBlitz;
    qb.questions = [{
      id: 'q_test_card',
      word_id: '#001',
      target_word: 'abandon',
      correct_index: 0,
      word_details: {
        collocation: 'abandon hope',
        paraphrase: 'desert / forsake',
        derivatives: 'abandon (v) ➔ abandonment (n)',
        embedded_words: [{ word: 'isolation', meaning: 'sự cô lập' }]
      }
    }];
    qb.currentIndex = 0;

    qb._showDrawer(true, 'Chính xác!', 'Giải thích', 'Scholars abandon obsolete dogmas.', 'Rigorous analysis dictates that researchers abandon superficial paradigms.');

    const expCard = elements['drawer-expansion-card'];
    const bCol = elements['drawer-branch-collocation'];
    const bPara = elements['drawer-branch-paraphrase'];
    const bDeriv = elements['drawer-branch-derivatives'];
    const embChips = elements['drawer-embedded-chips'];
    const u75 = elements['drawer-upgrade-75'];

    expect(expCard.style.display).toBe('block');
    expect(bCol.textContent).toBe('abandon hope');
    expect(bPara.textContent).toBe('desert / forsake');
    expect(bDeriv.textContent).toBe('abandon (v) ➔ abandonment (n)');
    expect(embChips.innerHTML).toContain('isolation');
    // Highlighting verification: target word 'abandon' must be highlighted in band 7.5
    expect(u75.innerHTML).toContain('<span class="highlight-target-word">abandon</span>');
  });

  it('5. Awards Ripple FSRS Bonus and generates direct differentiation question for Confused Pairs', async () => {
    // 5A: Ripple FSRS bonus
    db.prepare(`
      INSERT OR REPLACE INTO user_vocab_progress (user_id, word_id, current_score, stability, difficulty)
      VALUES (?, '#001', 3.0, 2.0, 3.0)
    `).run(testUser);

    const synthQ = synthesisService.synthesizeClozeQuestion(
      { id: '#002', word: 'abstract', pos: 'adj', meaning: 'trừu tượng' },
      new Set(['#001']),
      vocabService.getAll(testUser)
    );

    const submitRes = await app.inject({
      method: 'POST',
      url: '/api/quiz/submit',
      payload: {
        question_id: synthQ.id,
        selected_index: synthQ.correct_index,
        target_word_id: '#002',
        user_id: testUser,
        response_time_ms: 3200 // < 6000ms -> fast answer
      }
    });

    expect(submitRes.statusCode).toBe(200);
    const submitBody = JSON.parse(submitRes.body);
    expect(submitBody.data.is_correct).toBe(true);

    if (synthQ.embedded_word_ids.length > 0) {
      expect(submitBody.data.ripple_bonus_words.length).toBeGreaterThan(0);
      const updatedEmb = db.prepare('SELECT current_score, stability FROM user_vocab_progress WHERE word_id = ? AND user_id = ?').get('#001', testUser) as any;
      expect(updatedEmb.current_score).toBeGreaterThan(3.0);
      expect(updatedEmb.stability).toBeGreaterThan(2.0);
    }

    // 5B: Confused Pair Tracking on wrong answer with dictionary distractor
    const wrongIndex = (synthQ.correct_index + 1) % 4;
    const distractorText = synthQ.options[wrongIndex];

    const failRes = await app.inject({
      method: 'POST',
      url: '/api/quiz/submit',
      payload: {
        question_id: synthQ.id,
        selected_index: wrongIndex,
        target_word_id: '#002',
        user_id: testUser,
        response_time_ms: 7000
      }
    });

    expect(failRes.statusCode).toBe(200);

    const distractorRow = db.prepare('SELECT id FROM words WHERE LOWER(word) = LOWER(?)').get(distractorText) as any;
    if (distractorRow) {
      const confusedPairs = expansionService.getRecentConfusedPairs(testUser);
      const match = confusedPairs.find(cp => cp.target_word_id === '#002' && cp.confused_word_id === distractorRow.id);
      expect(match).toBeDefined();

      // In the next round, a direct differentiation question must be generated for this confused pair!
      const nextRound = synthesisService.getSynthesisRound(undefined, 5, testUser);
      const confusedQ = nextRound.find(q => q.badge === 'Phân biệt Cặp từ Dễ nhầm lẫn');
      expect(confusedQ).toBeDefined();
      expect(confusedQ?.options).toContain(distractorText);
      expect(confusedQ?.error_tag).toBe('[LỖI-CONFUSED-PAIR]');
      expect(confusedQ?.explanation).toContain('Phân biệt:');
    }
  });
});
