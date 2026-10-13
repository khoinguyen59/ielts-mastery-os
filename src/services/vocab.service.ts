import { getDatabase } from '../db/sqlite.js';
import { VocabWord } from '../types/vocab.types.js';

export class VocabService {
  private db = getDatabase();

  public getAll(): VocabWord[] {
    const rows = this.db.prepare(`
      SELECT w.*, p.current_score as score
      FROM words w
      LEFT JOIN user_vocab_progress p ON w.id = p.word_id
      ORDER BY w.id ASC
    `).all() as any[];

    return rows.map(r => this.mapRowToWord(r));
  }

  public getById(id: string): VocabWord | null {
    const row = this.db.prepare(`
      SELECT w.*, p.current_score as score
      FROM words w
      LEFT JOIN user_vocab_progress p ON w.id = p.word_id
      WHERE w.id = ? OR w.word = ?
    `).get(id, id.toLowerCase()) as any;

    return row ? this.mapRowToWord(row) : null;
  }

  public search(query: string, pos?: string, limit: number = 50): VocabWord[] {
    const cleanQuery = `%${query.trim().toLowerCase()}%`;
    let sql = `
      SELECT w.*, p.current_score as score
      FROM words w
      LEFT JOIN user_vocab_progress p ON w.id = p.word_id
      WHERE (w.word LIKE ? OR w.meaning LIKE ? OR w.collocations LIKE ?)
    `;
    const params: any[] = [cleanQuery, cleanQuery, cleanQuery];

    if (pos) {
      sql += ' AND w.pos = ?';
      params.push(pos.toLowerCase());
    }

    sql += ' ORDER BY w.id ASC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapRowToWord(r));
  }

  public getDueWords(limit: number = 20): VocabWord[] {
    const now = new Date().toISOString();
    const rows = this.db.prepare(`
      SELECT w.*, p.current_score as score
      FROM words w
      INNER JOIN user_vocab_progress p ON w.id = p.word_id
      WHERE p.due_date IS NULL OR p.due_date <= ?
      ORDER BY p.current_score ASC, p.due_date ASC
      LIMIT ?
    `).all(now, limit) as any[];

    return rows.map(r => this.mapRowToWord(r));
  }

  public getLearnedWords(minScore: number = 2.0): VocabWord[] {
    const rows = this.db.prepare(`
      SELECT w.*, p.current_score as score
      FROM words w
      INNER JOIN user_vocab_progress p ON w.id = p.word_id
      WHERE p.current_score >= ?
      ORDER BY p.current_score DESC
    `).all(minScore) as any[];

    return rows.map(r => this.mapRowToWord(r));
  }

  public getByLevel(levelKey: string = 'intermediate'): VocabWord[] {
    const all = this.getAll();
    const rangeMap: Record<string, [number, number]> = {
      starter: [0, 80],
      foundation: [0, 150],
      intermediate: [50, 300],
      advanced: [100, 450],
      mastery: [150, 450]
    };
    const [start, end] = rangeMap[levelKey] || [0, 450];
    return all.slice(start, Math.min(end, all.length));
  }

  private mapRowToWord(row: any): VocabWord {
    let synonyms = '';
    let antonyms = '';
    let collocations = '';
    let derivatives: any[] = [];
    let legoRootsStr = '';

    try {
      const synArr = JSON.parse(row.synonyms || '[]');
      synonyms = Array.isArray(synArr) ? synArr.join(' = ') : synArr;
    } catch {
      synonyms = row.synonyms || '';
    }

    try {
      const antArr = JSON.parse(row.antonyms || '[]');
      antonyms = Array.isArray(antArr) ? antArr.join(' = ') : antArr;
    } catch {
      antonyms = row.antonyms || '';
    }

    try {
      collocations = JSON.parse(row.collocations || '""');
    } catch {
      collocations = row.collocations || '';
    }

    try {
      derivatives = JSON.parse(row.derivatives || '[]');
    } catch {
      derivatives = [];
    }

    try {
      const rootsObj = JSON.parse(row.lego_roots || '{}');
      legoRootsStr = rootsObj.roots || '';
    } catch {
      legoRootsStr = row.lego_roots || '';
    }

    return {
      id: row.id,
      word: row.word,
      pos: row.pos,
      ipa: row.ipa || '',
      meaning: row.meaning,
      score: row.score ?? 1.0,
      synonym: synonyms,
      paraphrase: synonyms,
      antonym: antonyms,
      key_collocation: collocations,
      collocations: collocations,
      example: row.example || '',
      lego_roots: legoRootsStr,
      word_family: derivatives,
      derivatives: derivatives,
      nuance_50: row.nuance || ''
    };
  }
}

export const vocabService = new VocabService();
