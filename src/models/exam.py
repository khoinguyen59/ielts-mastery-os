"""Exam & Reading Passage Data Models."""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

@dataclass
class Question:
    number: int
    q_type: str                   # "tfng", "matching", "mcq", "summary", "table", "note", "people", "ynng"
    prompt: str
    options: List[str] = field(default_factory=list)
    correct_answer: str = ""
    clue_paragraph: str = ""
    clue_text: str = ""
    explanation: str = ""
    trap_type: str = ""           # "[TRAP-PARAPHRASE]", "[TRAP-ATTRIBUTION]", "[TRAP-EXTREME]", "[NOT-GIVEN / OVER-INFERENCE]"
    trap_tag: str = ""

    def to_dict(self) -> Dict[str, Any]:
        tag = self.trap_tag or self.trap_type
        t_type = self.trap_type or self.trap_tag
        return {
            "number": self.number,
            "q_type": self.q_type,
            "prompt": self.prompt,
            "options": self.options,
            "correct_answer": self.correct_answer,
            "clue_paragraph": self.clue_paragraph,
            "clue_text": self.clue_text,
            "explanation": self.explanation,
            "trap_type": t_type,
            "trap_tag": tag
        }


@dataclass
class ReadingPassage:
    id: str                       # e.g., "t1_p1"
    test_number: int              # 1
    passage_number: int           # 1
    title: str
    subtitle: str
    paragraphs: List[Dict[str, str]] = field(default_factory=list) # [{"label": "[A]", "text": "..."}]
    questions: List[Question] = field(default_factory=list)
    target_words: List[str] = field(default_factory=list) # IDs like ["#001", "#050"]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "test_number": self.test_number,
            "passage_number": self.passage_number,
            "title": self.title,
            "subtitle": self.subtitle,
            "paragraphs": self.paragraphs,
            "questions": [q.to_dict() for q in self.questions],
            "target_words": self.target_words
        }
