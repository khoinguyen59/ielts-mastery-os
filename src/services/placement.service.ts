import { getDatabase } from '../db/sqlite.js';
import { DiagnosticQuestion, LevelConfig, PlacementResult, PresetLevel } from '../types/placement.types.js';
import { vocabService } from './vocab.service.js';

export const LEVEL_PRESETS: Record<PresetLevel, LevelConfig> = {
  starter: {
    key: 'starter',
    title: 'Khởi Đầu / Mất Gốc (Target Band 3.0 - 4.0)',
    band: '3.5',
    description: 'Xây dựng ngữ âm IPA, 100 từ vựng sinh tồn A1-A2 cơ bản, phản xạ nghe - nói 5-10 từ/ngày.',
    startingScore: 1.0,
    starting_vocab_score: 1.0,
    recommended_daily: 8,
    fsrs_initial_stability: 0.5,
    fsrs_target_retention: 0.85
  },
  foundation: {
    key: 'foundation',
    title: 'Sơ Cấp / Nền Tảng (Target Band 4.5 - 5.0)',
    band: '5.0',
    description: 'Củng cố 150 từ vựng cốt lõi B1, ngữ pháp câu thông dụng.',
    startingScore: 1.5,
    starting_vocab_score: 1.5,
    recommended_daily: 10,
    fsrs_initial_stability: 1.0,
    fsrs_target_retention: 0.88
  },
  intermediate: {
    key: 'intermediate',
    title: 'Trung Cấp (Target Band 5.5 - 6.5)',
    band: '6.5',
    description: 'Mở rộng 300 từ AWL B2, Collocations mạnh, phân biệt sắc thái.',
    startingScore: 2.0,
    starting_vocab_score: 2.0,
    recommended_daily: 15,
    fsrs_initial_stability: 1.5,
    fsrs_target_retention: 0.90
  },
  advanced: {
    key: 'advanced',
    title: 'Nâng Cao (Target Band 7.0 - 7.5)',
    band: '7.5',
    description: 'Master 450 từ B2-C1, giải mã bẫy Linearthinking Cam 21.',
    startingScore: 3.0,
    starting_vocab_score: 3.0,
    recommended_daily: 20,
    fsrs_initial_stability: 2.5,
    fsrs_target_retention: 0.90
  },
  mastery: {
    key: 'mastery',
    title: 'Xuất Sắc (Target Band 8.0 - 8.5+)',
    band: '8.5',
    description: 'Tinh hoa C1–C2, tối ưu hóa phản xạ tự nhiên chuẩn bản xứ, kỹ xảo Task 2.',
    startingScore: 4.0,
    starting_vocab_score: 4.0,
    recommended_daily: 25,
    fsrs_initial_stability: 4.0,
    fsrs_target_retention: 0.92
  }
};

export class PlacementService {
  private db = getDatabase();

  public getLevelPresets(): Record<PresetLevel, LevelConfig> {
    return LEVEL_PRESETS;
  }

  public generateDiagnosticTest(count: number = 8): DiagnosticQuestion[] {
    const allWords = vocabService.getAll();
    if (allWords.length < 20) return [];

    const tiers = [
      { range: [0, 50], band: '3.5 - 4.0', focus: 'A2 Survival' },
      { range: [51, 150], band: '5.0 - 5.5', focus: 'B1/B2 Foundation' },
      { range: [151, 300], band: '6.5 - 7.5', focus: 'B2+/C1 Academic' },
      { range: [301, Math.min(450, allWords.length - 1)], band: '8.0 - 8.5+', focus: 'C1/C2 Mastery' }
    ];

    const questions: DiagnosticQuestion[] = [];
    const questionsPerTier = Math.max(1, Math.floor(count / tiers.length));

    for (let t = 0; t < tiers.length; t++) {
      const tier = tiers[t];
      const tierWords = allWords.slice(tier.range[0], tier.range[1]);
      for (let i = 0; i < questionsPerTier; i++) {
        const target = tierWords[(i * 7 + t) % tierWords.length];
        const distPool = allWords.filter(w => w.id !== target.id && w.word !== target.word);
        const dist1 = distPool[(i * 11 + t * 5) % distPool.length];
        const dist2 = distPool[(i * 17 + t * 7 + 1) % distPool.length];
        const dist3 = distPool[(i * 23 + t * 9 + 2) % distPool.length];

        const opts = [target.word, dist1.word, dist2.word, dist3.word];
        const correctIdx = (i + t) % 4;
        const temp = opts[0];
        opts[0] = opts[correctIdx];
        opts[correctIdx] = temp;

        const meaningExcerpt = target.meaning.split('(')[0].trim();
        questions.push({
          id: `diag_${t}_${i + 1}`,
          target_band: tier.band,
          prompt: `Thuật ngữ học thuật nào mang ý nghĩa '${meaningExcerpt}' và kết hợp chuẩn với '${target.key_collocation || target.collocations}'?`,
          options: opts,
          correct_index: correctIdx,
          explanation: `'${target.word}' (${target.pos}): ${target.meaning}.`,
          focus_area: tier.focus
        });
      }
    }
    return questions.slice(0, count);
  }

