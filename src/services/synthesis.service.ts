import { getDatabase } from '../db/sqlite.js';
import { QuestionDTO } from '../types/question.types.js';
import { vocabService } from './vocab.service.js';
import { fsrsService } from './fsrs.service.js';
import { aiBridgeService } from './ai-bridge.service.js';

export class SynthesisService {
  private db = getDatabase();

  public getSynthesisRound(
    targetWordId?: string,
    count: number = 5,
    userId: string = 'default_user',
    levelKey: string = 'intermediate'
  ): QuestionDTO[] {
    const startTime = performance.now();
    const learnedIds = new Set(fsrsService.getLearnedWordIds(2.0));
    const allWords = vocabService.getAll();
    const levelWords = vocabService.getByLevel(levelKey);
    const targetPool = levelWords.length > 0 ? levelWords : allWords;
    const questions: QuestionDTO[] = [];

    // Query recent weak words (mistakes & 'cần học' ratings) for real-time adaptation
    let recentWeakWords: any[] = [];
    try {
      const weakRows = this.db.prepare(`
        SELECT word_id FROM user_vocab_progress
        WHERE current_score < 3.0 OR lapses > 0
        ORDER BY updated_at DESC, current_score ASC
        LIMIT ?
      `).all(count) as any[];
      for (const row of weakRows) {
        const w = vocabService.getById(row.word_id);
        if (w) recentWeakWords.push(w);
      }
    } catch {
      recentWeakWords = [];
    }

    // Determine target words with priority: (1) targetWordId, (2) recent weak words, (3) due words in level, (4) level pool
    let targetWords: any[] = [];
    if (targetWordId) {
      const specifiedWord = vocabService.getById(targetWordId);
      if (specifiedWord) targetWords.push(specifiedWord);
    }

    // Inject recent mistakes into the next round
    for (const weak of recentWeakWords) {
      if (!targetWords.some(t => t.id === weak.id)) targetWords.push(weak);
      if (targetWords.length >= count) break;
    }

    if (targetWords.length < count) {
      const fillers = vocabService.getDueWords(count);
      for (const f of fillers) {
        if (!targetWords.some(t => t.id === f.id)) targetWords.push(f);
        if (targetWords.length >= count) break;
      }
    }

    if (targetWords.length < count) {
      for (const w of targetPool) {
        if (!targetWords.some(t => t.id === w.id)) targetWords.push(w);
        if (targetWords.length >= count) break;
      }
    }

    for (const tw of targetWords) {
      if (!tw) continue;
      // 1. Try finding pre-seeded or verified question in SQLite
      const existing = this.findMatchingQuestion(tw.id, learnedIds);
      if (existing) {
        questions.push(existing);
      } else {
        // 2. Fallback: Deterministic Cloze Synthesizer (< 0.2ms)
        const synthesized = this.synthesizeClozeQuestion(tw, learnedIds, allWords);
        questions.push(synthesized);
      }

      if (questions.length >= count) break;
    }

    const duration = performance.now() - startTime;
    if (process.env.NODE_ENV !== 'production' && duration > 50) {
      console.warn(`[SynthesisService] Round generated in ${duration.toFixed(2)}ms`);
    }

    return questions;
  }

  public findMatchingQuestion(targetWordId: string, learnedIds: Set<string>): QuestionDTO | null {
    const candidates = this.db.prepare(`
      SELECT * FROM questions
      WHERE target_word_id = ? AND status = 'active'
      ORDER BY 
        CASE 
          WHEN quality_tags LIKE '%admin_verified%' THEN 3
          WHEN quality_tags LIKE '%v2_approved%' THEN 2
          WHEN quality_tags LIKE '%v1_approved%' THEN 1
          ELSE 0
        END DESC, created_at DESC
      LIMIT 10
    `).all(targetWordId) as any[];

    if (!candidates || candidates.length === 0) return null;

    // In-memory set intersection check (< 0.1ms)
    for (const c of candidates) {
      let embedded: string[] = [];
      try {
        embedded = JSON.parse(c.embedded_word_ids || '[]');
      } catch {
        embedded = [];
      }

      // If at least 1 embedded word is in learned pool, or learned pool is empty (cold start)
      const hasLearnedOverlap = embedded.length === 0 || embedded.some(id => learnedIds.has(id)) || learnedIds.size === 0;
      if (hasLearnedOverlap) {
        return this.mapRowToQuestion(c);
      }
    }

    return this.mapRowToQuestion(candidates[0]);
  }

  public synthesizeClozeQuestion(target: any, learnedIds: Set<string>, allWords: any[]): QuestionDTO {
    const learnedWords = allWords.filter(w => learnedIds.has(w.id) && w.id !== target.id);
    const chosenLearned = learnedWords.slice(0, 2);

    const baseExample = target.example || `Scholars have observed that measures to apply ${target.word} remain vital.`;
    const regex = new RegExp(`\\b${target.word}\\b`, 'gi');
    let masked = baseExample.replace(regex, '_______');

    if (!masked.includes('_______')) {
      masked = `Academic researchers emphasize that institutions must _______ ${target.word} principles thoroughly.`;
    }

    if (chosenLearned.length > 0) {
      const contextPrefix = `In an effort to promote ${chosenLearned[0].word}, `;
      masked = `${contextPrefix}${masked.charAt(0).toLowerCase() + masked.slice(1)}`;
    }

    // Distractors: shuffle candidates using Fisher-Yates before slicing
    const candidateDistractors = allWords.filter(
      w => w.id !== target.id && (w.pos === target.pos || !w.pos)
    );
    for (let i = candidateDistractors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidateDistractors[i], candidateDistractors[j]] = [candidateDistractors[j], candidateDistractors[i]];
    }
    const distractors = candidateDistractors.slice(0, 3);

