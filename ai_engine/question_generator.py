"""AI-Generator Module for Living Question Bank.
Synthesizes contextual cloze questions combining learned and target words.
Enforces Comprehensible Input (i + 1) and Thematic Clustering.
"""
from typing import List, Dict, Any, Optional
import random

THEMATIC_CLUSTERS = [
    {"fund", "finance", "promote", "contemporary", "bulk", "establish", "community", "heritage"},
    {"adequate", "approach", "aware", "benefit", "detract", "ensure", "environment", "silence"},
    {"conflict", "display", "isolation", "alleviate", "crisis", "cohesion", "solidarity"},
    {"period", "innovation", "benefit", "initial", "sustainable", "ecological"},
    {"empirical", "hypothesis", "methodology", "paradigm", "substantiate", "systemic", "undermine"}
]

class QuestionGenerator:
    """Academic Question Generator (< 180 lines).
    Uses authentic collocations and adaptive word substitution.
    """
    
    SINGLE_TEMPLATES = [
        "In an effort to address {learned}, researchers argue that institutions must _______ key academic protocols.",
        "While traditional approaches emphasize {learned}, contemporary findings demonstrate the need to _______ systemic factors.",
        "Given the substantial impact of {learned}, scholars suggest that policymakers should rigorously _______ existing frameworks.",
        "Recent empirical investigations into {learned} illustrate why authorities must _______ these vital mechanisms.",
        "Building upon earlier observations regarding {learned}, the proposed methodology aims to _______ subsequent outcomes."
    ]

    DUAL_TEMPLATES = [
        "In light of {learned_1} and its complex relationship with {learned_2}, researchers emphasize the need to _______ key protocols.",
        "While {learned_1} remains critical, addressing {learned_2} requires policymakers to rigorously _______ systemic paradigms.",
        "Recent studies analyzing {learned_1} alongside {learned_2} demonstrate why institutions must _______ these mechanisms.",
        "To reconcile the challenges of {learned_1} with the effects of {learned_2}, scholars propose to _______ overarching frameworks."
    ]

    TRAP_TAGS = [
        "[LỖI-COLLOCATION-CLASH]",
        "[LỖI-SẮC-THÁI-HỌC-THUẬT]",
        "[LỖI-PARAPHRASE]",
        "[TRAP-DISTRACTOR-AMBIGUITY]"
    ]

    def _select_thematic_learned_words(
        self,
        target_word: Dict[str, Any],
        learned_words: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Scores candidate learned words using thematic affinity (passage/cluster/synonyms/antonyms/collocations/pos)."""
        t_word = str(target_word.get("word", "")).lower()
        target_syn = str(target_word.get("synonyms", target_word.get("synonym", ""))).lower()
        target_ant = str(target_word.get("antonyms", target_word.get("antonym", ""))).lower()
        target_col = str(target_word.get("collocations", target_word.get("key_collocation", ""))).lower()
        target_pos = str(target_word.get("pos", "")).lower()

        target_cluster = None
        for cluster in THEMATIC_CLUSTERS:
            if any(t in t_word or t_word in t for t in cluster):
                target_cluster = cluster
                break

        scored = []
        for lw in learned_words:
            w_str = str(lw.get("word", "")).lower()
            score = 0
            if target_cluster and any(w in w_str or w_str in w for w in target_cluster):
                score += 15
            if w_str in target_syn:
                score += 10
            if w_str in target_ant:
                score += 8
            if w_str in target_col:
                score += 6
            if str(lw.get("pos", "")).lower() == target_pos:
                score += 2
            scored.append((score, lw))

        scored.sort(key=lambda x: x[0], reverse=True)
        take_count = min(2, len(scored)) if len(scored) >= 2 and scored[0][0] > 0 else 1
        return [item[1] for item in scored[:take_count]]

    def generate_question(
        self,
        target_word: Dict[str, Any],
        learned_words: Optional[List[Dict[str, Any]]] = None,
        distractors: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Generates a complete, grammatically valid cloze question following i + 1."""
        word = str(target_word.get("word", "")).strip()
        pos = str(target_word.get("pos", "v")).strip()
        meaning = str(target_word.get("meaning", "")).strip()

        # Thematic selection of learned background words (Golden ratio: 1 to 2 words max)
        chosen_learned_ids: List[str] = []
        if learned_words and len(learned_words) > 0:
            selected_lws = self._select_thematic_learned_words(target_word, learned_words)
            chosen_learned_ids = [lw.get("id", "") for lw in selected_lws if lw.get("id")]
            if len(selected_lws) >= 2:
                template = random.choice(self.DUAL_TEMPLATES)
                masked_sentence = template.format(
                    learned_1=selected_lws[0].get("word", "structural factors"),
                    learned_2=selected_lws[1].get("word", "institutional frameworks")
                )
            else:
                template = random.choice(self.SINGLE_TEMPLATES)
                masked_sentence = template.format(
                    learned=selected_lws[0].get("word", "established standards")
                )
        else:
            template = random.choice(self.SINGLE_TEMPLATES)
            masked_sentence = template.format(learned="established standards")

        # Options generation
        clean_distractors = [d.strip() for d in (distractors or []) if d.strip() and d.strip().lower() != word.lower()]
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
            "embedded_word_ids": chosen_learned_ids,
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
