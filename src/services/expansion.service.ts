import { getDatabase } from '../db/sqlite.js';
import { VocabWord } from '../types/vocab.types.js';
import { QuestionDTO } from '../types/question.types.js';

function cleanStr(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(', ');
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

function parseJson<T>(v: any, fallback: T): T {
  if (!v) return fallback;
  if (typeof v === 'object') return v as T;
  try { return JSON.parse(v); } catch { return fallback; }
}

const THEMES: string[][] = [
  ['fund', 'finance', 'promote', 'contemporary', 'bulk', 'establish', 'community', 'heritage', 'art'],
  ['adequate', 'approach', 'aware', 'benefit', 'detract', 'ensure', 'environment', 'excessive', 'external', 'internal', 'investigate', 'legislation', 'mode', 'modify', 'multitude', 'silence'],
  ['conflict', 'display', 'isolation', 'alleviate', 'crisis', 'humanitarian', 'cohesion'],
  ['period', 'innovation', 'benefit', 'initial', 'sustainable', 'ecological', 'technological'],
  ['empirical', 'hypothesis', 'methodology', 'paradigm', 'substantiate', 'systemic', 'synthesize', 'undermine', 'proliferate']
];

export class ExpansionService {
  private db = getDatabase();

  public getThematicLearnedWords(target: VocabWord, learnedIds: Set<string>, allWords: VocabWord[]): VocabWord[] {
    const candidates = allWords.filter(w => learnedIds.has(w.id) && w.id !== target.id);
    if (candidates.length === 0) return [];

    const tWord = cleanStr(target.word).toLowerCase();
    const targetSyn = cleanStr(target.synonym).toLowerCase();
    const targetAnt = cleanStr(target.antonym).toLowerCase();
    const targetCol = cleanStr(target.collocations || target.key_collocation).toLowerCase();
    const targetCluster = THEMES.find(c => c.some(w => tWord.includes(w) || w.includes(tWord)));

    const scored = candidates.map(c => {
      let score = 0;
      const cWord = cleanStr(c.word).toLowerCase();
      if (targetCluster && targetCluster.some(w => cWord.includes(w) || w.includes(cWord))) score += 15;
      if (targetSyn.includes(cWord)) score += 10;
      if (targetAnt.includes(cWord)) score += 8;
      if (targetCol.includes(cWord)) score += 6;
      if (c.pos === target.pos) score += 2;
      return { word: c, score };
    });

    scored.sort((a, b) => b.score - a.score || (b.word.score || 0) - (a.word.score || 0));
    return scored.slice(0, Math.min(2, scored.length)).map(s => s.word);
  }

  public morphQuestionByScore(target: VocabWord, currentScore: number, chosenLearned: VocabWord[], allWords: VocabWord[]): QuestionDTO {
    const id = `morph_${target.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const embeddedIds = chosenLearned.slice(0, 2).map(w => w.id);
    const wordDetails = this.buildWordWebDetails(target, embeddedIds, new Map(allWords.map(w => [w.id, w])));

    if (currentScore < 2.5) return this.buildStage1(id, target, embeddedIds, allWords, wordDetails);
    if (currentScore < 4.5) return this.buildStage2(id, target, chosenLearned, allWords, wordDetails);
    if (currentScore < 6.0) return this.buildStage3(id, target, chosenLearned, allWords, wordDetails);
    return this.buildStage4(id, target, chosenLearned, allWords, wordDetails);
  }

  private shuffleOptions(correct: string, pool: string[]): { options: string[]; correctIdx: number } {
    const distractors = pool.filter(p => p && p.toLowerCase() !== correct.toLowerCase()).slice(0, 3);
    while (distractors.length < 3) distractors.push(`dist_${Math.random().toString(36).substring(2, 5)}`);
    const options = [correct, ...distractors];
    const correctIdx = Math.floor(Math.random() * 4);
    options[0] = options[correctIdx]; options[correctIdx] = correct;
    return { options, correctIdx };
  }

  private buildStage1(id: string, target: VocabWord, embeddedIds: string[], allWords: VocabWord[], details: any): QuestionDTO {
    const rootsObj = parseJson<any>(target.lego_roots, {});
    const roots = rootsObj?.roots || cleanStr(target.lego_roots);
    const hasRoots = Boolean(roots && roots.trim() && roots !== '{}');
    const prompt = hasRoots
      ? `Xác định nghĩa cốt lõi của từ "${target.word}" (${target.pos}) qua phân tích gốc từ Lego [${roots}]:`
      : `Xác định nghĩa học thuật tiếng Việt chuẩn xác của từ vựng "${target.word}" (${target.pos}):`;

    const pool = allWords.filter(w => w.id !== target.id).sort(() => Math.random() - 0.5).map(w => cleanStr(w.meaning));
    const { options, correctIdx } = this.shuffleOptions(cleanStr(target.meaning), pool);

    return {
      id, target_word_id: target.id, target_word: target.word, embedded_word_ids: embeddedIds,
      prompt, masked_sentence: `Thuật ngữ học thuật: "${target.word}" (${target.pos}) ➔ Ý nghĩa: _______`,
      options, correct_index: correctIdx,
      explanation: `'${target.word}' (${target.pos}) có nghĩa là: ${target.meaning}.${hasRoots ? ` Gốc từ Lego: ${roots}.` : ''}`,
      error_tag: '[LỖI-PARAPHRASE]', badge: 'Bậc 1: Gốc từ Lego & Nghĩa cốt lõi', morph_stage: 1,
      band_75_upgrade: `Scholars frequently apply "${target.word}" to contextualize fundamental phenomena.`,
      band_85_upgrade: `Rigorous academic discourse mandates the precise usage of "${target.word}" to elucidate systemic structures.`,
      status: 'active', quality_tags: ['progressive_morphing', 'stage_1_lego'], word_details: details
    };
  }

  private buildStage2(id: string, target: VocabWord, chosen: VocabWord[], allWords: VocabWord[], details: any): QuestionDTO {
    const colStr = cleanStr(target.key_collocation || target.collocations);
    let rawCol = colStr.split(',')[0]?.replace(/\(.*?\)/g, '').trim() || `${target.word} structural standards`;
    if (!rawCol.toLowerCase().includes(target.word.toLowerCase())) rawCol = `${target.word} framework`;

    const colMasked = rawCol.replace(new RegExp(`\\b${target.word}\\b`, 'gi'), '_______');
    const prefix = chosen.length > 0 ? `In connection with ${chosen[0].word}, ` : 'In academic research, ';
    const sentence = `${prefix}scholars must ${colMasked.toLowerCase().startsWith('_______') ? colMasked : `maintain ${colMasked}`}.`;

    const pool = allWords.filter(w => w.id !== target.id && (w.pos === target.pos || !w.pos)).sort(() => Math.random() - 0.5).map(w => w.word);
    const { options, correctIdx } = this.shuffleOptions(target.word, pool);

    return {
      id, target_word_id: target.id, target_word: target.word, embedded_word_ids: chosen.map(w => w.id),
      prompt: 'Chọn từ học thuật chính xác để hoàn thành cụm Collocation cố định:',
      masked_sentence: sentence, options, correct_index: correctIdx,
      explanation: `Cụm Collocation chuẩn: '${rawCol}'. '${target.word}' mang nghĩa: ${target.meaning}.`,
      error_tag: '[LỖI-COLLOCATION-CLASH]', badge: 'Bậc 2: Cụm Collocation Cố định', morph_stage: 2,
      band_75_upgrade: `Furthermore, authorities should actively ${target.word} standard protocols to ensure progress.`,
      band_85_upgrade: `Consequently, it is imperative to rigorously ${target.word} structural paradigms to mitigate systemic deficiencies.`,
      status: 'active', quality_tags: ['progressive_morphing', 'stage_2_collocation'], word_details: details
    };
  }

  private buildStage3(id: string, target: VocabWord, chosen: VocabWord[], allWords: VocabWord[], details: any): QuestionDTO {
    const derivList = parseJson<any[]>(target.derivatives || target.word_family, []);
    const deriv = Array.isArray(derivList) && derivList.length > 0 ? derivList[0] : null;

    if (deriv && deriv.word && deriv.word.toLowerCase() !== target.word.toLowerCase()) {
      const pool = [target.word, ...allWords.filter(w => w.id !== target.id).sort(() => Math.random() - 0.5).map(w => w.word)];
      const { options, correctIdx } = this.shuffleOptions(deriv.word, pool);
      return {
        id, target_word_id: target.id, target_word: target.word, embedded_word_ids: chosen.map(w => w.id),
        prompt: `Cho từ gốc "${target.word}" (${target.pos}), chọn dạng từ phái sinh (derivative) chính xác:`,
        masked_sentence: `Empirical evaluations highlight the profound significance of _______ (${deriv.pos || 'form'}) in systemic reform.`,
        options, correct_index: correctIdx,
        explanation: `'${deriv.word}' là dạng phái sinh (${deriv.pos}) của '${target.word}', mang nghĩa: ${deriv.meaning || target.meaning}.`,
        error_tag: '[LỖI-PARAPHRASE]', badge: 'Bậc 3: Họ từ & Biến thể Phái sinh', morph_stage: 3,
        band_75_upgrade: `Researchers must integrate ${target.word} and its derivatives into academic synthesis.`,
        band_85_upgrade: `Advanced scholarship necessitates deploying ${target.word} variants to enrich discursive analytical frameworks.`,
        status: 'active', quality_tags: ['progressive_morphing', 'stage_3_derivative'], word_details: details
      };
    }

    const synList = cleanStr(target.synonym).split(/[=,]/).map(s => s.trim()).filter(s => s && s.toLowerCase() !== target.word.toLowerCase());
    const synCorrect = synList.length > 0 ? synList[0] : target.word;
    const pool = allWords.filter(w => w.id !== target.id).sort(() => Math.random() - 0.5).map(w => w.word);
    const { options, correctIdx } = this.shuffleOptions(synCorrect, pool);

    return {
      id, target_word_id: target.id, target_word: target.word, embedded_word_ids: chosen.map(w => w.id),
      prompt: `Chọn từ đồng nghĩa (paraphrase) chuẩn xác nhất thay thế cho "${target.word}" trong văn cảnh học thuật:`,
      masked_sentence: `In academic synthesis, authorities must _______ (= ${target.word}) systemic inequities.`,
      options, correct_index: correctIdx,
      explanation: `'${synCorrect}' là từ đồng nghĩa học thuật chuẩn của '${target.word}' (${target.meaning}).`,
      error_tag: '[LỖI-PARAPHRASE]', badge: 'Bậc 3: Paraphrase & Từ Đồng nghĩa', morph_stage: 3,
      band_75_upgrade: `To advance outcomes, institutions must substitute common terms with ${synCorrect}.`,
      band_85_upgrade: `Precise scholarly exposition demands deploying ${synCorrect} in lieu of rudimentary alternatives to elevate lexical sophisticatedness.`,
      status: 'active', quality_tags: ['progressive_morphing', 'stage_3_paraphrase'], word_details: details
    };
  }

  private buildStage4(id: string, target: VocabWord, chosen: VocabWord[], allWords: VocabWord[], details: any): QuestionDTO {
    const nuance = cleanStr(target.nuance_50 || (target as any).nuance) || 'Sắc thái học thuật Band 8.5+ trang trọng.';
    const syns = cleanStr(target.synonym).split(/[=,]/).map(s => s.trim()).filter(s => s && s.toLowerCase() !== target.word.toLowerCase());
    const pool = [...syns, ...allWords.filter(w => w.pos === target.pos && w.id !== target.id).map(w => w.word)];
    const { options, correctIdx } = this.shuffleOptions(target.word, pool);

    const lWord = chosen.length > 0 ? chosen[0].word : 'prevailing methodologies';
    const sentence = `While ${lWord} may address surface issues, comprehensive reform mandates that institutions _______ this complex challenge.`;

    return {
      id, target_word_id: target.id, target_word: target.word, embedded_word_ids: chosen.map(w => w.id),
      prompt: 'Phân biệt sắc thái Band 8.5+: Chọn từ vựng có sắc thái học thuật và mức độ trang trọng chuẩn xác nhất:',
      masked_sentence: sentence, options, correct_index: correctIdx,
      explanation: `Sắc thái chính xác: ${nuance}. '${target.word}' mang tính học thuật trang trọng và chuẩn xác nhất.`,
      error_tag: '[LỖI-SẮC-THÁI-HỌC-THUẬT]', badge: 'Bậc 4: Sắc thái Nuance Trap Band 8.5+', morph_stage: 4,
      band_75_upgrade: `Scholars emphasize using ${target.word} for nuanced analytical depth.`,
      band_85_upgrade: `Mastering subtle semantic distinctions surrounding ${target.word} is paramount for achieving Band 8.5+ communicative precision.`,
      status: 'active', quality_tags: ['progressive_morphing', 'stage_4_nuance'], word_details: details
    };
  }

  public buildConfusedPairQuestion(target: VocabWord, confused: VocabWord, allWords: VocabWord[]): QuestionDTO {
    const id = `confused_${target.id}_${confused.id}_${Date.now()}`;
    const pool = [confused.word, ...allWords.filter(w => w.id !== target.id && w.id !== confused.id).map(w => w.word)];
    const { options, correctIdx } = this.shuffleOptions(target.word, pool);

    const col = cleanStr(target.key_collocation || target.collocations).split(',')[0]?.replace(/\(.*?\)/g, '').trim() || `${target.word} aspects`;
    const masked = `In academic discourse, researchers must _______ (${col.replace(target.word, '...')}) rather than confuse related concepts.`;

    return {
      id, target_word_id: target.id, target_word: target.word, embedded_word_ids: [confused.id],
      prompt: `Phân biệt cặp từ dễ nhầm lẫn: Chọn giữa "${target.word}" và "${confused.word}" cho ngữ cảnh:`,
      masked_sentence: masked, options, correct_index: correctIdx,
      explanation: `Phân biệt: '${target.word}' (${target.meaning}) khác biệt với '${confused.word}' (${confused.meaning}). Ngữ cảnh này đòi hỏi chính xác '${target.word}'.`,
      error_tag: '[LỖI-CONFUSED-PAIR]', badge: 'Phân biệt Cặp từ Dễ nhầm lẫn', morph_stage: 4,
      band_75_upgrade: `Mastery requires distinguishing ${target.word} from ${confused.word} in scholarly essays.`,
      band_85_upgrade: `Academic rigor strictly forbids confounding ${target.word} with ${confused.word} in high-stakes argumentative prose.`,
      status: 'active', quality_tags: ['confused_pair_remediation'],
      word_details: this.buildWordWebDetails(target, [confused.id], new Map(allWords.map(w => [w.id, w])))
    };
  }

  public buildChainQuestions(words: VocabWord[], chainIndex: number, allWords: VocabWord[]): QuestionDTO[] {
    const [wA, wB, wC] = words;
    if (!wA || !wB || !wC) return [];
    const chainId = `chain_${chainIndex}`;
    const wordsMap = new Map(allWords.map(w => [w.id, w]));
    const pool = allWords.map(w => w.word);

    const s1 = this.shuffleOptions(wA.word, pool.filter(w => w.toLowerCase() !== wA.word.toLowerCase()));
    const q1: QuestionDTO = {
      id: `chain_${wA.id}_1_${Date.now()}`, target_word_id: wA.id, target_word: wA.word, embedded_word_ids: [],
      prompt: `Khởi động chuỗi từ vựng: Chọn từ học thuật thích hợp để mở đầu mệnh đề về "${wA.word}":`,
      masked_sentence: `Local authorities initiated an urgent scheme to _______ community artistic and cultural initiatives.`,
      options: s1.options, correct_index: s1.correctIdx,
      explanation: `'${wA.word}' (${wA.meaning}) là nền móng để phát triển câu văn tiếp theo.`,
      error_tag: '[LỖI-COLLOCATION-CLASH]', badge: 'Bậc 1: Gốc từ Lego & Nghĩa cốt lõi',
      chain_id: chainId, chain_step: 1, chain_badge: 'Chuỗi Bậc Thang 1/3: Khởi Động',
      band_75_upgrade: `Authorities actively ${wA.word} fundamental cultural initiatives.`,
      band_85_upgrade: `Sustained state patronage mandates that governance bodies ${wA.word} empirical cultural frameworks.`,
      status: 'active', quality_tags: ['chain_expansion', 'step_1'], word_details: this.buildWordWebDetails(wA, [], wordsMap)
    };

    const s2 = this.shuffleOptions(wB.word, pool.filter(w => w.toLowerCase() !== wB.word.toLowerCase()));
    const q2: QuestionDTO = {
      id: `chain_${wB.id}_2_${Date.now()}`, target_word_id: wB.id, target_word: wB.word, embedded_word_ids: [wA.id],
      prompt: `Mở rộng từ liên quan: Sử dụng lại "${wA.word}" vừa học để chọn từ vựng mở rộng tiếp theo:`,
      masked_sentence: `To effectively ${wA.word} community initiatives, governments must strategically _______ public finances across regional centers.`,
      options: s2.options, correct_index: s2.correctIdx,
      explanation: `Câu mở rộng ghép: 'To effectively ${wA.word}..., governments must strategically ${wB.word}...'.`,
      error_tag: '[LỖI-COLLOCATION-CLASH]', badge: 'Bậc 2: Cụm Collocation Cố định',
      chain_id: chainId, chain_step: 2, chain_badge: 'Chuỗi Bậc Thang 2/3: Mở Rộng Liên Quan',
      band_75_upgrade: `To sustainably ${wA.word} initiatives, leaders must allocate and ${wB.word} public resources.`,
      band_85_upgrade: `Strategic resource governance entails optimizing how leaders ${wB.word} allocations while striving to ${wA.word} civic initiatives.`,
      status: 'active', quality_tags: ['chain_expansion', 'step_2'], word_details: this.buildWordWebDetails(wB, [wA.id], wordsMap)
    };

    const s3 = this.shuffleOptions(wC.word, pool.filter(w => w.toLowerCase() !== wC.word.toLowerCase()));
    const q3: QuestionDTO = {
      id: `chain_${wC.id}_3_${Date.now()}`, target_word_id: wC.id, target_word: wC.word, embedded_word_ids: [wA.id, wB.id],
      prompt: `Hợp nhất Band 7.5+: Kết hợp trọn vẹn cả "${wA.word}" và "${wB.word}" vào một câu phức hoàn chỉnh:`,
      masked_sentence: `When authorities ${wB.word} finances to ${wA.word} community projects, they successfully _______ local heritage and social cohesion.`,
      options: s3.options, correct_index: s3.correctIdx,
      explanation: `Hợp nhất Band 7.5+: Kết hợp '${wA.word}' + '${wB.word}' + '${wC.word}' tạo khối câu mạch lạc cho Writing Task 2.`,
      error_tag: '[LỖI-SẮC-THÁI-HỌC-THUẬT]', badge: 'Bậc 3: Họ từ & Biến thể Phái sinh',
      chain_id: chainId, chain_step: 3, chain_badge: 'Chuỗi Bậc Thang 3/3: Hợp Nhất Band 7.5+',
      band_75_upgrade: `When authorities ${wB.word} finances to ${wA.word} projects, they successfully ${wC.word} heritage.`,
      band_85_upgrade: `Systemic policy convergence—wherein institutions ${wB.word} capital to ${wA.word} grassroots programs—inevitably ${wC.word} enduring civilizational legacies.`,
      status: 'active', quality_tags: ['chain_expansion', 'step_3'], word_details: this.buildWordWebDetails(wC, [wA.id, wB.id], wordsMap)
    };

    return [q1, q2, q3];
  }

  public buildWordWebDetails(target: any, embeddedIds: string[], wordsMap: Map<string, VocabWord>) {
    if (!target) return { collocation: 'N/A', paraphrase: 'N/A', derivatives: 'N/A', embedded_words: [] };
    const tWord = cleanStr(target.word);
    const tPos = cleanStr(target.pos || 'v');
    const colStr = cleanStr(target.key_collocation || target.collocations);
    const rawCol = colStr.replace(/\(.*?\)/g, '').split(',')[0]?.trim() || (tWord ? `${tWord} framework` : 'N/A');
    const synStr = cleanStr(target.synonym);
    const rawSyn = synStr.split(/[=,]/).map(s => s.trim()).filter(Boolean).slice(0, 2).join(' / ') || 'N/A';

    let derivStr = tWord ? `${tWord} (${tPos})` : 'N/A';
    const derivList = parseJson<any[]>(target.derivatives || target.word_family, []);
    if (Array.isArray(derivList) && derivList.length > 0) {
      const parts = derivList.slice(0, 2).map((d: any) => `${d.word || ''} (${d.pos || 'deriv'})`).filter(p => p.trim() !== '()');
      if (parts.length > 0) derivStr += ` ➔ ${parts.join(' ➔ ')}`;
    }

    const embeddedWords = (embeddedIds || []).map(id => {
      const w = wordsMap.get(id);
      return { id, word: w ? w.word : id, meaning: w ? cleanStr(w.meaning).split('(')[0].trim() : '' };
    });

    return { collocation: rawCol, paraphrase: rawSyn, derivatives: derivStr, embedded_words: embeddedWords };
  }

  public recordConfusedPair(userId: string, targetWordId: string, confusedWordId: string): void {
    if (!targetWordId || !confusedWordId || targetWordId === confusedWordId) return;
    try {
      this.db.prepare(`
        INSERT INTO confused_word_pairs (id, user_id, target_word_id, confused_word_id, count, updated_at)
        VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, target_word_id, confused_word_id) DO UPDATE SET
          count = count + 1, updated_at = CURRENT_TIMESTAMP
      `).run(`cp_${userId}_${targetWordId}_${confusedWordId}`, userId, targetWordId, confusedWordId);
    } catch {}
  }

  public getRecentConfusedPairs(userId: string, limit: number = 5): Array<{ target_word_id: string; confused_word_id: string }> {
    try {
      return this.db.prepare(`
        SELECT target_word_id, confused_word_id FROM confused_word_pairs
        WHERE user_id = ? ORDER BY updated_at DESC, count DESC LIMIT ?
      `).all(userId, limit) as any[];
    } catch { return []; }
  }
}

export const expansionService = new ExpansionService();
