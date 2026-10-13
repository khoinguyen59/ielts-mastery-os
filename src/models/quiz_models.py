"""Quiz and Cognitive Funnel Models for IELTS Mastery OS.
Covers Flashcards (Stage 1), Meaning Blitz (Stage 2), Recursive Synthesis (Stage 3),
and FSRS v5 Memory State tracking.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

@dataclass
class FlashcardItem:
    """Flashcard representation for Stage 1 (Echo-Loop audio + Lego roots)."""
    id: str
    word: str
    pos: str
    ipa: str
    meaning: str
    key_collocation: str
    example: str
    lego_roots: str = ""
    word_family: List[Dict[str, str]] = field(default_factory=list)
    score: float = 1.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "word": self.word,
            "pos": self.pos,
            "ipa": self.ipa,
            "meaning": self.meaning,
            "key_collocation": self.key_collocation,
            "example": self.example,
            "lego_roots": self.lego_roots,
            "word_family": self.word_family,
            "score": self.score
        }

@dataclass
class BlitzQuestion:
    """Rapid meaning recognition question for Stage 2 (earthworm micro-round)."""
    id: str
    type: str  # "en_to_vi", "vi_to_en", "synonym", "collocation"
    badge: str
    prompt: str
    target_word: str
    word_id: str
    ipa: str
    options: List[str]
    correct_index: int
    explanation: str
    time_limit: int = 10

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "badge": self.badge,
            "prompt": self.prompt,
            "target_word": self.target_word,
            "word_id": self.word_id,
            "ipa": self.ipa,
            "options": self.options,
            "correct_index": self.correct_index,
            "explanation": self.explanation,
            "time_limit": self.time_limit
        }

@dataclass
class ContextSynthesisQuestion:
    """Stage 3: Recursive Vocabulary Synthesis Question.
    Composed of 80% learned words (Score >= 2) + 20% target new word.
    Integrates Discute error diagnoses & teacherai Socratic hints.
    """
    id: str
    target_word: str
    word_id: str
    learned_words_used: List[str]  # 80% learned words embedded in context
    masked_sentence: str           # Sentence with blank: "The government took measures to _______ ..."
    full_sentence: str
    vietnamese_translation: str
    options: List[str]             # 4 choices
    correct_index: int
    error_tag: str                 # e.g. "[LỖI-COLLOCATION]" or "[LỖI-SẮC THÁI]"
    root_cause_explanation: str    # Why wrong choices fail
    band_75_upgrade: str           # Academic Band 7.5 model sentence
    band_85_upgrade: str           # Academic Band 8.5 model sentence
    socratic_hint: str             # Minimalist Lego clue (teacherai)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "target_word": self.target_word,
            "word_id": self.word_id,
            "learned_words_used": self.learned_words_used,
            "masked_sentence": self.masked_sentence,
            "full_sentence": self.full_sentence,
            "vietnamese_translation": self.vietnamese_translation,
            "options": self.options,
            "correct_index": self.correct_index,
            "error_tag": self.error_tag,
            "root_cause_explanation": self.root_cause_explanation,
            "band_75_upgrade": self.band_75_upgrade,
            "band_85_upgrade": self.band_85_upgrade,
            "socratic_hint": self.socratic_hint
        }

@dataclass
class FSRSCardState:
    """FSRS v5 memory state for Spaced Repetition (ts-fsrs algorithm)."""
    word_id: str
    difficulty: float = 4.0      # D: 1.0 (very easy) to 10.0 (very hard)
    stability: float = 1.0       # S: Memory stability in days
    retrievability: float = 1.0  # R: Probability of recall at current time
    reps: int = 0                # Total successful repetitions
    lapses: int = 0              # Total failed reviews
    current_score: float = 1.0   # Mapped score: 1.0 to 7.0
    last_review: str = ""        # ISO date string
    next_review: str = ""        # ISO date string

    def to_dict(self) -> Dict[str, Any]:
        return {
            "word_id": self.word_id,
            "difficulty": round(self.difficulty, 2),
            "stability": round(self.stability, 2),
            "retrievability": round(self.retrievability, 2),
            "reps": self.reps,
            "lapses": self.lapses,
            "current_score": round(self.current_score, 1),
            "last_review": self.last_review,
            "next_review": self.next_review
        }
