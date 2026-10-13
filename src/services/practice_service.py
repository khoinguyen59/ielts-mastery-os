"""Practice Service: Dynamic Quiz Blitz Generation & Spaced Repetition Practice."""
import random
from typing import List, Dict, Any, Optional
from src.services.vocab_service import vocab_service

class PracticeService:
    def __init__(self):
        pass

    def generate_quiz_round(self, count: int = 10, topic_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        words = vocab_service.get_all()
        if not words or len(words) < 4:
            return []

        # Sample target words
        count = min(count, len(words))
        target_words = random.sample(words, count)
        questions: List[Dict[str, Any]] = []

        q_types = ["en_to_vi", "vi_to_en", "synonym", "collocation"]

        for idx, tw in enumerate(target_words):
            q_type = random.choice(q_types)
            
            # Fallback if synonym/collocation is empty
            if q_type == "synonym" and not tw.get("synonym"):
                q_type = "en_to_vi"
            if q_type == "collocation" and not tw.get("key_collocation"):
                q_type = "vi_to_en"

            # 3 distractors
            pool = [w for w in words if w["id"] != tw["id"]]
            distractors = random.sample(pool, 3)

            if q_type == "en_to_vi":
                correct = tw["meaning"]
                d_opts = [d["meaning"] for d in distractors]
                options = [correct] + d_opts
                random.shuffle(options)
                correct_idx = options.index(correct)
                questions.append({
                    "id": f"q_{idx+1}",
                    "type": "en_to_vi",
                    "badge": "Anh -> Việt",
                    "prompt": f"Nghĩa học thuật của từ '{tw['word']}' ({tw.get('pos', '')}) là gì?",
                    "target_word": tw["word"],
                    "word_id": tw["id"],
                    "ipa": tw.get("ipa", ""),
                    "options": options,
                    "correct_index": correct_idx,
                    "explanation": f"'{tw['word']}' ({tw.get('pos','')}) {tw.get('ipa','')}: {tw['meaning']}. Ví dụ: {tw.get('example','')}",
                    "time_limit": 10
                })

            elif q_type == "vi_to_en":
                correct = tw["word"]
                d_opts = [d["word"] for d in distractors]
                options = [correct] + d_opts
                random.shuffle(options)
                correct_idx = options.index(correct)
                questions.append({
                    "id": f"q_{idx+1}",
                    "type": "vi_to_en",
                    "badge": "Việt -> Anh",
                    "prompt": f"Từ học thuật nào diễn đạt nghĩa: \"{tw['meaning']}\"?",
                    "target_word": tw["word"],
                    "word_id": tw["id"],
                    "ipa": tw.get("ipa", ""),
                    "options": options,
                    "correct_index": correct_idx,
                    "explanation": f"Chính xác là '{tw['word']}' ({tw.get('pos','')}) {tw.get('ipa','')}. Collocation: {tw.get('key_collocation','')}",
                    "time_limit": 10
                })

            elif q_type == "synonym":
                syn_target = tw["synonym"].split(",")[0].strip()
                correct = syn_target
                d_opts = []
                for d in distractors:
                    d_syn = d.get("synonym", "").split(",")[0].strip() or d["word"]
                    d_opts.append(d_syn)
                options = [correct] + d_opts[:3]
                random.shuffle(options)
                correct_idx = options.index(correct)
                questions.append({
                    "id": f"q_{idx+1}",
                    "type": "synonym",
                    "badge": "Academic Synonym",
                    "prompt": f"Từ nào đồng nghĩa/paraphrase tốt nhất với '{tw['word']}'?",
                    "target_word": tw["word"],
                    "word_id": tw["id"],
                    "ipa": tw.get("ipa", ""),
                    "options": options,
                    "correct_index": correct_idx,
                    "explanation": f"'{tw['word']}' đồng nghĩa với '{tw['synonym']}'. Nghĩa: {tw['meaning']}.",
                    "time_limit": 10
                })

            else: # Collocation fill-in
                colloc = tw["key_collocation"].split(";")[0].strip()
                # Mask the word
                masked_colloc = colloc.replace(tw["word"], "_______").replace(tw["word"].capitalize(), "_______")
                if "_______" not in masked_colloc:
                    masked_colloc = f"_______ ({colloc})"
                correct = tw["word"]
                d_opts = [d["word"] for d in distractors]
                options = [correct] + d_opts
                random.shuffle(options)
                correct_idx = options.index(correct)
                questions.append({
                    "id": f"q_{idx+1}",
                    "type": "collocation",
                    "badge": "Academic Collocation",
                    "prompt": f"Chọn từ hoàn thiện cụm Collocation: \"{masked_colloc}\"",
                    "target_word": tw["word"],
                    "word_id": tw["id"],
                    "ipa": tw.get("ipa", ""),
                    "options": options,
                    "correct_index": correct_idx,
                    "explanation": f"Cụm collocation chuẩn: '{colloc}'. Nghĩa: {tw['meaning']}.",
                    "time_limit": 10
                })

        return questions

practice_service = PracticeService()
