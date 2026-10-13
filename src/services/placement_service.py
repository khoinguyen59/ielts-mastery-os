"""Placement Service: Diagnostic Placement Test & Initial Level Assessment.
Evaluates student starting level (Band 3.0 to 8.5+) and configures
the personalized Spaced Repetition (FSRS v5) learning trajectory.
"""
from typing import List, Dict, Any, Optional
from src.services.vocab_service import vocab_service
from src.services.fsrs_service import fsrs_service

LEVEL_PRESETS = {
    "starter": {
        "title": "Khởi Đầu / Mất Gốc (Target Band 3.0 - 4.0)",
        "band": "3.5",
        "description": "Xây dựng ngữ âm IPA, 100 từ vựng sinh tồn A1-A2 cơ bản, phản xạ nghe - nói 5-10 từ/ngày.",
        "starting_vocab_score": 1.0,
        "recommended_daily": 8,
        "fsrs_initial_stability": 0.5,
        "fsrs_target_retention": 0.85
    },
    "foundation": {
        "title": "Sơ Cấp / Nền Tảng (Target Band 4.5 - 5.0)",
        "band": "5.0",
        "description": "Củng cố 150 từ vựng cốt lõi B1, ngữ pháp câu thông dụng.",
        "starting_vocab_score": 1.5,
        "recommended_daily": 10,
        "fsrs_initial_stability": 1.0,
        "fsrs_target_retention": 0.88
    },
    "intermediate": {
        "title": "Trung Cấp (Target Band 5.5 - 6.5)",
        "band": "6.5",
        "description": "Mở rộng 300 từ học thuật AWL B2, rèn luyện Collocation mạnh và phân biệt sắc thái.",
        "starting_vocab_score": 2.0,
        "recommended_daily": 15,
        "fsrs_initial_stability": 1.5,
        "fsrs_target_retention": 0.90
    },
    "advanced": {
        "title": "Nâng Cao (Target Band 7.0 - 7.5)",
        "band": "7.5",
        "description": "Làm chủ 450 từ Master B2-C1, giải mã bẫy Linearthinking và thực chiến Cambridge 21.",
        "starting_vocab_score": 3.0,
        "recommended_daily": 20,
        "fsrs_initial_stability": 2.5,
        "fsrs_target_retention": 0.90
    },
    "mastery": {
        "title": "Xuất Sắc (Target Band 8.0 - 8.5+)",
        "band": "8.5",
        "description": "Tinh hoa C1-C2, tối ưu hóa phản xạ tự nhiên chuẩn bản xứ, kỹ xảo câu phức Task 2.",
        "starting_vocab_score": 4.0,
        "recommended_daily": 25,
        "fsrs_initial_stability": 4.0,
        "fsrs_target_retention": 0.92
    }
}

class PlacementService:
    def __init__(self):
        pass

    def get_level_presets(self) -> Dict[str, Any]:
        """Return available 5-tier preset learning levels for direct selection."""
        return LEVEL_PRESETS

    def generate_diagnostic_test(self, count: int = 8) -> List[Dict[str, Any]]:
        """Generate an adaptive 8-question tiered diagnostic test spanning A2 to C2."""
        all_words = vocab_service.get_all()
        if not all_words or len(all_words) < 20:
            return []

        tier_indices = [
            (0, 50, "3.5 - 4.0", "A2 Survival"),
            (51, 150, "5.0 - 5.5", "B1/B2 Foundation"),
            (151, 300, "6.5 - 7.5", "B2+/C1 Academic"),
            (301, min(450, len(all_words)-1), "8.0 - 8.5+", "C1/C2 Mastery")
        ]

        questions = []
        q_id = 1
        for start_idx, end_idx, band_label, tier_name in tier_indices:
            slice_pool = all_words[start_idx:min(end_idx, len(all_words))]
            if not slice_pool:
                slice_pool = all_words[:10]

            for _ in range(2):
                tw = slice_pool[(q_id * 7) % len(slice_pool)]
                target_word = tw["word"]
                correct_meaning = tw["meaning"]

                distractors = [w for w in all_words if w["word"] != target_word]
                distractor_meanings = [d["meaning"] for d in distractors[(q_id * 11) % len(distractors):(q_id * 11) % len(distractors) + 3]]
                if len(distractor_meanings) < 3:
                    distractor_meanings = [d["meaning"] for d in distractors[:3]]

                options = [correct_meaning] + distractor_meanings[:3]
                shift = q_id % 4
                options = options[shift:] + options[:shift]
                correct_idx = options.index(correct_meaning)

                questions.append({
                    "id": f"diag_{q_id}",
                    "tier": tier_name,
                    "target_band": band_label,
                    "word": target_word,
                    "pos": tw.get("pos", ""),
                    "ipa": tw.get("ipa", ""),
                    "prompt": f"Nghĩa học thuật của từ '{target_word}' ({tw.get('pos','')}) là gì?",
                    "options": options,
                    "correct_index": correct_idx,
                    "key_collocation": tw.get("key_collocation", ""),
                    "explanation": f"'{target_word}': {correct_meaning}. Collocation: '{tw.get('key_collocation','')}'."
                })
                q_id += 1
                if len(questions) >= count:
                    break
            if len(questions) >= count:
                break

        return questions

    def evaluate_test(self, user_answers: Dict[str, int]) -> Dict[str, Any]:
        """Grade diagnostic test, estimate baseline Band, and return customized FSRS plan."""
        diag_questions = self.generate_diagnostic_test(count=8)
        total_questions = len(diag_questions)
        correct_count = 0

        for q in diag_questions:
            q_id = q["id"]
            if q_id in user_answers and user_answers[q_id] == q["correct_index"]:
                correct_count += 1

        accuracy = (correct_count / total_questions) if total_questions > 0 else 0.0

        if correct_count <= 1:
            assigned_key = "starter"
            est_band = "3.5 - 4.0"
            feedback = "Lộ trình khởi đầu xây dựng phản xạ ngữ âm và 100 từ vựng sinh tồn A1-A2."
        elif correct_count <= 3:
            assigned_key = "foundation"
            est_band = "4.5 - 5.0"
            feedback = "Bạn có nền tảng ban đầu. Hệ thống củng cố 150 từ vựng cốt lõi B1."
        elif correct_count <= 5:
            assigned_key = "intermediate"
            est_band = "5.5 - 6.5"
            feedback = "Vốn từ khá tốt! Hệ thống tập trung rèn luyện 300 từ AWL B2 và Collocation."
        elif correct_count <= 7:
            assigned_key = "advanced"
            est_band = "7.0 - 7.5"
            feedback = "Khả năng học thuật xuất sắc! Mở khóa 450 từ Master và bẫy Linearthinking."
        else:
            assigned_key = "mastery"
            est_band = "8.0 - 8.5+"
            feedback = "Trình độ bậc thầy! Tối ưu hóa phản xạ tự nhiên và kỹ xảo điểm cao Task 2."

        preset = LEVEL_PRESETS[assigned_key]

        return {
            "total_questions": total_questions,
            "correct_count": correct_count,
            "accuracy_pct": round(accuracy * 100, 1),
            "estimated_band": est_band,
            "assigned_level_key": assigned_key,
            "assigned_level_title": preset["title"],
            "feedback": feedback,
            "recommended_daily_vocab": preset["recommended_daily"],
            "starting_vocab_score": preset["starting_vocab_score"],
            "fsrs_params": {
                "stability": preset.get("fsrs_initial_stability", 1.0),
                "target_retention": preset.get("fsrs_target_retention", 0.90)
            }
        }

placement_service = PlacementService()
