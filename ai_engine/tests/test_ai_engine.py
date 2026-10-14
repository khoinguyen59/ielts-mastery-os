"""Tests for AI Engine: Semantic Scorer & Question Validator."""
import pytest
from ai_engine.semantic_scorer import semantic_scorer
from ai_engine.ai_validator import ai_validator

def test_semantic_scorer_latency_and_accuracy():
    candidate = "In contemporary society, most young people pursue higher education to establish a foundation."
    references = [
        "In contemporary society, the bulk of young people opt to pursue higher education to establish a solid foundation for their future careers.",
        "In modern times, students go to university to find good jobs."
    ]

    res = semantic_scorer.compute_similarity(candidate, references)
    assert "similarity_score" in res
    assert res["similarity_score"] > 0.5, f"Expected strong match, got {res['similarity_score']}"
    assert res["latency_ms"] < 40.0, f"Expected latency < 40ms, got {res['latency_ms']}ms"
    assert res["best_match"] == references[0]

def test_ai_validator_tier1():
    # Valid question
    valid_q = {
        "prompt": "Select the appropriate academic word:",
        "options": ["abandon", "acquire", "foster", "hinder"],
        "correct_index": 1
    }
    t1_res = ai_validator.validate_question_tier1(valid_q)
    assert t1_res["valid"] is True
    assert len(t1_res["errors"]) == 0

    # Invalid question: duplicate options & bad index
    invalid_q = {
        "prompt": "Select:",
        "options": ["abandon", "abandon", "foster", "hinder"],
        "correct_index": 5
    }
    t1_fail = ai_validator.validate_question_tier1(invalid_q)
    assert t1_fail["valid"] is False
    assert len(t1_fail["errors"]) >= 2

def test_ai_validator_tier2_dispute():
    q = {
        "prompt": "Select the appropriate academic word:",
        "options": ["acquire", "gain", "foster", "hinder"],
        "correct_index": 0
    }
    dispute_res = ai_validator.validate_dispute_tier2(q, feedback_reason="two_correct_answers")
    assert "verdict" in dispute_res
    assert dispute_res["tier"] == "ai_validator_2"

def test_question_generator():
    from ai_engine.question_generator import question_generator
    target_word = {"id": "#001", "word": "proliferate", "pos": "v", "meaning": "tăng nhanh chóng", "example": "Mobile devices proliferate rapidly."}
    learned_words = [{"id": "#002", "word": "deteriorate", "pos": "v"}]
    distractors = ["alleviate", "undermine", "reinforce"]
    res = question_generator.generate_question(target_word, learned_words, distractors)
    assert res["target_word"] == "proliferate"
    assert len(res["options"]) == 4
    assert res["options"][res["correct_index"]] == "proliferate"
    assert "_______" in res["masked_sentence"]
    assert res["status"] == "under_review_v1"
    assert "ai_generated" in res["quality_tags"]

