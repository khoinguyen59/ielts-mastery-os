"""Writing Service: Reading-to-Writing Active Translation Engine & Band Upgrades."""
from typing import Dict, List, Optional, Any
from src.services.vocab_service import vocab_service

class WritingService:
    def __init__(self):
        self._chunks: List[Dict[str, Any]] = []
        self._init_chunks()

    def _init_chunks(self):
        self._chunks = [
            {
                "id": "chunk_01",
                "title": "Chặng 1: Xã hội & Giáo dục Đại học",
                "target_words": [
                    {"id": "#118", "word": "contemporary", "pos": "adj", "core": "đương đại, ngày nay", "colloc": "contemporary society"},
                    {"id": "#066", "word": "bulk", "pos": "n", "core": "phần lớn, số lượng khổng lồ", "colloc": "bulk of young people"},
                    {"id": "#229", "word": "establish", "pos": "v", "core": "thiết lập, gầy dựng nền móng", "colloc": "establish a foundation"}
                ],
                "vietnamese_prompt": "Trong xã hội đương đại, phần lớn người trẻ chọn theo đuổi giáo dục bậc cao nhằm gầy dựng nền móng vững chắc cho sự nghiệp tương lai.",
                "minimalist_clues": ["contemporary society", "bulk of young people", "pursue higher education", "establish a foundation", "future career"],
                "band_75_model": "In contemporary society, the bulk of young people opt to pursue higher education to establish a solid foundation for their future careers.",
                "band_85_model": "In contemporary society, an overwhelming bulk of youths elect to pursue tertiary education, seeking thereby to establish an enduring foundation for their prospective careers."
            },
            {
                "id": "chunk_02",
                "title": "Chặng 2: Tài chính & Di sản Văn hóa Nghệ thuật",
                "target_words": [
                    {"id": "#271", "word": "fund", "pos": "v", "core": "cấp vốn tài trợ", "colloc": "fund art projects"},
                    {"id": "#258", "word": "finance", "pos": "n", "core": "nguồn tài chính công", "colloc": "allocate finances"},
                    {"id": "#424", "word": "promote", "pos": "v", "core": "thúc đẩy quảng bá", "colloc": "promote cultural heritage"}
                ],
                "vietnamese_prompt": "Nhiều người tin rằng chính quyền nên phân bổ tài chính để tài trợ các dự án nghệ thuật nhằm thúc đẩy di sản văn hóa trong cộng đồng địa phương.",
                "minimalist_clues": ["allocate finances", "fund art projects", "promote cultural heritage", "local community"],
                "band_75_model": "Many argue that the government ought to allocate public finances to fund community art projects, thereby promoting cultural heritage across local communities.",
                "band_85_model": "It is widely contended that state authorities should allocate public finances to generously fund artistic endeavors, thereby serving to vigorously promote local cultural heritage."
            },
            {
                "id": "chunk_03",
                "title": "Chặng 3: Môi trường & Chi phí Công nghệ Xanh",
                "target_words": [
                    {"id": "#383", "word": "period", "pos": "n", "core": "giai đoạn, khoảng thời gian dài", "colloc": "extended period"},
                    {"id": "#311a", "word": "innovation", "pos": "n", "core": "sự đổi mới sáng tạo", "colloc": "green technological innovation"},
                    {"id": "#062", "word": "benefit", "pos": "n", "core": "lợi ích dài hạn", "colloc": "tangible benefits"}
                ],
                "vietnamese_prompt": "Dù chi phí ban đầu cho công nghệ xanh rất tốn kém, các doanh nghiệp vẫn nên kiên trì theo đuổi lĩnh vực này trong một giai đoạn kéo dài vì lợi ích bền vững.",
                "minimalist_clues": ["initial cost", "green technological innovation", "extended period", "tangible benefits"],
                "band_75_model": "Although the initial expenditure on green technologies is substantial, commercial enterprises should sustain investments over an extended period to reap tangible environmental benefits.",
                "band_85_model": "Notwithstanding the formidable upfront costs of green technological innovations, forward-looking corporations ought to maintain commitments over an extended period to secure profound ecological benefits."
            },
            {
                "id": "chunk_04",
                "title": "Chặng 4: Khủng hoảng & Gắn kết Cộng đồng",
                "target_words": [
                    {"id": "#113", "word": "conflict", "pos": "n", "core": "xung đột, thời kỳ giao tranh", "colloc": "times of conflict or crisis"},
                    {"id": "#188a", "word": "display", "pos": "n/v", "core": "trưng bày triển lãm", "colloc": "public display of art"},
                    {"id": "#324a", "word": "isolation", "pos": "n", "core": "sự cô lập xã hội", "colloc": "alleviate social isolation"}
                ],
                "vietnamese_prompt": "Trong các thời kỳ xung đột hay khủng hoảng, việc tổ chức các buổi triển lãm nghệ thuật công cộng có thể gắn kết cộng đồng và làm dịu đi sự cô lập xã hội.",
                "minimalist_clues": ["times of conflict", "public display of art", "foster social cohesion", "alleviate social isolation"],
                "band_75_model": "During eras of conflict or severe crisis, the public display of communal artworks can unify local neighborhoods and alleviate feelings of social isolation.",
                "band_85_model": "In epochs marked by profound conflict or socio-economic distress, putting cultural masterpieces on public display fosters civic solidarity while decisively alleviating chronic social isolation."
            }
        ]

    def get_chunks(self) -> List[Dict[str, Any]]:
        return self._chunks

    def get_chunk_by_id(self, chunk_id: str) -> Optional[Dict[str, Any]]:
        for c in self._chunks:
            if c["id"] == chunk_id:
                return c
        return None

    def evaluate_translation(self, chunk_id: str, user_text: str) -> Dict[str, Any]:
        chunk = self.get_chunk_by_id(chunk_id)
        if not chunk:
            return {"error": "Chunk not found"}

        clean_text = user_text.strip().lower()
        if not clean_text:
            return {"error": "User translation cannot be empty"}

        # Check target words usage
        matched_targets = []
        missing_targets = []
        for tw in chunk["target_words"]:
            w_root = tw["word"].lower()
            if w_root in clean_text or (w_root[:-1] in clean_text if len(w_root) > 4 else False):
                matched_targets.append(tw["word"])
                # Increment score in vocab service
                vocab_service.update_score(tw["id"], 3.5)
            else:
                missing_targets.append(tw["word"])

        word_count = len(clean_text.split())
        score_ratio = len(matched_targets) / len(chunk["target_words"])
        
        feedback_points = []
        if score_ratio == 1.0:
            feedback_points.append("Xuất sắc! Bạn đã lồng ghép thành công 100% từ vựng mục tiêu học thuật.")
        else:
            feedback_points.append(f"Cần bổ sung thêm từ vựng mục tiêu còn thiếu: {', '.join(missing_targets)}.")

        if word_count < 12:
            feedback_points.append("Câu dịch hơi ngắn so với cấu trúc biện luận chuẩn IELTS Writing Task 2.")
        else:
            feedback_points.append(f"Độ dài câu ({word_count} từ) đáp ứng tốt tiêu chuẩn câu phức Task 2.")

        return {
            "chunk_id": chunk_id,
            "user_submission": user_text,
            "matched_words": matched_targets,
            "missing_words": missing_targets,
            "feedback": " ".join(feedback_points),
            "band_75_model": chunk["band_75_model"],
            "band_85_model": chunk["band_85_model"],
            "score_ratio": round(score_ratio * 100, 1)
        }

# Global singleton
writing_service = WritingService()
