import { getDatabase } from '../db/sqlite.js';
import { QuestionDTO } from '../types/question.types.js';
import { vocabService } from './vocab.service.js';
import { fsrsService } from './fsrs.service.js';
import { expansionService } from './expansion.service.js';

export class SynthesisService {
  private db = getDatabase();

  public getSynthesisRound(
    targetWordId?: string,
    count: number = 5,
    userId: string = 'default_user',
    levelKey: string = 'intermediate'
  ): QuestionDTO[] {
    const startTime = performance.now();
    // Rule i + 1: Learned background words must have memory score >= 3.0
    const learnedIds = new Set(fsrsService.getLearnedWordIds(3.0, userId));
    const allWords = vocabService.getAll(userId);
    const levelWords = vocabService.getByLevel(levelKey, userId);
    const targetPool = levelWords.length > 0 ? levelWords : allWords;
    const wordsMap = new Map(allWords.map(w => [w.id, w]));
    const questions: QuestionDTO[] = [];

    // Query confused word pairs for remediation
    const confusedPairs = expansionService.getRecentConfusedPairs(userId, Math.min(3, count));
    for (const cp of confusedPairs) {
      if (questions.length >= count) break;
      const tw = vocabService.getById(cp.target_word_id, userId);
      const cw = vocabService.getById(cp.confused_word_id, userId);
      if (tw && cw) {
        const cq = expansionService.buildConfusedPairQuestion(tw, cw, allWords);
        this.persistQuestion(cq);
        questions.push(cq);
      }
    }

    // Step 3: Chain Expansion for remaining slots if count >= 3
    const remainingCount = count - questions.length;
    if (remainingCount >= 3) {
      const numChains = Math.floor(remainingCount / 3);
      for (let c = 0; c < numChains; c++) {
        let chainTarget = targetWordId ? vocabService.getById(targetWordId, userId) : null;
        if (!chainTarget) {
          const dueList = vocabService.getDueWords(10, userId);
          chainTarget = dueList.find(d => !questions.some(q => q.target_word_id === d.id)) || null;
        }
        if (!chainTarget) {
          chainTarget = targetPool.find(p => !questions.some(q => q.target_word_id === p.id)) || allWords[0];
        }

        if (chainTarget) {
          const thematicCandidates = expansionService.getThematicLearnedWords(chainTarget, new Set(allWords.map(w => w.id)), allWords);
          const wB = thematicCandidates[0] || allWords.find(w => w.id !== chainTarget!.id) || allWords[1];
          const wC = thematicCandidates[1] || allWords.find(w => w.id !== chainTarget!.id && w.id !== wB.id) || allWords[2];

          const chainQs = expansionService.buildChainQuestions([chainTarget, wB, wC], c + 1, allWords);
          for (const q of chainQs) {
            this.persistQuestion(q);
            questions.push(q);
            if (questions.length >= count) break;
          }
        }
      }
    }

    // Fill any remaining questions with adaptive morphing / verified questions
    if (questions.length < count) {
      const candidates = [...targetPool, ...allWords];
      for (const tw of candidates) {
        if (questions.some(q => q.target_word_id === tw.id)) continue;

        const existing = this.findMatchingQuestion(tw.id, learnedIds);
        if (existing) {
          if (!existing.word_details) {
            existing.word_details = expansionService.buildWordWebDetails(tw, existing.embedded_word_ids || [], wordsMap);
          }
          questions.push(existing);
        } else {
          const curScore = tw.score !== undefined ? tw.score : 1.0;
          const chosenLearned = expansionService.getThematicLearnedWords(tw, learnedIds, allWords);
          const morphed = expansionService.morphQuestionByScore(tw, curScore, chosenLearned, allWords);
          this.persistQuestion(morphed);
          questions.push(morphed);
        }

        if (questions.length >= count) break;
      }
    }

    const duration = performance.now() - startTime;
    if (process.env.NODE_ENV !== 'production' && duration > 50) {
      console.warn(`[SynthesisService] Round generated in ${duration.toFixed(2)}ms`);
    }

    return questions.slice(0, count);
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

    let bestMatch: any = null;
    let bestMatchScore = -1;

    for (const c of candidates) {
      let embedded: string[] = [];
      try {
        embedded = JSON.parse(c.embedded_word_ids || '[]');
      } catch {
        embedded = [];
      }

      // Strict Comprehensible Input i + 1:
      // Maximum 2 embedded background words, and 0 unlearned words
      if (embedded.length > 2) continue;
      if (embedded.some(id => !learnedIds.has(id))) continue;

      if (embedded.length === 0) {
        if (bestMatchScore < 0) {
          bestMatch = c;
          bestMatchScore = 0;
        }
        continue;
      }

      // Valid match with known background words
      const coverage = embedded.length / 2;
      if (coverage > bestMatchScore) {
        bestMatch = c;
        bestMatchScore = coverage;
      }
    }

    return bestMatch ? this.mapRowToQuestion(bestMatch) : null;
  }

