/**
 * Flashcard 3D Studio: Interactive Card Flip, IPA TTS & 1.0-7.0 Spaced Repetition Rating.
 * Tái tạo từ flashcard_card_view.dart và flashcard_screen.dart trong Luyện Từ.
 */
class FlashcardStudio {
    constructor() {
        this.vocabList = [];
        this.filteredList = [];
        this.currentIndex = 0;
        this.isFlipped = false;
        this.isEnToVi = true; // true: EN -> VI, false: VI -> EN
        this.currentFilter = "all"; // "all", "weak" (<=2), "learning" (3-4), "mastered" (>=5)
    }

    async init(vocabList) {
        if (!vocabList || !vocabList.length) {
            const level = localStorage.getItem('ielts_user_level') || 'intermediate';
            try {
                const res = await fetch(`/api/vocab/tier?level=${encodeURIComponent(level)}`);
                if (res.ok) {
                    const data = await res.json();
                    vocabList = data.data || [];
                }
            } catch (err) {
                console.warn("Could not fetch vocab for flashcard:", err);
            }
        }
        this.vocabList = vocabList || [];
        this.applyFilter(this.currentFilter);
        if (!this._eventsBound) {
            this._bindEvents();
            this._eventsBound = true;
        }
    }

    async reloadForLevel(levelKey) {
        try {
            const res = await fetch(`/api/vocab/tier?level=${encodeURIComponent(levelKey)}`);
            if (res.ok) {
                const data = await res.json();
                this.vocabList = data.data || [];
                this.currentIndex = 0;
                this.applyFilter(this.currentFilter);
            }
        } catch (err) {
            console.warn("Could not reload vocab for level:", err);
        }
    }

    applyFilter(filterType) {
        this.currentFilter = filterType;
        if (filterType === "weak") {
            this.filteredList = this.vocabList.filter(w => (window.localStore ? window.localStore.getWordScore(w.id, w.score) <= 2.0 : w.score <= 2.0));
        } else if (filterType === "learning") {
            this.filteredList = this.vocabList.filter(w => {
                const sc = window.localStore ? window.localStore.getWordScore(w.id, w.score) : w.score;
                return sc > 2.0 && sc < 5.0;
            });
        } else if (filterType === "mastered") {
            this.filteredList = this.vocabList.filter(w => (window.localStore ? window.localStore.getWordScore(w.id, w.score) >= 5.0 : w.score >= 5.0));
        } else {
            this.filteredList = [...this.vocabList];
        }

        this.currentIndex = 0;
        this.isFlipped = false;
        this.renderCard();
    }

    toggleDirection() {
        this.isEnToVi = !this.isEnToVi;
        this.isFlipped = false;
        this.renderCard();
        return this.isEnToVi;
    }

    flipCard() {
        this.isFlipped = !this.isFlipped;
        const cardElem = document.getElementById("flashcard-3d-card");
        if (cardElem) {
            if (this.isFlipped) cardElem.classList.add("flipped");
            else cardElem.classList.remove("flipped");
        }
    }

    getCurrentWord() {
        if (!this.filteredList.length) return null;
        return this.filteredList[this.currentIndex];
    }

