"""Exam Service: Cambridge 21 Authentic Tests, Evaluation & Linearthinking Decoder.
Decoupled modular loader reading directly from data/exams/*.json.
"""
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from src.config.settings import EXAMS_DIR
from src.models.exam import ReadingPassage, Question

class ExamService:
    def __init__(self, exams_dir: Optional[Path] = None):
        self._exams_dir = exams_dir or EXAMS_DIR
        self._passages: Dict[str, Dict[str, Any]] = {}
        self._load_passages()

    def _load_passages(self):
        """Dynamically load authentic Cambridge 21 fixtures from JSON."""
        if not self._exams_dir.exists():
            return

        json_files = sorted(self._exams_dir.glob("*.json"))
        for jf in json_files:
            try:
                with open(jf, "r", encoding="utf-8") as f:
                    data = json.load(f)

                pid = data.get("id")
                if not pid:
                    continue

                questions = []
                for q in data.get("questions", []):
                    trap = q.get("trap_type") or q.get("trap_tag") or "[TRAP-PARAPHRASE]"
                    questions.append(Question(
                        number=int(q.get("number", 0)),
                        q_type=q.get("q_type", "note"),
                        prompt=q.get("prompt", ""),
                        options=q.get("options", []),
                        correct_answer=q.get("correct_answer", ""),
                        clue_paragraph=q.get("clue_paragraph", ""),
                        clue_text=q.get("clue_text", ""),
                        explanation=q.get("explanation", ""),
                        trap_type=trap,
                        trap_tag=trap
                    ))

                passage = ReadingPassage(
                    id=pid,
                    test_number=int(data.get("test_number", 1)),
                    passage_number=int(data.get("passage_number", 1)),
                    title=data.get("title", ""),
                    subtitle=data.get("subtitle", ""),
                    paragraphs=data.get("paragraphs", []),
                    questions=questions,
                    target_words=data.get("target_words", [])
                )
                self._passages[pid] = passage.to_dict()
            except Exception as e:
                print(f"Warning: Failed to load exam fixture {jf.name}: {e}")

    def get_all_passages(self) -> List[Dict[str, Any]]:
        """Return summary of all loaded Cambridge 21 passages."""
        return [{
            "id": p["id"],
            "test_number": p["test_number"],
            "passage_number": p["passage_number"],
            "title": p["title"],
            "subtitle": p["subtitle"],
            "total_questions": len(p["questions"]),
            "target_words": p.get("target_words", [])
        } for p in self._passages.values()]

    def get_passage(self, pid: str) -> Optional[Dict[str, Any]]:
        """Retrieve complete passage including unabridged text, questions, and clues."""
        return self._passages.get(pid)

    def evaluate_submission(self, pid: str, user_answers: Dict[str, str]) -> Dict[str, Any]:
        """Grade candidate answer sheet, calculate estimated band, and extract trap breakdown."""
        p = self._passages.get(pid)
        if not p:
            return {"error": "Passage not found"}

        correct_count = 0
        details = []
        trap_breakdown = {
            "[TRAP-PARAPHRASE]": 0,
            "[TRAP-ATTRIBUTION]": 0,
            "[TRAP-EXTREME]": 0,
            "[NOT-GIVEN / OVER-INFERENCE]": 0
        }

        questions = p["questions"]
        for q in questions:
            q_num_str = str(q["number"])
            u_ans = user_answers.get(q_num_str, "").strip().upper()
            c_ans = q["correct_answer"].strip().upper()

            is_correct = (u_ans == c_ans)
            if is_correct:
                correct_count += 1
            else:
                trap = q.get("trap_type") or q.get("trap_tag") or "[TRAP-PARAPHRASE]"
                if trap in trap_breakdown:
                    trap_breakdown[trap] += 1
                else:
                    trap_breakdown["[TRAP-PARAPHRASE]"] += 1

            details.append({
                "number": q["number"],
                "user_answer": user_answers.get(q_num_str, ""),
                "correct_answer": q["correct_answer"],
                "is_correct": is_correct,
                "clue_paragraph": q.get("clue_paragraph", ""),
                "clue_text": q.get("clue_text", ""),
                "explanation": q["explanation"],
                "trap_type": q.get("trap_type", q.get("trap_tag", "")),
                "trap_tag": q.get("trap_tag", q.get("trap_type", ""))
            })

        total = len(questions)
        pct = (correct_count / total) * 100 if total > 0 else 0
        band = "5.5"
        if pct >= 90: band = "8.5 - 9.0"
        elif pct >= 80: band = "7.5 - 8.0"
        elif pct >= 68: band = "7.0"
        elif pct >= 55: band = "6.5"
        elif pct >= 45: band = "6.0"

        return {
            "passage_id": pid,
            "passage_title": p["title"],
            "total_questions": total,
            "correct_answers": correct_count,
            "percentage": round(pct, 1),
            "estimated_band": band,
            "trap_breakdown": trap_breakdown,
            "details": details
        }

# Global singleton
exam_service = ExamService()
