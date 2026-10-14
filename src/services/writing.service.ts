import { WritingChunk, WritingEvaluationResponse } from '../types/writing.types.js';
import { aiBridgeService } from './ai-bridge.service.js';
import { fsrsService } from './fsrs.service.js';
import { getDatabase } from '../db/sqlite.js';

export class WritingService {
  private chunks: WritingChunk[] = [];
  private db = getDatabase();

  constructor() {
    this.initChunks();
  }

  private initChunks(): void {
    this.chunks = [
      {
        id: 'chunk_01',
        unit: 1,
        title: 'Chặng 1: Xã hội & Giáo dục Đại học',
        topic: 'Education & Society',
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
        unit: 2,
        title: 'Chặng 2: Tài chính & Di sản Văn hóa Nghệ thuật',
        topic: 'Arts & Funding',
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
        unit: 3,
        title: 'Chặng 3: Môi trường & Chi phí Công nghệ Xanh',
        topic: 'Environment & Tech',
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
        unit: 4,
        title: 'Chặng 4: Khủng hoảng & Gắn kết Cộng đồng',
        topic: 'Community & Crisis',
        target_words: [
          { id: '#113', word: 'conflict', pos: 'n', core: 'xung đột, thời kỳ giao tranh', colloc: 'times of conflict or crisis' },
          { id: '#188a', word: 'display', pos: 'n/v', core: 'trưng bày triển lãm', colloc: 'public display of art' },
          { id: '#324a', word: 'isolation', pos: 'n', core: 'sự cô lập xã hội', colloc: 'alleviate social isolation' }
        ],
        vietnamese_prompt: 'Trong các thời kỳ xung đột hay khủng hoảng, việc tổ chức các buổi triển lãm nghệ thuật công cộng có thể gắn kết cộng đồng và làm dịu đi sự cô lập xã hội.',
        minimalist_clues: ['times of conflict', 'public display of art', 'foster social cohesion', 'alleviate social isolation'],
        band_75_model: 'During eras of conflict or severe crisis, the public display of communal artworks can unify local neighborhoods and alleviate feelings of social isolation.',
        band_85_model: 'In epochs marked by profound conflict or socio-economic distress, putting cultural masterpieces on public display fosters civic solidarity while decisively alleviating chronic social isolation.'
      }
    ];
  }

  public getChunks(): WritingChunk[] {
    return this.chunks;
  }

  public getChunkById(id: string): WritingChunk | null {
    return this.chunks.find(c => c.id === id) || null;
  }

  public async evaluateTranslation(
    chunkId: string,
    userText: string,
    userId: string = 'default_user'
  ): Promise<WritingEvaluationResponse> {
    const chunk = this.getChunkById(chunkId);
    if (!chunk) {
      throw new Error(`Writing chunk ${chunkId} not found`);
    }

    const cleanText = (userText || '').trim();
    if (!cleanText) {
      throw new Error('User translation cannot be empty');
    }
    const lowerText = cleanText.toLowerCase();

    const matchedWords: string[] = [];
    const missingWords: string[] = [];

    for (const tw of chunk.target_words) {
      const root = tw.word.toLowerCase();
      const stem = root.length > 4 ? root.slice(0, -1) : root;
      if (lowerText.includes(root) || lowerText.includes(stem)) {
        matchedWords.push(tw.word);
        try {
          // Anti-demotion FSRS safeguard: protect already mastered vocabulary
          const card = fsrsService.getCard(tw.id, userId);
          const currentScore = card?.current_score ?? 1.0;
          const { newScore } = fsrsService.reviewWord(tw.id, 3, new Date(), userId);
          if (currentScore > newScore) {
            this.db.prepare('UPDATE user_vocab_progress SET current_score = ? WHERE word_id = ? AND user_id = ?')
              .run(currentScore, tw.id, userId);
          }
        } catch {
          // Non-blocking background sync
        }
      } else {
        missingWords.push(tw.word);
      }
    }

    // Call AI Semantic Scorer
    const aiRes = await aiBridgeService.getSemanticSimilarity(cleanText, [
      chunk.band_75_model,
      chunk.band_85_model
    ]);

    const words = cleanText.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const coverageRatio = chunk.target_words.length > 0
      ? Number((matchedWords.length / chunk.target_words.length).toFixed(2))
      : 0;

    // Standardized composite score_ratio in 0.0 - 1.0 (60% AI semantic similarity + 40% target word coverage)
    const scoreRatio = Math.max(0.0, Math.min(1.0, Number(((aiRes.score * 0.6) + (coverageRatio * 0.4)).toFixed(2))));

    const feedbackParts: string[] = [];
    if (coverageRatio === 1) {
      feedbackParts.push('Xuất sắc! Bạn đã lồng ghép thành công 100% từ vựng mục tiêu học thuật.');
    } else {
      feedbackParts.push(`Cần bổ sung thêm từ vựng mục tiêu còn thiếu: ${missingWords.join(', ')}.`);
    }

    if (wordCount < 12) {
      feedbackParts.push('Câu dịch hơi ngắn so với cấu trúc biện luận chuẩn IELTS Writing Task 2.');
    } else {
      feedbackParts.push(`Độ dài câu (${wordCount} từ) đáp ứng tốt tiêu chuẩn câu phức Task 2.`);
    }

    let bandEstimate = '6.0 - 6.5';
    if (scoreRatio >= 0.85) {
      bandEstimate = '8.0 - 8.5';
    } else if (scoreRatio >= 0.70) {
      bandEstimate = '7.5';
    } else if (scoreRatio >= 0.55) {
      bandEstimate = '6.5 - 7.0';
    }

    return {
      chunk_id: chunk.id,
      word_count: wordCount,
      used_target_words: matchedWords,
      missing_target_words: missingWords,
      coverage_ratio: coverageRatio,
      score_ratio: scoreRatio,
      similarity_score: aiRes.score,
      band_estimate: bandEstimate,
      band_75_model: chunk.band_75_model,
      band_85_model: chunk.band_85_model,
      feedback: feedbackParts.join(' ')
    };
  }
}

export const writingService = new WritingService();