    // Fallback if less than 3 distractors of same POS
    if (distractors.length < 3) {
      const fallbackPool = allWords.filter(
        w => w.id !== target.id && !distractors.some(d => d.id === w.id)
      );
      for (let i = fallbackPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fallbackPool[i], fallbackPool[j]] = [fallbackPool[j], fallbackPool[i]];
      }
      distractors.push(...fallbackPool.slice(0, 3 - distractors.length));
    }

    const options = [target.word, ...distractors.map(d => d.word)];
    const correctIdx = Math.floor(Math.random() * 4);
    // Swap target.word to correctIdx
    options[0] = options[correctIdx];
    options[correctIdx] = target.word;

    // Pre-validation: ensure 4 unique options and valid index
    const uniqueOptions = new Set(options.map(o => (o || '').trim().toLowerCase()));
    const isStructureValid = options.length === 4 && uniqueOptions.size === 4 && correctIdx >= 0 && correctIdx <= 3;
    const initialStatus: 'active' | 'rejected' = isStructureValid ? 'active' : 'rejected';

    const errorTags = ['[LỖI-COLLOCATION-CLASH]', '[LỖI-SẮC-THÁI-HỌC-THUẬT]', '[LỖI-PARAPHRASE]'];
    const errorTag = errorTags[Math.floor(Math.random() * errorTags.length)];

    const newQ: QuestionDTO = {
      id: `synth_${target.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      target_word_id: target.id,
      target_word: target.word,
      embedded_word_ids: chosenLearned.map(w => w.id),
      prompt: 'Select the most academically appropriate word to complete the sentence:',
      masked_sentence: masked,
      options,
      correct_index: correctIdx,
      explanation: `'${target.word}' (${target.pos}) có nghĩa là: ${target.meaning}.`,
      error_tag: errorTag,
      band_75_upgrade: `Furthermore, policymakers should actively ${target.word} key protocols to safeguard outcomes.`,
      band_85_upgrade: `Consequently, it is imperative to rigorously ${target.word} structural systemic frameworks.`,
      status: initialStatus,
      quality_tags: ['deterministic_cloze', 'offline_fallback']
    };

    // Persist synthesized question to SQLite if not corrupted
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO questions (id, target_word_id, embedded_word_ids, prompt, masked_sentence, options, correct_index, explanation, error_tag, band_75_upgrade, band_85_upgrade, status, quality_tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newQ.id,
        newQ.target_word_id,
        JSON.stringify(newQ.embedded_word_ids),
        newQ.prompt,
        newQ.masked_sentence,
        JSON.stringify(newQ.options),
        newQ.correct_index,
        newQ.explanation,
        newQ.error_tag,
        newQ.band_75_upgrade,
        newQ.band_85_upgrade,
        newQ.status,
        JSON.stringify(newQ.quality_tags)
      );
    } catch {
      // Non-blocking in read-only environments
    }

    // Pre-validation call to AI Bridge (async, non-blocking to keep getSynthesisRound < 100ms)
    aiBridgeService.validateQuestion(
      {
        prompt: newQ.prompt,
        options: newQ.options,
        correct_index: newQ.correct_index
      },
      'ai_v1'
    ).then(valResult => {
      if (!valResult.valid && newQ.status === 'active') {
        try {
          this.db.prepare("UPDATE questions SET status = 'under_review_v1' WHERE id = ?").run(newQ.id);
        } catch {}
      }
    }).catch(() => {});

    return newQ;
  }

  private mapRowToQuestion(row: any): QuestionDTO {
    let embedded: string[] = [];
    let options: string[] = [];
    let qualityTags: string[] = [];

    try {
      embedded = JSON.parse(row.embedded_word_ids || '[]');
    } catch {
      embedded = [];
    }

    try {
      options = JSON.parse(row.options || '[]');
    } catch {
      options = [];
    }

    try {
      qualityTags = JSON.parse(row.quality_tags || '[]');
    } catch {
      qualityTags = [];
    }

    return {
      id: row.id,
      target_word_id: row.target_word_id,
      embedded_word_ids: embedded,
      prompt: row.prompt,
      masked_sentence: row.masked_sentence || undefined,
      options,
      correct_index: row.correct_index,
      explanation: row.explanation || '',
      error_tag: row.error_tag || undefined,
      band_75_upgrade: row.band_75_upgrade || undefined,
      band_85_upgrade: row.band_85_upgrade || undefined,
      status: row.status,
      quality_tags: qualityTags,
      created_at: row.created_at
    };
  }
}

export const synthesisService = new SynthesisService();
