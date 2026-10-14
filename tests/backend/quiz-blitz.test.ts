import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('R6: Quiz Blitz Logic, Score Ratio & Dispute Reporting Modal', () => {
  let app: FastifyInstance;
  const rootDir = process.cwd();

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  function createMockQuizContext() {
    const elements: Record<string, any> = {};
    const eventListeners: Record<string, Function[]> = {};

    function getElem(id: string) {
      if (!elements[id]) {
        elements[id] = {
          id,
          value: '',
          textContent: '',
          innerHTML: '',
          style: {},
          classList: {
            classes: new Set<string>(),
            add(cls: string) { this.classes.add(cls); },
            remove(cls: string) { this.classes.delete(cls); },
            contains(cls: string) { return this.classes.has(cls); }
          },
          listeners: {} as Record<string, Function>,
          addEventListener(evt: string, cb: Function) {
            this.listeners[evt] = cb;
          },
          appendChild(child: any) {},
          closest(sel: string) {
            return { style: {} };
          }
        };
      }
      return elements[id];
    }

    const fetchedCalls: { url: string; options: any }[] = [];

    const ctx: any = {
      window: {},
      document: {
        getElementById: getElem,
        createElement: (tag: string) => ({
          tagName: tag.toUpperCase(),
          className: '',
          id: '',
          innerHTML: '',
          classList: { add: () => {}, remove: () => {} },
          addEventListener: () => {},
          appendChild: () => {}
        }),
        addEventListener: (evt: string, cb: Function) => {
          if (!eventListeners[evt]) eventListeners[evt] = [];
          eventListeners[evt].push(cb);
        }
      },
      localStorage: {
        store: { 'ielts_os_user_id': 'test_r6_user' } as Record<string, string>,
        getItem(key: string) { return this.store[key] || null; },
        setItem(key: string, val: string) { this.store[key] = val; }
      },
      console,
      setTimeout,
      setInterval: () => 123,
      clearInterval: () => {},
      fetch: async (url: string, opts: any) => {
        fetchedCalls.push({ url, options: opts });
        return {
          ok: true,
          json: async () => ({ success: true, message: 'Báo lỗi đã được tiếp nhận thành công!' })
        };
      }
    };

    ctx.window = ctx;
    ctx.window.localStore = {
      getWordScore: () => 1.0,
      setWordScore: () => {}
    };
    ctx.window.addEventListener = (evt: string, cb: Function) => {
      if (!eventListeners[evt]) eventListeners[evt] = [];
      eventListeners[evt].push(cb);
    };

    vm.createContext(ctx);
    const code = fs.readFileSync(path.resolve(rootDir, 'src/ui/js/quiz_blitz.js'), 'utf-8');
    vm.runInContext(code, ctx);

    return { ctx, elements, eventListeners, fetchedCalls };
  }

  it('verifies initialTotalQuestions preserves score ratio (10 / 10 instead of 10 / 2)', () => {
    const { ctx, elements } = createMockQuizContext();
    const qb = ctx.quizBlitz;

    qb.initialTotalQuestions = 10;
    qb.questions = [
      { id: 'q_review_1', prompt: 'Rev 1', options: ['A', 'B'], correct_index: 0, word_id: 'w1' },
      { id: 'q_review_2', prompt: 'Rev 2', options: ['A', 'B'], correct_index: 1, word_id: 'w2' }
    ];
    qb.correctCount = 10;
    qb.bestStreakInRound = 6;

    qb.showRoundSummary();

    const scoreDisplay = elements['quiz-summary-score'];
    expect(scoreDisplay.textContent).toBe('10 / 10');
  });

  it('verifies renderQuestion defines all DOM elements and assigns Điền từ học thuật badge', () => {
    const { ctx, elements } = createMockQuizContext();
    const qb = ctx.quizBlitz;

    qb.questions = [{
      id: 'q1',
      badge: 'Anh -> Việt',
      prompt: 'Complete the sentence with an academic word',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correct_index: 0,
      word_id: 'w1'
    }];
    qb.currentIndex = 0;

    expect(() => qb.renderQuestion()).not.toThrow();

    const badgeElem = elements['quiz-type-badge'];
    expect(badgeElem.textContent).toBe('Điền từ học thuật');
  });

  it('verifies backend /api/practice/quiz supplies upgrade samples and quizBlitz maps to Điền từ học thuật', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/practice/quiz?count=2'
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.questions).toBeDefined();
    if (body.questions.length > 0) {
      expect(typeof body.questions[0].band_75_upgrade).toBe('string');
      expect(typeof body.questions[0].band_85_upgrade).toBe('string');

      // Test that QuizBlitz renders this with the accurate context label
      const { ctx, elements } = createMockQuizContext();
      ctx.quizBlitz.questions = [body.questions[0]];
      ctx.quizBlitz.currentIndex = 0;
      ctx.quizBlitz.renderQuestion();
      expect(elements['quiz-type-badge'].textContent).toBe('Điền từ học thuật');
    }
  });

  it('verifies user_id is forwarded when submitting quiz answers', async () => {
    const { ctx, fetchedCalls } = createMockQuizContext();
    const qb = ctx.quizBlitz;

    qb.questions = [{
      id: 'q_sub_1',
      correct_index: 1,
      word_id: 'w_sub_1',
      explanation: 'Explanation test',
      band_75_upgrade: 'Sample Band 7.5',
      band_85_upgrade: 'Sample Band 8.5'
    }];
    qb.currentIndex = 0;

    qb.handleAnswer(1);

    const submitCall = fetchedCalls.find(c => c.url === '/api/quiz/submit');
    expect(submitCall).toBeDefined();
    const payload = JSON.parse(submitCall!.options.body);
    expect(payload.user_id).toBe('test_r6_user');
    expect(payload.question_id).toBe('q_sub_1');
    expect(payload.selected_index).toBe(1);
  });

  it('verifies drawer shows Band 7.5+ and Band 8.5+ sentence upgrades', () => {
    const { ctx, elements } = createMockQuizContext();
    const qb = ctx.quizBlitz;

    qb.questions = [{ id: 'q1' }];
    qb.currentIndex = 0;

    qb._showDrawer(true, 'Chính xác!', 'Giải thích', 'Advanced band 7.5 sentence', 'Master band 8.5 sentence');

    const u75 = elements['drawer-upgrade-75'];
    const u85 = elements['drawer-upgrade-85'];
    const upgradesContainer = elements['drawer-upgrades'];

    expect(upgradesContainer.style.display).toBe('flex');
    expect(u75.textContent).toBe('Advanced band 7.5 sentence');
    expect(u85.textContent).toBe('Master band 8.5 sentence');
  });

  it('verifies question dispute report submission to /api/feedback/submit', async () => {
    const { ctx, elements, fetchedCalls } = createMockQuizContext();
    const qb = ctx.quizBlitz;

    qb.questions = [{ id: 'q_reported_1' }];
    qb.currentIndex = 0;
    qb.currentReportQuestionId = 'q_reported_1';

    qb.openReportModal();
    const modal = elements['quiz-report-modal'];
    expect(modal.style.display).toBe('flex');

    const reasonSelect = elements['report-reason-select'];
    const detailsInput = elements['report-details-input'];
    reasonSelect.value = 'wrong_collocation';
    detailsInput.value = 'Inappropriate academic collocation';

    await qb.submitQuestionReport();

    const reportCall = fetchedCalls.find(c => c.url === '/api/feedback/submit');
    expect(reportCall).toBeDefined();
    const payload = JSON.parse(reportCall!.options.body);
    expect(payload.question_id).toBe('q_reported_1');
    expect(payload.user_id).toBe('test_r6_user');
    expect(payload.reason).toBe('wrong_collocation');
    expect(payload.details).toBe('Inappropriate academic collocation');
  });

  it('verifies keydown does not advance questions when typing in inputs or when modal is open', () => {
    const { ctx, elements, eventListeners } = createMockQuizContext();
    const qb = ctx.quizBlitz;

    qb.isAnswered = true;
    let nextCalled = false;
    qb.nextQuestion = () => { nextCalled = true; };

    // Simulate open report modal
    ctx.document.getElementById('quiz-report-modal').style.display = 'flex';
    ctx.document.getElementById('quiz-active-arena').style.display = 'block';

    const keydownCbs = eventListeners['keydown'] || [];
    expect(keydownCbs.length).toBeGreaterThan(0);

    // Press Space inside modal
    let defaultPrevented = false;
    keydownCbs[0]({
      key: ' ',
      code: 'Space',
      target: { tagName: 'TEXTAREA' },
      preventDefault: () => { defaultPrevented = true; }
    });

    expect(nextCalled).toBe(false);
    expect(defaultPrevented).toBe(false);
  });
});
