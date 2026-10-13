"""FastAPI AI Engine Daemon (Port 8001).
Warm-in-Memory semantic similarity and multi-tier question validation.
"""
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

from ai_engine.semantic_scorer import semantic_scorer
from ai_engine.ai_validator import ai_validator

app = FastAPI(
    title="IELTS Mastery OS - AI & NLP Engine",
    version="1.0.0",
    description="Warm-in-Memory Cosine Semantic Scorer and Tri-Tier Question Validator"
)

class SemanticSimilarityRequest(BaseModel):
    candidate_text: str
    reference_texts: List[str]

class QuestionValidationRequest(BaseModel):
    prompt: str
    options: List[str]
    correct_index: int
    feedback_reason: Optional[str] = None

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "IELTS AI & NLP Engine",
        "port": 8001
    }

@app.post("/v1/semantic-similarity")
def compute_semantic_similarity(req: SemanticSimilarityRequest):
    if not req.reference_texts:
        raise HTTPException(status_code=400, detail="reference_texts list cannot be empty")
    
    result = semantic_scorer.compute_similarity(req.candidate_text, req.reference_texts)
    return result

@app.post("/v1/validate-question")
def validate_question(req: QuestionValidationRequest):
    q_dict = {
        "prompt": req.prompt,
        "options": req.options,
        "correct_index": req.correct_index
    }
    if req.feedback_reason:
        return ai_validator.validate_dispute_tier2(q_dict, req.feedback_reason)
    return ai_validator.validate_question_tier1(q_dict)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)
