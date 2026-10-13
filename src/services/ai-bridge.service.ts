export interface SemanticScoreResult {
  score: number;
  best_match: string;
  latency_ms: number;
  fallback: boolean;
}

export interface QuestionValidationResult {
  valid: boolean;
  errors: string[];
  tier: string;
  fallback: boolean;
}

export class AIBridgeService {
  private baseUrl = 'http://127.0.0.1:8001';
  private timeoutMs = 3000;

  public async getSemanticSimilarity(
    candidateText: string,
    referenceTexts: string[]
  ): Promise<SemanticScoreResult> {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), this.timeoutMs);

      const resp = await fetch(`${this.baseUrl}/v1/semantic-similarity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_text: candidateText,
          reference_texts: referenceTexts
        }),
        signal: controller.signal
      });

      clearTimeout(id);

      if (resp.ok) {
        const data = await resp.json() as any;
        return {
          score: data.similarity_score ?? data.score ?? 0.8,
          best_match: data.best_match ?? referenceTexts[0] ?? '',
          latency_ms: performance.now() - start,
          fallback: false
        };
      }
    } catch (err) {
      // Circuit breaker: graceful degradation to local deterministic heuristic
    }

    // Local Token Overlap & Jaccard/N-Gram Fallback (< 1ms)
    return this.calculateLocalHeuristicSimilarity(candidateText, referenceTexts, performance.now() - start);
  }

  public async validateQuestion(question: {
    prompt: string;
    options: string[];
    correct_index: number;
  }): Promise<QuestionValidationResult> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), this.timeoutMs);

      const resp = await fetch(`${this.baseUrl}/v1/validate-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(question),
        signal: controller.signal
      });

      clearTimeout(id);

      if (resp.ok) {
        const data = await resp.json() as any;
        return {
          valid: data.valid ?? true,
          errors: data.errors ?? [],
          tier: data.tier ?? 'ai_v1',
          fallback: false
        };
      }
    } catch {
      // Graceful offline fallback
    }

    // Local offline syntax checks
    const errors: string[] = [];
    if (!question.options || question.options.length !== 4) {
      errors.push('Câu hỏi phải có đúng 4 đáp án lựa chọn');
    }
    const unique = new Set(question.options.map(o => o.trim().toLowerCase()));
    if (unique.size !== question.options.length) {
      errors.push('Tồn tại các đáp án trùng lặp');
    }
    if (question.correct_index < 0 || question.correct_index > 3) {
      errors.push('Vị trí đáp án đúng không hợp lệ');
    }

    return {
      valid: errors.length === 0,
      errors,
      tier: 'local_deterministic_v1',
      fallback: true
    };
  }

  private calculateLocalHeuristicSimilarity(
    candidate: string,
    references: string[],
    latency: number
  ): SemanticScoreResult {
    const candidateTokens = new Set(candidate.toLowerCase().match(/\b\w+\b/g) || []);
    let bestScore = 0.0;
    let bestMatch = references[0] || '';

    for (const ref of references) {
      const refTokens = new Set(ref.toLowerCase().match(/\b\w+\b/g) || []);
      let intersection = 0;
      for (const t of candidateTokens) {
        if (refTokens.has(t)) intersection++;
      }
      const union = new Set([...candidateTokens, ...refTokens]).size;
      const jaccard = union > 0 ? intersection / union : 0.0;
      if (jaccard > bestScore) {
        bestScore = jaccard;
        bestMatch = ref;
      }
    }

    // Normalized academic similarity score (0.0 to 1.0)
    const normalizedScore = Number(Math.min(1.0, bestScore * 1.35).toFixed(2));
    return {
      score: normalizedScore,
      best_match: bestMatch,
      latency_ms: latency,
      fallback: true
    };
  }
}

export const aiBridgeService = new AIBridgeService();
