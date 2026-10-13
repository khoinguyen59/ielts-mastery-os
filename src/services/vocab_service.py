"""Vocabulary Service: Master 450 Academic Vocabulary Management & Retrieval."""
import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Any
from src.config.settings import MASTER_VOCAB_FILE, MY_VOCAB_DIR
from src.models.vocab import VocabItem

class VocabService:
    def __init__(self):
        self._vocab_cache: Dict[str, VocabItem] = {}
        self._id_index: Dict[str, str] = {} # "#001" -> "abandon"
        self._load_vocab()

    def _load_vocab(self):
        if not MASTER_VOCAB_FILE.exists():
            return

        with open(MASTER_VOCAB_FILE, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

        for key, entry in raw_data.items():
            if not isinstance(entry, dict) or not entry.get("id"):
                continue
            v_id = entry.get("id", "")
            # Only index root/primary words
            if key == entry.get("word", "").lower():
                syn = entry.get("synonym") or entry.get("paraphrase") or ""
                colloc = entry.get("key_collocation") or entry.get("collocations") or ""
                wf = entry.get("word_family") or entry.get("derivatives") or []
                item = VocabItem(
                    id=v_id,
                    word=entry.get("word", key),
                    pos=entry.get("pos", ""),
                    ipa=entry.get("ipa", ""),
                    meaning=entry.get("meaning", ""),
                    extended_meaning=entry.get("extended_meaning", ""),
                    score=float(entry.get("score", 1.0)),
                    synonym=syn,
                    paraphrase=syn,
                    antonym=entry.get("antonym", ""),
                    key_collocation=colloc,
                    collocations=colloc,
                    example=entry.get("example", ""),
                    lego_roots=entry.get("lego_roots", ""),
                    word_family=wf,
                    nuance_50=entry.get("nuance_50", ""),
                    derivatives=wf
                )
                self._vocab_cache[key] = item
                self._id_index[v_id] = key

        # Sync latest scores from my-vocab/week_XX.md
        self._sync_scores_from_markdown()

    def _sync_scores_from_markdown(self):
        if not MY_VOCAB_DIR.exists():
            return
        for md_file in MY_VOCAB_DIR.glob("week_*.md"):
            try:
                content = md_file.read_text(encoding="utf-8")
                # Format 1: 01. **word** (pos) | IPA | meaning | score (0-7) | ...
                pattern_legacy = r'\d+\.\s+\*\*([a-zA-Z\-]+)\*\*\s+\(([^)]+)\)\s+\|[^|]+\|[^|]+\|\s*([0-9.]+)'
                for w, pos, sc in re.findall(pattern_legacy, content):
                    low = w.lower()
                    if low in self._vocab_cache:
                        self._vocab_cache[low].score = max(1.0, min(7.0, float(sc)))

                # Format 2: Standard 8-field Markdown (word | IPA | meaning | score | ...)
                lines = content.splitlines()
                for line in lines:
                    parsed = self.parse_8_field_markdown(line)
                    if parsed and parsed["word"] in self._vocab_cache:
                        self._vocab_cache[parsed["word"]].score = parsed["score"]
            except Exception:
                pass

    def parse_8_field_markdown(self, line: str) -> Optional[Dict[str, Any]]:
        """Parse a single 8-field pipe-separated markdown string into a dictionary."""
        parts = [p.strip() for p in line.split("|")]
        if len(parts) >= 8:
            raw_word = parts[0]
            # Strip list counter or markdown bold if present
            clean_word = re.sub(r'^\d+\.\s*', '', raw_word)
            clean_word = re.sub(r'\*\*([^*]+)\*\*.*', r'\1', clean_word).strip().lower()
            try:
                sc = float(parts[3])
                sc = max(1.0, min(7.0, sc))
            except ValueError:
                sc = 1.0
            return {
                "word": clean_word,
                "ipa": parts[1],
                "meaning": parts[2],
                "score": sc,
                "synonym": parts[4],
                "antonym": parts[5],
                "key_collocation": parts[6],
                "example": parts[7]
            }
        return None

    def format_8_field_markdown(self, item: Dict[str, Any]) -> str:
        """Serialize a vocabulary record into standard 8-field Markdown line."""
        w = item.get("word", "")
        ipa = item.get("ipa", "")
        meaning = item.get("meaning", "")
        sc = f"{float(item.get('score', 1.0)):.2f}"
        syn = item.get("synonym") or item.get("paraphrase") or ""
        ant = item.get("antonym", "")
        colloc = item.get("key_collocation") or item.get("collocations") or ""
        ex = item.get("example", "")
        return f"{w} | {ipa} | {meaning} | {sc} | {syn} | {ant} | {colloc} | {ex}"

    def get_all(self, query: str = "", pos: str = "", min_sc: float = 0.0, max_sc: float = 7.0) -> List[Dict]:
        results = []
        q_low = query.strip().lower()
        for item in self._vocab_cache.values():
            if q_low and (q_low not in item.word.lower() and q_low not in item.meaning.lower() and q_low not in item.id.lower()):
                continue
            if pos and item.pos.lower() != pos.lower():
                continue
            if not (min_sc <= item.score <= max_sc):
                continue
            results.append(item.to_dict())
        # Sort by ID
        results.sort(key=lambda x: x["id"])
        return results

    def get_by_id(self, v_id: str) -> Optional[Dict]:
        clean_id = v_id if v_id.startswith("#") else f"#{v_id}"
        word_key = self._id_index.get(clean_id)
        if word_key and word_key in self._vocab_cache:
            return self._vocab_cache[word_key].to_dict()
        return None

    def get_by_word(self, word: str) -> Optional[Dict]:
        item = self._vocab_cache.get(word.strip().lower())
        return item.to_dict() if item else None

    def update_score(self, v_id: str, new_score: float) -> bool:
        clean_id = v_id if v_id.startswith("#") else f"#{v_id}"
        word_key = self._id_index.get(clean_id)
        if word_key and word_key in self._vocab_cache:
            bounded_score = max(0.0, min(7.0, round(new_score, 2)))
            self._vocab_cache[word_key].score = bounded_score
            return True
        return False

    def get_stats(self) -> Dict[str, Any]:
        total = len(self._vocab_cache)
        if total == 0:
            return {"total": 0, "mastered": 0, "learning": 0, "avg_score": 0.0}
        mastered = sum(1 for v in self._vocab_cache.values() if v.score >= 5.0)
        learning = sum(1 for v in self._vocab_cache.values() if 1.0 <= v.score < 5.0)
        avg = sum(v.score for v in self._vocab_cache.values()) / total
        return {
            "total_words": total,
            "mastered_words": mastered,
            "learning_words": learning,
            "average_score": round(avg, 2),
            "target_band": "7.5+"
        }

# Global singleton
vocab_service = VocabService()
