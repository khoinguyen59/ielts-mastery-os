"""API Gateway & HTTP Web Server for IELTS Mastery OS Application."""
import json
import mimetypes
from typing import Any, Dict
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import sys
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.config.settings import SERVER_HOST, SERVER_PORT, UI_DIR, PROJECT_ROOT, PDF_EXPORTS_DIR
from src.services.vocab_service import vocab_service
from src.services.exam_service import exam_service
from src.services.writing_service import writing_service
from src.services.analytics_service import analytics_service
from src.services.practice_service import practice_service
from src.services.fsrs_service import fsrs_service
from src.services.synthesis_service import synthesis_service
from src.services.placement_service import placement_service

class IELTSRequestHandler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, data: Any):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # API Routes
        if path == "/api/vocab":
            q_text = query.get("query", [""])[0]
            pos_filter = query.get("pos", [""])[0]
            words = vocab_service.get_all(query=q_text, pos=pos_filter)
            return self._send_json(200, {"total": len(words), "data": words})

        elif path.startswith("/api/vocab/"):
            v_id = path.replace("/api/vocab/", "")
            item = vocab_service.get_by_id(v_id)
            if item:
                return self._send_json(200, item)
            return self._send_json(404, {"error": "Word not found"})

        elif path == "/api/exams":
            passages = exam_service.get_all_passages()
            return self._send_json(200, {"total": len(passages), "data": passages})

        elif path.startswith("/api/exams/"):
            pid = path.replace("/api/exams/", "")
            passage = exam_service.get_passage(pid)
            if passage:
                return self._send_json(200, passage)
            return self._send_json(404, {"error": "Passage not found"})

        elif path == "/api/writing-chunks":
            chunks = writing_service.get_chunks()
            return self._send_json(200, {"total": len(chunks), "data": chunks})

        elif path.startswith("/api/writing-chunks/"):
            cid = path.replace("/api/writing-chunks/", "")
            chunk = writing_service.get_chunk_by_id(cid)
            if chunk:
                return self._send_json(200, chunk)
            return self._send_json(404, {"error": "Chunk not found"})

        elif path == "/api/analytics":
            summary = analytics_service.get_dashboard_summary()
            return self._send_json(200, summary)

        elif path == "/api/practice/quiz":
            count = int(query.get("count", ["10"])[0])
            questions = practice_service.generate_quiz_round(count=count)
            return self._send_json(200, {"total": len(questions), "questions": questions})

        elif path == "/api/synthesis/round":
            count = int(query.get("count", ["5"])[0])
            questions = synthesis_service.generate_synthesis_round(count=count)
            return self._send_json(200, {"total": len(questions), "questions": questions})

        elif path == "/api/fsrs/learned":
            learned_ids = fsrs_service.get_learned_word_ids()
            return self._send_json(200, {"total": len(learned_ids), "learned_word_ids": learned_ids})

        elif path == "/api/placement/levels":
            levels = placement_service.get_level_presets()
            return self._send_json(200, levels)

        elif path == "/api/placement/test":
            count = int(query.get("count", ["8"])[0])
            diag_questions = placement_service.generate_diagnostic_test(count=count)
            return self._send_json(200, {"total": len(diag_questions), "questions": diag_questions})

        # Static File Serving
        self._serve_static(path)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            payload = json.loads(body.decode("utf-8")) if body else {}
        except Exception:
            return self._send_json(400, {"error": "Invalid JSON format"})

        if path == "/api/exams/submit":
            pid = payload.get("passage_id", "")
            answers = payload.get("answers", {})
            result = exam_service.evaluate_submission(pid, answers)
            return self._send_json(200, result)

        elif path == "/api/writing/submit":
            chunk_id = payload.get("chunk_id", "")
            text = payload.get("user_text", "")
            result = writing_service.evaluate_translation(chunk_id, text)
            return self._send_json(200, result)

        elif path == "/api/vocab/update-score":
            v_id = payload.get("id", "")
            sc = float(payload.get("score", 1.0))
            ok = vocab_service.update_score(v_id, sc)
            return self._send_json(200, {"success": ok, "id": v_id, "score": sc})

        elif path == "/api/fsrs/review":
            w_id = payload.get("word_id", "")
            rating = int(payload.get("rating", 3))
            elapsed = float(payload.get("elapsed_days", 1.0))
            card = fsrs_service.review_card(w_id, rating=rating, elapsed_days=elapsed)
            vocab_service.update_score(w_id, card.current_score)
            return self._send_json(200, {"success": True, "card": card.to_dict()})

        elif path == "/api/placement/submit":
            answers = payload.get("answers", {})
            eval_result = placement_service.evaluate_test(answers)
            return self._send_json(200, eval_result)

        elif path == "/api/placement/select-level":
            level_key = payload.get("level_key", "intermediate")
            presets = placement_service.get_level_presets()
            selected = presets.get(level_key, presets["intermediate"])
            return self._send_json(200, {"success": True, "level": selected})

        return self._send_json(404, {"error": "Endpoint not found"})

    def _serve_static(self, req_path: str):
        if req_path in ("/", ""):
            req_path = "/index.html"

        rel_path = req_path.lstrip("/")
        # Check in UI_DIR first
        file_path = (UI_DIR / rel_path).resolve()
        
        # If requesting a PDF or file not in UI_DIR, check PDF_EXPORTS_DIR
        if not file_path.exists() and rel_path.endswith(".pdf"):
            candidate = (PDF_EXPORTS_DIR / rel_path).resolve()
            if candidate.exists() and str(candidate).startswith(str(PDF_EXPORTS_DIR.resolve())):
                file_path = candidate

        # Security check: prevent directory traversal
        is_safe_ui = str(file_path).startswith(str(UI_DIR.resolve()))
        is_safe_pdf = str(file_path).startswith(str(PDF_EXPORTS_DIR.resolve())) and file_path.suffix == ".pdf"

        if not (is_safe_ui or is_safe_pdf) or not file_path.exists() or file_path.is_dir():
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"404 Not Found")
            return

        mime_type, _ = mimetypes.guess_type(str(file_path))
        if not mime_type:
            mime_type = "application/octet-stream"

        content = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", f"{mime_type}; charset=utf-8" if "text" in mime_type or "javascript" in mime_type or "json" in mime_type else mime_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

def run_server(host: str = SERVER_HOST, port: int = SERVER_PORT):
    server_address = (host, port)
    httpd = HTTPServer(server_address, IELTSRequestHandler)
    print(f"============================================================")
    print(f" IELTS Mastery OS Application Server Started")
    print(f" Running at: http://{host}:{port}/")
    print(f"============================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
