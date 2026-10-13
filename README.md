# IELTS Mastery OS 🎓

> **Advanced IELTS 7.0+ Gamified Learning Application & Polyglot Engine**  
> Decoupled Architecture: **Node.js (Fastify + SQLite + FSRS v5)** & **Python (FastAPI + NLP Semantic Engine)**

---

## 🌟 Key Features

1. **5-Tier Adaptive Courses (Band 3.0 to 8.5+):**
   - **Starter (Band 3.0 - 4.0):** A1–A2 Survival vocabulary, IPA foundations.
   - **Foundation (Band 4.5 - 5.0):** 150 B1 core academic words, compound sentences.
   - **Intermediate (Band 5.5 - 6.5):** 300 Academic Word List (AWL) B2 words, strong collocations.
   - **Advanced (Band 7.0 - 7.5):** 400 B2–C1 words, authentic Cambridge 21 reading & trap breakdown.
   - **Mastery (Band 8.0 - 8.5+):** Elite C1–C2 Nuance 50 vocabulary, Writing Task 2 complex structures.

2. **Duolingo-Style Gamified Progression:**
   - **Winding Path Roadmap:** Dynamically rendered based on diagnostic placement test results.
   - **Progressive Node Locking:** Prerequisite state machine unlocking Flashcard ➔ Quiz Blitz ➔ Chest ➔ Writing Task 2 ➔ Real Exam Passage.
   - **Hearts & Energy:** Streak counter, coin rewards, and stamina management.

3. **Cognitive Spaced Repetition (FSRS v5):**
   - Free Spaced Repetition Scheduler (`ts-fsrs`) mathematical model for optimal memory retention.
   - Simplified 2-button 3D Flashcards: 🔴 *Need Study* (Rating 1) & 🟢 *Known* (Rating 3).

4. **Real-time Adaptive Question Sequencing (80/20 Recursive Synthesis):**
   - Immediately injects recent mistakes and "Need Study" words into subsequent quiz rounds.
   - Blends 80% learned words with 20% target words to compound lexical acquisition.

---

## 🏛️ Architecture

```
IELTS-Mastery-OS/
├── src/
│   ├── config/          # System configuration and constants
│   ├── types/           # Strict TypeScript contracts (Vocab, Question, Course, Placement)
│   ├── db/              # SQLite schema and seeding logic
│   ├── services/        # Business logic (Course, Vocab, FSRS, Synthesis, Placement, Exam)
│   ├── api/             # Fastify REST Gateway and route controllers (Port 3000)
│   └── ui/              # Modern Bento Grid Frontend (HTML5, Vanilla CSS tokens, ES Modules)
├── ai_engine/           # Python FastAPI worker for semantic similarity and validation (Port 8001)
├── data/                # Seed corpus (Cambridge 21 authentic passages & Master Lexicon)
├── tests/               # Backend Vitest and Pytest test suites
├── package.json         # Node.js dependencies and scripts
├── requirements.txt     # Python dependencies
└── tsconfig.json        # TypeScript configuration
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v20+ LTS
- **Python**: v3.11+
- **Git**

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/khoinguyen59/ielts-mastery-os.git
cd ielts-mastery-os

# Install Node.js dependencies
npm install

# Install Python AI Engine dependencies
pip install -r requirements.txt
```

### 3. Running the Application
```bash
# Terminal 1: Start Fastify Application Tier (Port 3000)
npm run dev

# Terminal 2: Start Python AI Engine (Port 8001)
npm run dev:ai
```

Open your browser at `http://localhost:3000` to begin your IELTS learning journey!

### 4. Running Tests
```bash
# Run all unit tests (Vitest + Pytest)
npm test
```

---

## 📄 License
MIT License.