  public synthesizeClozeQuestion(target: any, learnedIds: Set<string>, allWords: any[]): QuestionDTO {
    // Thematic clustering for learned background words (Golden ratio: 1-2 words)
    const chosenLearned = expansionService.getThematicLearnedWords(target, learnedIds, allWords);

    const baseExample = target.example || `Scholars have observed that measures to apply ${target.word} remain vital.`;
    const regex = new RegExp(`\\b${target.word}\\b`, 'gi');
    let masked = baseExample.replace(regex, '_______');

    if (!masked.includes('_______')) {
      masked = `Academic researchers emphasize that institutions must _______ ${target.word} principles thoroughly.`;
    }

    if (chosenLearned.length > 0) {
      const prefixes = [
        `Given recent findings concerning ${chosenLearned[0].word}, `,
        `In relation to structural changes in ${chosenLearned[0].word}, `,
        `While addressing the broader impact of ${chosenLearned[0].word}, `,
        `Building on established theories of ${chosenLearned[0].word}, `
      ];
      const contextPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      masked = `${contextPrefix}${masked.charAt(0).toLowerCase() + masked.slice(1)}`;
    }

    // Distractors
    const candidateDistractors = allWords.filter(
      w => w.id !== target.id && (w.pos === target.pos || !w.pos)
    );
    for (let i = candidateDistractors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidateDistractors[i], candidateDistractors[j]] = [candidateDistractors[j], candidateDistractors[i]];
    }
    const distractors = candidateDistractors.slice(0, 3);

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
    options[0] = options[correctIdx];
    options[correctIdx] = target.word;

    const uniqueOptions = new Set(options.map(o => (o || '').trim().toLowerCase()));
    const isStructureValid = options.length === 4 && uniqueOptions.size === 4 && correctIdx >= 0 && correctIdx <= 3;
    const initialStatus: 'active' | 'rejected' = isStructureValid ? 'active' : 'rejected';

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
      error_tag: '[LỖI-COLLOCATION-CLASH]',
      badge: 'Bậc 2: Cụm Collocation Cố định',
      morph_stage: 2,
      band_75_upgrade: `Furthermore, policymakers should actively ${target.word} key protocols to safeguard outcomes.`,
      band_85_upgrade: `Consequently, it is imperative to rigorously ${target.word} structural systemic frameworks.`,
      status: initialStatus,
      quality_tags: isStructureValid ? ['deterministic_cloze', 'v1_approved'] : ['under_review_v1'],
      word_details: expansionService.buildWordWebDetails(target, chosenLearned.map(w => w.id), new Map(allWords.map(w => [w.id, w])))
    };

    this.persistQuestion(newQ);
    return newQ;
  }

  public persistQuestion(q: QuestionDTO): void {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO questions (id, target_word_id, embedded_word_ids, prompt, masked_sentence, options, correct_index, explanation, error_tag, band_75_upgrade, band_85_upgrade, status, quality_tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        q.id,
        q.target_word_id,
        JSON.stringify(q.embedded_word_ids),
        q.prompt,
        q.masked_sentence || '',
        JSON.stringify(q.options),
        q.correct_index,
        q.explanation,
        q.error_tag || null,
        q.band_75_upgrade || null,
        q.band_85_upgrade || null,
        q.status,
        JSON.stringify(q.quality_tags)
      );
    } catch {}
  }

  private mapRowToQuestion(row: any): QuestionDTO {
    let embedded: string[] = [];
    let options: string[] = [];
    let qualityTags: string[] = [];

    try { embedded = JSON.parse(row.embedded_word_ids || '[]'); } catch { embedded = []; }
    try { options = JSON.parse(row.options || '[]'); } catch { options = []; }
    try { qualityTags = JSON.parse(row.quality_tags || '[]'); } catch { qualityTags = []; }

    const targetRow = this.db.prepare('SELECT word FROM words WHERE id = ?').get(row.target_word_id) as { word: string } | undefined;

    return {
      id: row.id,
      target_word_id: row.target_word_id,
      target_word: targetRow ? targetRow.word : undefined,
      embedded_word_ids: embedded,
      prompt: row.prompt,
      masked_sentence: row.masked_sentence || undefined,
      options,
      correct_index: row.correct_index,
      explanation: row.explanation || '',
      error_tag: row.error_tag || undefined,
      badge: row.badge || 'Bậc 2: Cụm Collocation Cố định',
      band_75_upgrade: row.band_75_upgrade || undefined,
      band_85_upgrade: row.band_85_upgrade || undefined,
      status: row.status,
      quality_tags: qualityTags,
      created_at: row.created_at
    };
  }
}

export const synthesisService = new SynthesisService();
