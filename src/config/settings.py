"""Application Configuration & Constants (Target Band 7.0+)."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROJECT_ROOT = BASE_DIR

# Server configuration
SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8765

# Data file paths
DATA_DIR = BASE_DIR / "data"
MASTER_VOCAB_FILE = DATA_DIR / "vocab" / "master_vocab.json"
MY_VOCAB_DIR = BASE_DIR / "my-vocab"
EXTRACTED_CAM21_DIR = DATA_DIR / "extracted" / "cambridge_21"
EXTRACTED_IZONE_DIR = DATA_DIR / "extracted" / "giai_de_cam_21"
PDF_EXPORTS_DIR = DATA_DIR / "pdf_exports"
TEXTBOOKS_DIR = DATA_DIR / "textbooks"
EXAMS_DIR = DATA_DIR / "exams"
SCRATCH_DIR = BASE_DIR / "scratch"
UI_DIR = BASE_DIR / "src" / "ui"

# Academic standards
TARGET_BAND = "7.5+"
TOTAL_MASTER_WORDS = 450
MAX_SCORE = 7.0
MIN_SCORE = 0.0