    rateCurrentWord(score) {
        const item = this.getCurrentWord();
        if (!item) return;

        if (window.localStore) window.localStore.setWordScore(item.id, score);
        if (score >= 5.0) {
            if (window.soundManager) window.soundManager.playCorrect();
            if (window.mascotManager) window.mascotManager.reactCorrect(1);
        } else {
            if (window.soundManager) window.soundManager.playWrong();
            if (window.mascotManager) window.mascotManager.reactWrong("Đã ghi nhận cần ôn tập!");
        }

        // Asynchronously sync with backend FSRS review endpoint
        const rating = score >= 5.0 ? 3 : 1;
        fetch(`/api/vocab/${encodeURIComponent(item.id)}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating })
        }).catch(() => {});

        // Advance to next card
        setTimeout(() => {
            this.nextCard();
        }, 250);
    }

    nextCard() {
        if (!this.filteredList.length) return;
        this.currentIndex = (this.currentIndex + 1) % this.filteredList.length;
        this.isFlipped = false;
        this.renderCard();
    }

    prevCard() {
        if (!this.filteredList.length) return;
        this.currentIndex = (this.currentIndex - 1 + this.filteredList.length) % this.filteredList.length;
        this.isFlipped = false;
        this.renderCard();
    }

    renderCard() {
        const cardElem = document.getElementById("flashcard-3d-card");
        const countDisplay = document.getElementById("flashcard-counter-display");
        const emptyState = document.getElementById("flashcard-empty-state");
        const cardScene = document.querySelector(".flashcard-3d-scene");

        if (!cardElem) return;

        if (!this.filteredList.length) {
            if (cardScene) cardScene.style.display = "none";
            if (emptyState) emptyState.style.display = "block";
            if (countDisplay) countDisplay.textContent = "0 / 0";
            return;
        }

        if (cardScene) cardScene.style.display = "block";
        if (emptyState) emptyState.style.display = "none";
        cardElem.classList.remove("flipped");
        this.isFlipped = false;

        const w = this.filteredList[this.currentIndex];
        const currentScore = window.localStore ? window.localStore.getWordScore(w.id, w.score) : w.score;

        if (countDisplay) {
            countDisplay.textContent = `Thẻ ${this.currentIndex + 1} / ${this.filteredList.length}`;
        }

        // Render Front
        const frontWord = document.getElementById("fc-front-word");
        const frontPos = document.getElementById("fc-front-pos");
        const frontIpa = document.getElementById("fc-front-ipa");
        const frontClue = document.getElementById("fc-front-clue");
        const frontScoreBadge = document.getElementById("fc-front-score-badge");

        if (frontWord) frontWord.textContent = this.isEnToVi ? w.word : w.meaning;
        if (frontPos) frontPos.textContent = w.pos ? `[${w.pos}]` : "";
        if (frontIpa) frontIpa.textContent = this.isEnToVi ? (w.ipa || "") : "";
        if (frontClue) frontClue.textContent = this.isEnToVi ? `Collocation: ${w.key_collocation || w.collocations || "..."}` : `Gợi ý ký tự đầu: ${w.word[0]}... (${w.pos})`;
        if (frontScoreBadge) {
            frontScoreBadge.textContent = currentScore >= 5.0 ? `Đã biết (★ ${currentScore.toFixed(1)})` : `Cần học (★ ${currentScore.toFixed(1)})`;
            frontScoreBadge.className = `score-badge-pill ${currentScore >= 5.0 ? 'score-6' : 'score-1'}`;
        }

        // Render Back
        const backWord = document.getElementById("fc-back-word");
        const backMeaning = document.getElementById("fc-back-meaning");
        const backColloc = document.getElementById("fc-back-colloc");
        const backRoots = document.getElementById("fc-back-roots");
        const backExample = document.getElementById("fc-back-example");
        const backFamily = document.getElementById("fc-back-family");

        if (backWord) backWord.textContent = w.word;
        if (backMeaning) backMeaning.textContent = w.meaning;
        if (backColloc) backColloc.textContent = w.key_collocation || w.collocations || "Đang cập nhật";
        if (backRoots) backRoots.textContent = w.lego_roots || "Gốc từ vựng học thuật B2-C1";
        if (backExample) backExample.textContent = w.example || "Cambridge 21 Authentic Context";
        if (backFamily) {
            const fam = Array.isArray(w.word_family) ? w.word_family.join(", ") : (w.word_family || "");
            backFamily.textContent = fam ? `Gia đình từ: ${fam}` : "";
        }
    }

    _bindEvents() {
        const cardElem = document.getElementById("flashcard-3d-card");
        if (cardElem) {
            cardElem.addEventListener("click", () => this.flipCard());
        }

        const speakBtn = document.getElementById("fc-speak-btn");
        if (speakBtn) {
            speakBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const w = this.getCurrentWord();
                if (w && window.soundManager) window.soundManager.speakWord(w.word);
            });
        }

        const toggleDirBtn = document.getElementById("fc-toggle-dir-btn");
        if (toggleDirBtn) {
            toggleDirBtn.addEventListener("click", () => {
                const enToVi = this.toggleDirection();
                toggleDirBtn.textContent = enToVi ? "Anh ➔ Việt" : "Việt ➔ Anh";
            });
        }

        // Key listeners for 1, 2/Enter, Space, Arrow keys
        window.addEventListener("keydown", (e) => {
            const fcView = document.getElementById("view-flashcard");
            if (!fcView || !fcView.classList.contains("active")) return;
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

            if (e.code === "Space") {
                e.preventDefault();
                this.flipCard();
            } else if (e.key === "1") {
                e.preventDefault();
                this.rateCurrentWord(1.0);
                window.progressionManager?.completeNode(1);
            } else if (e.key === "2" || e.key === "Enter") {
                e.preventDefault();
                this.rateCurrentWord(6.0);
                window.progressionManager?.completeNode(1);
            } else if (e.code === "ArrowRight") {
                e.preventDefault();
                this.nextCard();
            } else if (e.code === "ArrowLeft") {
                e.preventDefault();
                this.prevCard();
            } else if (e.key.toLowerCase() === "s") {
                const w = this.getCurrentWord();
                if (w && window.soundManager) window.soundManager.speakWord(w.word);
            }
        });
    }
}

window.flashcardStudio = new FlashcardStudio();
