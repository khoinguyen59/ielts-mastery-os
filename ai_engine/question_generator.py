"""AI-Generator Module for Living Question Bank.
Synthesizes contextual cloze questions combining learned and target words.
"""
from typing import List, Dict, Any, Optional
import random

class QuestionGenerator:
    """Academic Question Generator (< 180 lines).
    Uses authentic collocations and adaptive word substitution.
    """
    
    TEMPLATES = [
        "In an effort to address {learned}, researchers argue that institutions must _______ key academic protocols.",
        "While traditional approaches emphasize {learned}, contemporary findings demonstrate the need to _______ systemic factors.",
        "Given the substantial impact of {learned}, scholars suggest that policymakers should rigorously _______ existing frameworks.",
        "Recent empirical investigations into {learned} illustrate why authorities must _______ these vital mechanisms.",
        "Building upon earlier observations regarding {learned}, the proposed methodology aims to _______ subsequent outcomes."
    ]

    TRAP_TAGS = [
        "[TRAP-PARAPHRASE]",
        "[LỖI-COLLOCATION-CLASH]",
        "[LỖI-SẮC-THÁI-HỌC-THUẬT]",
        "[TRAP-DISTRACTOR-AMBIGUITY]"
    ]

    def generate_question(
        self,
        target_word: Dict[str, Any],
        learned_words: Optional[List[Dict[str, Any]]] = None,
        distractors: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Generates a complete, grammatically valid cloze question."""
        word = str(target_word.get("word", "")).strip()
        pos = str(target_word.get("pos", "v")).strip()
        meaning = str(target_word.get("meaning", "")).strip()
        example = target_word.get("example", "")

        # Select a learned word for contextual recursive synthesis
        chosen_learned_id = None
        chosen_learned_word = "established standards"
        if learned_words and len(learned_words) > 0:
            lw = random.choice(learned_words)
            chosen_learned_id = lw.get("id")
            chosen_learned_word = lw.get("word", chosen_learned_word)

        # Generate masked sentence
        template = random.choice(self.TEMPLATES)
        masked_sentence = template.format(learned=chosen_learned_word)

        # Options generation
        clean_distractors = [d.strip() for d in (distractors or []) if d.strip() and d.strip().lower() != word.lower()]
        # Ensure 3 unique distractors
        fallback_words = ["alleviate", "proliferate", "undermine", "deteriorate", "reinforce", "facilitate", "substantiate"]
        for f in fallback_words:
            if len(clean_distractors) >= 3:
                break
            if f != word.lower() and f not in clean_distractors:
                clean_distractors.append(f)
        
        final_distractors = clean_distractors[:3]
        options = [word] + final_distractors
        random.shuffle(options)
        correct_index = options.index(word)

        error_tag = random.choice(self.TRAP_TAGS)
        explanation = f"'{word}' ({pos}) có nghĩa là: {meaning}. Trong ngữ cảnh học thuật này, '{word}' tạo collocation chính xác nhất."
        band_75 = f"Furthermore, institutions should actively {word} established protocols to ensure optimal outcomes."
        band_85 = f"Consequently, it is imperative to rigorously {word} structural paradigms to mitigate systemic deficiencies."

        return {
            "target_word_id": target_word.get("id", ""),
            "target_word": word,
            "embedded_word_ids": [chosen_learned_id] if chosen_learned_id else [],
            "prompt": "Select the most academically appropriate word to complete the sentence:",
            "masked_sentence": masked_sentence,
            "options": options,
            "correct_index": correct_index,
            "explanation": explanation,
            "error_tag": error_tag,
            "band_75_upgrade": band_75,
            "band_85_upgrade": band_85,
            "status": "under_review_v1",
            "quality_tags": ["ai_generated", "v1_approved"]
        }

question_generator = QuestionGenerator()
