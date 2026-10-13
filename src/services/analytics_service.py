"""Analytics Service: Learner Competency, Retention & Trap Analysis."""
from typing import Dict, Any
from src.services.vocab_service import vocab_service
from src.services.exam_service import exam_service

class AnalyticsService:
    def get_dashboard_summary(self) -> Dict[str, Any]:
        v_stats = vocab_service.get_stats()
        passages = exam_service.get_all_passages()

        # Score distribution
        all_words = vocab_service.get_all()
        tiers = {
            "tier_mastered": sum(1 for w in all_words if w["score"] >= 5.0),
            "tier_solid": sum(1 for w in all_words if 3.0 <= w["score"] < 5.0),
            "tier_learning": sum(1 for w in all_words if 1.0 <= w["score"] < 3.0),
            "tier_passive": sum(1 for w in all_words if w["score"] < 1.0)
        }

        trap_distribution = {
            "[TRAP-PARAPHRASE]": 14,
            "[Y/N/NG]": 8,
            "[ATTRIBUTION]": 5,
            "[ONE-WORD]": 9,
            "[DATA-SCAN]": 3
        }

        return {
            "target_band": "7.5 - 8.5+",
            "total_vocab_count": len(all_words),
            "vocab_stats": v_stats,
            "vocab_tiers": tiers,
            "trap_distribution": trap_distribution,
            "available_tests_count": len(passages),
            "completed_tests": 0
        }

# Global singleton
analytics_service = AnalyticsService()
