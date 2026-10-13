"""Recursive Vocabulary Synthesis Service.
Generates Stage 3 Context Questions composed of:
80% learned words (Score >= 2) + 20% target new words.
Integrates Discute root cause error tags & teacherai Socratic clues.
"""
import random
import re
from typing import List, Dict, Any, Optional
from src.services.vocab_service import vocab_service
from src.models.quiz_models import ContextSynthesisQuestion

class SynthesisService:
    def __init__(self):
        pass

    def get_learned_words_pool(self) -> List[Dict[str, Any]]:
        """Retrieve learned words with score >= 2.0 from vocab service."""
        all_words = vocab_service.get_all()
        learned = [w for w in all_words if float(w.get("score", 1.0)) >= 2.0]
        # Cold start fallback: pick top 30 foundational AWL words
        if len(learned) < 5:
            learned = all_words[:30]
        return learned

    def generate_synthesis_question(self, target_word_dict: Dict[str, Any]) -> ContextSynthesisQuestion:
        """Compose a Stage 3 question embedding learned words + target word."""
        tw = target_word_dict
        target_word = tw["word"]
        target_pos = tw.get("pos", "")
        all_words = vocab_service.get_all()
        learned_pool = self.get_learned_words_pool()

        # Select 2-3 learned context words (different from target)
        available_learned = [w for w in learned_pool if w["word"].lower() != target_word.lower()]
        sample_count = min(3, len(available_learned))
        chosen_learned = random.sample(available_learned, sample_count) if sample_count > 0 else []
        learned_names = [w["word"] for w in chosen_learned]

        # Authentic academic sentence templates pairing target word with learned words
        base_example = tw.get("example", "")
        colloc = tw.get("key_collocation", "").split(";")[0].strip() or tw.get("collocations", "").split(";")[0].strip()

        # Build sentence with embedded learned words
        if base_example and len(chosen_learned) >= 1:
            # Weave learned words into the academic prompt
            lw1 = chosen_learned[0]["word"]
            lw2 = chosen_learned[1]["word"] if len(chosen_learned) > 1 else ""
            if lw2:
                context_prefix = f"In an effort to {lw1} while acknowledging {lw2}, "
            else:
                context_prefix = f"Despite ongoing efforts to {lw1}, "
            
            # Formulate full sentence
            full_sentence = f"{context_prefix}{base_example[0].lower() + base_example[1:]}"
            # Ensure proper punctuation
            if not full_sentence.endswith("."):
                full_sentence += "."
        elif base_example:
            full_sentence = base_example
        else:
            full_sentence = f"Scholars have noted that measures to {colloc} remain crucial for long-term policy development."

        # Mask target word (case-insensitive)
        pattern = re.compile(re.escape(target_word), re.IGNORECASE)
        masked_sentence = pattern.sub("_______", full_sentence)
        if "_______" not in masked_sentence:
            # Mask based on root or place blank before collocation
            masked_sentence = f"Scholars emphasize that we must _______ {colloc} to ensure stability."

        # Pick 3 academic distractors (same POS preferred)
        same_pos_distractors = [w for w in all_words if w.get("pos") == target_pos and w["word"].lower() != target_word.lower()]
        if len(same_pos_distractors) < 3:
            same_pos_distractors = [w for w in all_words if w["word"].lower() != target_word.lower()]
        
        distractor_sample = random.sample(same_pos_distractors, 3)
        options = [target_word] + [d["word"] for d in distractor_sample]
        random.shuffle(options)
        correct_idx = options.index(target_word)

        # Discute Diagnostic Error Tags & Upgrades
        error_tags = ["[LỖI-COLLOCATION]", "[LỖI-SẮC THÁI]", "[LỖI-PARAPHRASE]"]
        error_tag = random.choice(error_tags)
        
        d_names = [d["word"] for d in distractor_sample]
        root_cause = (
            f"Các lựa chọn {', '.join(d_names)} không tạo thành cụm collocation tự nhiên với '{colloc}'. "
            f"Từ đúng là '{target_word}' mang sắc thái '{tw.get('meaning', '')}'."
        )

        band_75 = f"Furthermore, policymakers should actively {colloc} to mitigate widespread systemic risks."
        band_85 = f"Consequently, an imperative emerges to rigorously {colloc}, thereby preempting cascading structural collapse."

        # teacherai Minimalist Socratic Clues (Invariant 16: zero full clues)
        roots = tw.get("lego_roots", "")
        hint_pieces = []
        if roots:
            hint_pieces.append(f"Gốc từ: {roots}")
        hint_pieces.append(f"Từ loại: [{target_pos}]")
        if colloc:
            colloc_hint = colloc.replace(target_word, "...")
            hint_pieces.append(f"Cụm đi kèm: '{colloc_hint}'")
        socratic_hint = " • ".join(hint_pieces)

        return ContextSynthesisQuestion(
            id=f"synth_{tw.get('id', random.randint(100, 999))}",
            target_word=target_word,
            word_id=tw.get("id", ""),
            learned_words_used=learned_names,
            masked_sentence=masked_sentence,
            full_sentence=full_sentence,
            vietnamese_translation=f"Ngữ cảnh luyện tập: {tw.get('meaning', '')} (Củng cố từ cũ: {', '.join(learned_names) if learned_names else 'Nền tảng'}).",
            options=options,
            correct_index=correct_idx,
            error_tag=error_tag,
            root_cause_explanation=root_cause,
            band_75_upgrade=band_75,
            band_85_upgrade=band_85,
            socratic_hint=socratic_hint
        )

    def generate_synthesis_round(self, count: int = 5) -> List[Dict[str, Any]]:
        """Generate a round of Stage 3 synthesis questions."""
        all_words = vocab_service.get_all()
        if not all_words:
            return []
        count = min(count, len(all_words))
        targets = random.sample(all_words, count)
        questions = []
        for t in targets:
            q = self.generate_synthesis_question(t)
            questions.append(q.to_dict())
        return questions

synthesis_service = SynthesisService()
