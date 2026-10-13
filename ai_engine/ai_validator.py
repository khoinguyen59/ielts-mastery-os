"""AI Validation Engine (AI-Validator-1 & AI-Validator-2).
Automates Tri-Tier Question Quality Control and Ambiguity Detection.
"""
from typing import List, Dict, Any

class AIValidator:
    def __init__(self):
        pass

    def validate_question_tier1(self, question: Dict[str, Any]) -> Dict[str, Any]:
        """AI-Validator-1: Pre-publication syntax and morphological integrity check."""
        errors: List[str] = []
        options = question.get("options", [])
        correct_index = question.get("correct_index", -1)
        prompt = question.get("prompt", "")

        # 1. Option count check
        if not isinstance(options, list) or len(options) != 4:
            errors.append("Question must contain exactly 4 options.")

        # 2. Duplicate options check
        cleaned_opts = [str(o).strip().lower() for o in options]
        if len(set(cleaned_opts)) != len(cleaned_opts):
            errors.append("Options contain duplicate choices.")

        # 3. Correct index boundary
        if not (0 <= correct_index <= 3):
            errors.append("correct_index must be an integer between 0 and 3.")

        # 4. Prompt content check
        if not prompt or len(prompt.strip()) < 5:
            errors.append("Prompt is empty or excessively brief.")

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "tier": "ai_validator_1"
        }

    def validate_dispute_tier2(self, question: Dict[str, Any], feedback_reason: str) -> Dict[str, Any]:
        """AI-Validator-2: Independent secondary arbitration upon user feedback dispute."""
        t1 = self.validate_question_tier1(question)
        if not t1["valid"]:
            return {
                "valid": False,
                "verdict": "question_defective",
                "recommended_action": "reject_or_edit",
                "errors": t1["errors"],
                "tier": "ai_validator_2"
            }

        options = question.get("options", [])
        correct_index = question.get("correct_index", 0)
        correct_word = options[correct_index].strip().lower()

        # Check for near-identical distractors that cause genuine ambiguity
        distractors = [options[i].strip().lower() for i in range(len(options)) if i != correct_index]
        ambiguous = []
        for d in distractors:
            if d == correct_word or d in correct_word or correct_word in d:
                # Potential overlap
                if len(d) > 3 and len(correct_word) > 3 and abs(len(d) - len(correct_word)) <= 2:
                    ambiguous.append(d)

        if ambiguous and feedback_reason in ("two_correct_answers", "ambiguous_answer"):
            return {
                "valid": False,
                "verdict": "ambiguity_confirmed",
                "recommended_action": "admin_review",
                "errors": [f"Potential distractor clash between '{correct_word}' and '{', '.join(ambiguous)}'."],
                "tier": "ai_validator_2"
            }

        return {
            "valid": True,
            "verdict": "question_academically_sound",
            "recommended_action": "maintain_active",
            "errors": [],
            "tier": "ai_validator_2"
        }

ai_validator = AIValidator()
