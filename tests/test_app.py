"""Sanity and Integration Tests for IELTS Mastery OS Application.
Enforces Invariant 05 (Line Cap <= 400) and Data Integrity.
"""
import os
import pytest
from pathlib import Path

from src.config.settings import (
    BASE_DIR, MASTER_VOCAB_FILE, DATA_DIR, PDF_EXPORTS_DIR
)
from src.services.vocab_service import vocab_service
from src.services.exam_service import exam_service
from src.services.writing_service import writing_service
from src.services.analytics_service import analytics_service

def test_data_paths_integrity():
    assert DATA_DIR.exists(), "data/ directory must exist"
    assert MASTER_VOCAB_FILE.exists(), "data/vocab/master_vocab.json must exist"
    assert PDF_EXPORTS_DIR.exists(), "data/pdf_exports/ directory must exist"

def test_vocab_service_loading():
    words = vocab_service.get_all()
    assert len(words) >= 450, f"Expected at least 450 master words, found {len(words)}"
    
    # Test search
    abandon = vocab_service.get_by_id("#001")
    assert abandon is not None
    assert abandon["word"].lower() == "abandon"
    assert abandon["pos"] == "v"

def test_exam_service_passages():
    passages = exam_service.get_all_passages()
    assert len(passages) == 5, f"Expected 5 Cambridge 21 passages, found {len(passages)}"
    
    # Check Davies sisters
    p1 = exam_service.get_passage("t1_p1")
    assert p1 is not None
    assert len(p1["questions"]) == 13

    # Check grading logic
    eval_res = exam_service.evaluate_submission("t1_p1", {"1": "mining", "2": "education"})
    assert eval_res["correct_answers"] == 2
    assert "estimated_band" in eval_res

def test_writing_service_chunks():
    chunks = writing_service.get_chunks()
    assert len(chunks) == 4, f"Expected 4 micro-chunks, found {len(chunks)}"

    chunk1 = writing_service.get_chunk_by_id("chunk_01")
    assert chunk1 is not None
    assert "contemporary" in [tw["word"] for tw in chunk1["target_words"]]

    # Test evaluation
    eval_write = writing_service.evaluate_translation(
        "chunk_01",
        "In contemporary society, the bulk of students pursue education to establish a foundation."
    )
    assert "contemporary" in eval_write["matched_words"]
    assert eval_write["score_ratio"] > 0

def test_analytics_service_summary():
    summary = analytics_service.get_dashboard_summary()
    assert summary["target_band"] == "7.5 - 8.5+"
    assert summary["total_vocab_count"] >= 450
    assert "[TRAP-PARAPHRASE]" in summary["trap_distribution"]

def test_practice_service_quiz_generation():
    from src.services.practice_service import practice_service
    quiz = practice_service.generate_quiz_round(count=10)
    assert len(quiz) == 10, f"Expected 10 quiz questions, got {len(quiz)}"
    for q in quiz:
        assert "prompt" in q
        assert len(q["options"]) == 4
        assert 0 <= q["correct_index"] <= 3
        assert "explanation" in q

def test_fsrs_service_review_and_scoring():
    from src.services.fsrs_service import fsrs_service
    # Initial state
    card = fsrs_service.get_or_create_state("test_w1")
    assert card.current_score == 1.0

    # Successful reviews
    c1 = fsrs_service.review_card("test_w1", rating=3, elapsed_days=1.0)
    assert c1.reps == 1
    assert c1.current_score == 2.0
    assert "test_w1" in fsrs_service.get_learned_word_ids()

    # Second review
    c2 = fsrs_service.review_card("test_w1", rating=3, elapsed_days=3.0)
    assert c2.reps == 2
    assert c2.current_score == 3.0

    # Lapse review
    c_lapse = fsrs_service.review_card("test_w1", rating=1, elapsed_days=1.0)
    assert c_lapse.lapses == 1
    assert c_lapse.reps == 0
    assert c_lapse.current_score == 1.0

def test_synthesis_service_recursive_questions():
    from src.services.synthesis_service import synthesis_service
    round_q = synthesis_service.generate_synthesis_round(count=5)
    assert len(round_q) == 5
    for q in round_q:
        assert "target_word" in q
        assert "masked_sentence" in q
        assert "_______" in q["masked_sentence"]
        assert len(q["options"]) == 4
        assert 0 <= q["correct_index"] <= 3
        assert "[LỖI-" in q["error_tag"]
        assert "band_75_upgrade" in q
        assert "band_85_upgrade" in q
def test_placement_service_diagnostic_and_evaluation():
    from src.services.placement_service import placement_service
    levels = placement_service.get_level_presets()
    assert "foundation" in levels
    assert "mastery" in levels

    diag = placement_service.generate_diagnostic_test(count=8)
    assert len(diag) == 8
    for q in diag:
        assert "target_band" in q
        assert len(q["options"]) == 4
        assert 0 <= q["correct_index"] <= 3

    # Test grading
    eval_res = placement_service.evaluate_test({diag[0]["id"]: diag[0]["correct_index"], diag[1]["id"]: diag[1]["correct_index"]})
    assert eval_res["total_questions"] == 8
    assert "estimated_band" in eval_res
    assert "assigned_level_key" in eval_res

def test_invariant_05_code_cap_under_400_lines():
    """Invariant 05: No source file in src/ may exceed 400 lines."""
    src_dir = BASE_DIR / "src"
    violations = []
    
    for root, _, files in os.walk(src_dir):
        for f in files:
            if f.endswith((".py", ".js", ".css", ".html")):
                full_path = Path(root) / f
                line_count = len(full_path.read_text(encoding="utf-8").splitlines())
                if line_count > 400:
                    violations.append(f"{full_path.relative_to(BASE_DIR)}: {line_count} lines")

    assert not violations, f"Invariant 05 violations (files > 400 lines): {violations}"
