import fs from 'fs';
import path from 'path';
import { getDatabase, ensureUserExists } from '../db/sqlite.js';
import { aiBridgeService } from './ai-bridge.service.js';

export interface ExamQuestion {
  number: number;
  q_type: string;
  prompt: string;
  options?: string[];
  correct_answer: string;
  clue_paragraph: string;
  clue_text: string;
  explanation: string;
  trap_type: string;
}

export interface ExamPassage {
  id: string;
  test_number: number;
  passage_number: number;
  title: string;
  subtitle?: string;
  paragraphs: Array<{ label: string; text: string }>;
  questions: ExamQuestion[];
  target_words: string[];
}

export interface WritingChunk {
  id: string;
  title: string;
  target_words: Array<{ id: string; word: string; pos: string; core: string; colloc: string }>;
  vietnamese_prompt: string;
  minimalist_clues: string[];
  band_75_model: string;
  band_85_model: string;
}

export class ExamService {
  private db = getDatabase();
  private passages: Map<string, ExamPassage> = new Map();
  private writingChunks: WritingChunk[] = [];

  constructor() {
    this.loadPassages();
    this.initWritingChunks();
  }

  private loadPassages() {
    const examsDir = path.resolve(process.cwd(), 'data', 'exams');
    if (!fs.existsSync(examsDir)) return;

    const files = fs.readdirSync(examsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(examsDir, file), 'utf-8'));
        if (raw.id) {
          this.passages.set(raw.id, {
            id: raw.id,
            test_number: raw.test_number || 1,
            passage_number: raw.passage_number || 1,
            title: raw.title || '',
            subtitle: raw.subtitle || '',
            paragraphs: raw.paragraphs || [],
            questions: raw.questions || [],
            target_words: raw.target_words || []
          });
        }
      } catch (err) {
        console.error(`Failed to load passage ${file}:`, err);
      }
    }
  }

  public getAllPassages(): ExamPassage[] {
    return Array.from(this.passages.values());
  }

  public getPassage(id: string): ExamPassage | null {
    return this.passages.get(id) || null;
  }

  public evaluatePassageSubmission(
    passageId: string,
    answers: Record<string, string>,
    userId: string = 'default_user'
  ): {
    passage_id: string;
    total_questions: number;
    correct_answers: number;
    score_ratio: number;
    estimated_band: string;
    detailed_results: Array<{
      number: number;
      user_answer: string;
      correct_answer: string;
      is_correct: boolean;
      clue_paragraph: string;
      clue_text: string;
      explanation: string;
      trap_type: string;
    }>;
  } {
    const passage = this.getPassage(passageId);
    if (!passage) throw new Error(`Passage ${passageId} not found`);

    let correctCount = 0;
    const detailed = passage.questions.map(q => {
      const userAns = (answers[q.number.toString()] || '').trim().toLowerCase();
      const expectedAns = (q.correct_answer || '').trim().toLowerCase();
      const isCorrect = userAns.length > 0 && (userAns === expectedAns || expectedAns.split('/').map(s => s.trim()).includes(userAns));
      if (isCorrect) correctCount++;

      return {
        number: q.number,
        user_answer: userAns,
        correct_answer: q.correct_answer,
        is_correct: isCorrect,
        clue_paragraph: q.clue_paragraph,
        clue_text: q.clue_text,
        explanation: q.explanation,
        trap_type: q.trap_type || '[TRAP-PARAPHRASE]'
      };
    });

    const ratio = passage.questions.length > 0 ? correctCount / passage.questions.length : 0;
    let band = '5.0';
    if (ratio >= 0.85) band = '8.0 - 8.5';
    else if (ratio >= 0.70) band = '7.0 - 7.5';
    else if (ratio >= 0.55) band = '6.0 - 6.5';
    else if (ratio >= 0.40) band = '5.5';

    // Store in SQLite
    this.ensureUserExists(userId);
    this.db.prepare(`
      INSERT INTO exam_submissions (id, user_id, passage_id, submission_type, answers, score_ratio, estimated_band, raw_score)
      VALUES (?, ?, ?, 'reading', ?, ?, ?, ?)
    `).run(`sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`, userId, passageId, JSON.stringify(answers), ratio, band, correctCount);

    return {
      passage_id: passageId,
      total_questions: passage.questions.length,
      correct_answers: correctCount,
      score_ratio: Number(ratio.toFixed(2)),
      estimated_band: band,
      detailed_results: detailed
    };
  }

  public getWritingChunks(): WritingChunk[] {
    return this.writingChunks;
  }

  public getWritingChunkById(id: string): WritingChunk | null {
    return this.writingChunks.find(c => c.id === id) || null;
  }

  public async evaluateWritingChunk(
    chunkId: string,
    submissionText: string,
    userId: string = 'default_user'
  ): Promise<{
    chunk_id: string;
    matched_words: string[];
    missing_words: string[];
    similarity_score: number;
    score_ratio: number;
    estimated_band: string;
    band_75_model: string;
    band_85_model: string;
  }> {
    const chunk = this.getWritingChunkById(chunkId);
    if (!chunk) throw new Error(`Writing chunk ${chunkId} not found`);

    const lowerSub = submissionText.toLowerCase();
    const matched: string[] = [];
    const missing: string[] = [];

    for (const tw of chunk.target_words) {
      if (lowerSub.includes(tw.word.toLowerCase())) {
        matched.push(tw.word);
      } else {
        missing.push(tw.word);
      }
    }

    const aiRes = await aiBridgeService.getSemanticSimilarity(submissionText, [
      chunk.band_75_model,
      chunk.band_85_model
    ]);

    const vocabCoverage = chunk.target_words.length > 0 ? matched.length / chunk.target_words.length : 0;
    const finalRatio = Number(((aiRes.score * 0.6) + (vocabCoverage * 0.4)).toFixed(2));

    let band = '6.0';
    if (finalRatio >= 0.85) band = '8.0 - 8.5';
    else if (finalRatio >= 0.70) band = '7.5';
    else if (finalRatio >= 0.55) band = '6.5 - 7.0';

    this.ensureUserExists(userId);
    this.db.prepare(`
      INSERT INTO exam_submissions (id, user_id, passage_id, submission_type, answers, score_ratio, estimated_band, raw_score, ai_feedback)
      VALUES (?, ?, ?, 'writing', ?, ?, ?, ?, ?)
    `).run(
      `sub_w_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId,
      chunkId,
      JSON.stringify({ text: submissionText }),
      finalRatio,
      band,
      matched.length,
      JSON.stringify({ matched, missing, similarity: aiRes.score })
    );

    return {
      chunk_id: chunkId,
      matched_words: matched,
      missing_words: missing,
      similarity_score: aiRes.score,
      score_ratio: finalRatio,
      estimated_band: band,
      band_75_model: chunk.band_75_model,
      band_85_model: chunk.band_85_model
    };
  }

  private initWritingChunks() {
    this.writingChunks = [
      {
        id: 'chunk_01',
        title: 'Chặng 1: Xã hội & Giáo dục Đại học',
        target_words: [
          { id: '#118', word: 'contemporary', pos: 'adj', core: 'đương đại, ngày nay', colloc: 'contemporary society' },
          { id: '#066', word: 'bulk', pos: 'n', core: 'phần lớn, số lượng khổng lồ', colloc: 'bulk of young people' },
          { id: '#229', word: 'establish', pos: 'v', core: 'thiết lập, gầy dựng nền móng', colloc: 'establish a foundation' }
        ],
        vietnamese_prompt: 'Trong xã hội đương đại, phần lớn người trẻ chọn theo đuổi giáo dục bậc cao nhằm gầy dựng nền móng vững chắc cho sự nghiệp tương lai.',
        minimalist_clues: ['contemporary society', 'bulk of young people', 'pursue higher education', 'establish a foundation', 'future career'],
        band_75_model: 'In contemporary society, the bulk of young people opt to pursue higher education to establish a solid foundation for their future careers.',
        band_85_model: 'In contemporary society, an overwhelming bulk of youths elect to pursue tertiary education, seeking thereby to establish an enduring foundation for their prospective careers.'
      },
      {
        id: 'chunk_02',
        title: 'Chặng 2: Tài chính & Di sản Văn hóa Nghệ thuật',
        target_words: [
          { id: '#271', word: 'fund', pos: 'v', core: 'cấp vốn tài trợ', colloc: 'fund art projects' },
          { id: '#258', word: 'finance', pos: 'n', core: 'nguồn tài chính công', colloc: 'allocate finances' },
          { id: '#424', word: 'promote', pos: 'v', core: 'thúc đẩy quảng bá', colloc: 'promote cultural heritage' }
        ],
        vietnamese_prompt: 'Nhiều người tin rằng chính quyền nên phân bổ tài chính để tài trợ các dự án nghệ thuật nhằm thúc đẩy di sản văn hóa trong cộng đồng địa phương.',
        minimalist_clues: ['allocate finances', 'fund art projects', 'promote cultural heritage', 'local community'],
        band_75_model: 'Many argue that the government ought to allocate public finances to fund community art projects, thereby promoting cultural heritage across local communities.',
        band_85_model: 'It is widely contended that state authorities should allocate public finances to generously fund artistic endeavors, thereby serving to vigorously promote local cultural heritage.'
      },
      {
        id: 'chunk_03',
        title: 'Chặng 3: Môi trường & Chi phí Công nghệ Xanh',
        target_words: [
          { id: '#383', word: 'period', pos: 'n', core: 'giai đoạn, khoảng thời gian dài', colloc: 'extended period' },
          { id: '#311a', word: 'innovation', pos: 'n', core: 'sự đổi mới sáng tạo', colloc: 'green technological innovation' },
          { id: '#062', word: 'benefit', pos: 'n', core: 'lợi ích dài hạn', colloc: 'tangible benefits' }
        ],
        vietnamese_prompt: 'Dù chi phí ban đầu cho công nghệ xanh rất tốn kém, các doanh nghiệp vẫn nên kiên trì theo đuổi lĩnh vực này trong một giai đoạn kéo dài vì lợi ích bền vững.',
        minimalist_clues: ['initial cost', 'green technological innovation', 'extended period', 'tangible benefits'],
        band_75_model: 'Although the initial expenditure on green technologies is substantial, commercial enterprises should sustain investments over an extended period to reap tangible environmental benefits.',
        band_85_model: 'Notwithstanding the formidable upfront costs of green technological innovations, forward-looking corporations ought to maintain commitments over an extended period to secure profound ecological benefits.'
      },
      {
        id: 'chunk_04',
        title: 'Chặng 4: Khủng hoảng & Gắn kết Cộng đồng',
        target_words: [
          { id: '#113', word: 'conflict', pos: 'n', core: 'xung đột, thời kỳ giao tranh', colloc: 'times of conflict or crisis' },
          { id: '#188a', word: 'display', pos: 'n/v', core: 'trưng bày triển lãm', colloc: 'public display of art' },
          { id: '#324a', word: 'isolation', pos: 'n', core: 'sự cô lập xã hội', colloc: 'alleviate social isolation' }
        ],
        vietnamese_prompt: 'Trong các thời kỳ xung đột hay khủng hoảng, việc tổ chức các buổi triển lãm nghệ thuật công cộng có thể gắn kết cộng đồng và làm dịu đi sự cô lập xã hội.',
        minimalist_clues: ['times of conflict', 'public display of art', 'foster social cohesion', 'alleviate social isolation'],
        band_75_model: 'During times of conflict and societal crises, public displays of artistic works can foster community cohesion and alleviate acute social isolation.',
        band_85_model: 'Amid periods of profound geopolitical conflict, curating public artistic displays serves to catalyze communal solidarity, while significantly alleviating collective feelings of social isolation.'
      }
    ];
  }

  private ensureUserExists(userId: string): void {
    ensureUserExists(userId, this.db);
  }
}

export const examService = new ExamService();
