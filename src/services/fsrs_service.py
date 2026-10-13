"""FSRS Service: Modern Free Spaced Repetition Scheduler (v5).
Inspired by ts-fsrs algorithm, calculates Memory Stability (S),
Difficulty (D), Retrievability (R), and maps directly to IELTS 1.0–7.0 score.
"""
import math
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from src.models.quiz_models import FSRSCardState

# FSRS v5 Default Baseline Parameters
W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 0.22695, 0.5698, 2.85535]
FACTOR = 19.0 / 81.0
DECAY = -0.5

class FSRSService:
    def __init__(self):
        self._states: Dict[str, FSRSCardState] = {}

    def get_or_create_state(self, word_id: str, initial_score: float = 1.0) -> FSRSCardState:
        if word_id not in self._states:
            now_str = datetime.now(timezone.utc).isoformat()
            self._states[word_id] = FSRSCardState(
                word_id=word_id,
                difficulty=4.5,
                stability=1.0,
                retrievability=1.0,
                reps=0,
                lapses=0,
                current_score=initial_score,
                last_review=now_str,
                next_review=now_str
            )
        return self._states[word_id]

    def calculate_retrievability(self, stability: float, elapsed_days: float) -> float:
        """R(t, S) = (1 + factor * t / S) ^ decay"""
        if stability <= 0:
            return 0.0
        return math.pow(1.0 + FACTOR * (elapsed_days / stability), DECAY)

    def review_card(self, word_id: str, rating: int, elapsed_days: float = 1.0) -> FSRSCardState:
        """Review card with rating: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)."""
        card = self.get_or_create_state(word_id)
        now = datetime.now(timezone.utc)
        
        # 1. Update difficulty
        # delta_d = -w[6] * (rating - 3)
        delta_d = -W[6] * (rating - 3.0)
        card.difficulty = min(10.0, max(1.0, card.difficulty + delta_d))

        # 2. Update stability
        if rating == 1:
            # Lapse / Fail
            card.lapses += 1
            card.reps = 0
            # S_lapse = w[11] * (d ^ -w[12]) * ((s + 1) ^ w[13]) * exp((1-r) * w[14])
            card.stability = max(0.5, W[11] * math.pow(card.difficulty, -W[12]) * math.pow(card.stability + 1, W[13]))
        else:
            # Success
            card.reps += 1
            if card.reps == 1:
                # Initial stability
                card.stability = W[rating - 1]
            else:
                # Subsequent stability multiplier
                hard_penalty = W[15] if rating == 2 else 1.0
                easy_bonus = W[16] if rating == 4 else 1.0
                card.stability = card.stability * (1.0 + hard_penalty * easy_bonus * math.exp(W[8]) * math.pow(card.difficulty, -W[9]))

        # 3. Next review interval (target retention 90%)
        interval_days = max(1, int(round(card.stability)))
        next_date = now + timedelta(days=interval_days)

        card.retrievability = 1.0
        card.last_review = now.isoformat()
        card.next_review = next_date.isoformat()

        # 4. Map FSRS state to IELTS Memory Score (1.0 - 7.0)
        card.current_score = self._map_to_score(card)
        return card

    def _map_to_score(self, card: FSRSCardState) -> float:
        """Maps stability, difficulty and repetitions into 1.0 - 7.0 score."""
        if card.lapses > 0 and card.reps == 0:
            return 1.0
        if card.reps == 1:
            return 2.0
        elif card.reps == 2:
            return 3.0
        elif card.reps == 3:
            return 4.0
        elif card.reps >= 4 and card.stability < 20:
            return 5.0
        elif card.stability >= 20 and card.stability < 45:
            return 6.0
        elif card.stability >= 45:
            return 7.0
        return min(7.0, max(1.0, 1.0 + card.reps * 0.8))

    def get_learned_word_ids(self) -> list:
        """Returns list of word_ids where current_score >= 2.0 (qualified for synthesis)."""
        return [wid for wid, c in self._states.items() if c.current_score >= 2.0]

fsrs_service = FSRSService()