  public selectLevel(levelKey: PresetLevel, userId: string = 'default_user'): LevelConfig {
    const lvl = LEVEL_PRESETS[levelKey] || LEVEL_PRESETS.intermediate;
    try {
      this.db.prepare(`
        INSERT INTO user_stats (user_id, starting_band, target_band, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET starting_band = excluded.starting_band, target_band = excluded.target_band, updated_at = CURRENT_TIMESTAMP
      `).run(userId, lvl.band, lvl.band);
      this.db.prepare(`
        UPDATE users SET starting_band = ?, target_band = ?, onboarding_completed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(lvl.band, lvl.band, userId);
    } catch { /* Fallback */ }
    return lvl;
  }

  public evaluateTest(answers: Record<string, number>, userId: string = 'default_user'): PlacementResult {
    const testQuestions = this.generateDiagnosticTest(8);
    let correctCount = 0;
    for (const q of testQuestions) {
      if (answers[q.id] === q.correct_index) correctCount++;
    }

    const totalQ = testQuestions.length;
    const accuracy = totalQ > 0 ? correctCount / totalQ : 0;
    let estimatedBand = '3.5 - 4.0';
    let assignedLevel: PresetLevel = 'starter';
    let unlockedCheckpoints = 1;

    if (accuracy >= 0.85) {
      estimatedBand = '8.0 - 8.5'; assignedLevel = 'mastery'; unlockedCheckpoints = 4;
    } else if (accuracy >= 0.60) {
      estimatedBand = '7.0 - 7.5'; assignedLevel = 'advanced'; unlockedCheckpoints = 3;
    } else if (accuracy >= 0.35) {
      estimatedBand = '6.0 - 6.5'; assignedLevel = 'intermediate'; unlockedCheckpoints = 2;
    } else if (accuracy >= 0.20) {
      estimatedBand = '5.0 - 5.5'; assignedLevel = 'foundation'; unlockedCheckpoints = 1;
    }

    const preset = LEVEL_PRESETS[assignedLevel];
    try {
      this.db.prepare(`
        INSERT INTO user_stats (user_id, starting_band, target_band, xp, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET starting_band = excluded.starting_band, target_band = excluded.target_band, xp = user_stats.xp + excluded.xp, updated_at = CURRENT_TIMESTAMP
      `).run(userId, estimatedBand, preset.band, correctCount * 25);
      this.db.prepare(`
        UPDATE users SET starting_band = ?, target_band = ?, onboarding_completed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(estimatedBand, preset.band, userId);
    } catch { /* Fallback */ }

    const wordCounts: Record<PresetLevel, number> = { starter: 100, foundation: 150, intermediate: 300, advanced: 450, mastery: 450 };
    return {
      total_questions: totalQ,
      correct_answers: correctCount,
      accuracy: Number(accuracy.toFixed(2)),
      estimated_band: estimatedBand,
      assigned_level_key: assignedLevel,
      initial_word_count: wordCounts[assignedLevel],
      unlocked_checkpoints: unlockedCheckpoints,
      target_band: preset.band,
      fsrs_params: { stability: preset.fsrs_initial_stability, target_retention: preset.fsrs_target_retention },
      feedback: `Độ chính xác ${Math.round(accuracy * 100)}%, phù hợp với lộ trình ${preset.title}. FSRS Stability: ${preset.fsrs_initial_stability}.`
    };
  }
}

export const placementService = new PlacementService();
