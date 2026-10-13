/**
 * Quiz Blitz Arena & Duolingo Slide-Up Drawer Controller.
 * Modular Gamified Architecture (< 400 lines).
 */
class QuizBlitz {
    constructor() {
        this.questions = [];
        this.mistakeQueue = [];
        this.currentIndex = 0;
        this.currentStreak = 0;
        this.bestStreakInRound = 0;
        this.correctCount = 0;
        this.timer = null;
        this.timeLeft = 10;
        this.isAnswered = false;
        this._bindEvents();
    }

    _bindEvents() {
        document.getElementById("drawer-continue-btn")?.addEventListener("click", () => {
            this.nextQuestion();
        });

        window.addEventListener("keydown", (e) => {
            const activeArena = document.getElementById("quiz-active-arena");
            if (!activeArena || activeArena.style.display === "none") return;

            if (!this.isAnswered && ["1", "2", "3", "4"].includes(e.key)) {
                this.handleAnswer(parseInt(e.key) - 1);
            } else if (this.isAnswered && (e.key === "Enter" || e.code === "Space")) {
                e.preventDefault();
                this.nextQuestion();
            }
        });
    }

    async startRound(count = 10) {
        if (window.progressionManager && !window.progressionManager.isNodeUnlocked(2)) {
            window.progressionManager.handleLockedNode(2);
            return;
        }
        if (window.energyManager && !window.energyManager.canStartLesson()) return;
        this.currentIndex = 0;
        this.currentStreak = 0;
        this.bestStreakInRound = 0;
        this.correctCount = 0;
        this.isAnswered = false;
        this.mistakeQueue = [];

        const loading = document.getElementById("quiz-loading-state");
        const arena = document.getElementById("quiz-active-arena");
        const summary = document.getElementById("quiz-summary-card");
        this._closeDrawer();

        if (loading) loading.style.display = "block";
        if (arena) arena.style.display = "none";
        if (summary) summary.style.display = "none";

        try {
            const userId = localStorage.getItem('ielts_os_user_id') || 'default_user';
            const level = localStorage.getItem('ielts_user_level') || 'intermediate';
            const resp = await fetch(`/api/practice/quiz?count=${count}&user_id=${encodeURIComponent(userId)}&level=${encodeURIComponent(level)}`);
            const data = await resp.json();
            this.questions = data.questions || [];
            if (loading) loading.style.display = "none";
            if (arena) arena.style.display = "block";
            this.renderQuestion();
        } catch (e) {
            console.error("Failed to load quiz round:", e);
            if (loading) loading.textContent = "Lỗi nạp câu hỏi trắc nghiệm. Vui lòng thử lại!";
        }
    }

    renderQuestion() {
        if (this.currentIndex >= this.questions.length) {
            if (this.mistakeQueue.length > 0) {
                this.questions = [...this.mistakeQueue];
                this.mistakeQueue = [];
                this.currentIndex = 0;
                window.mascotManager?.setEmotion("study", "Ôn lại các câu sai cho đến khi thuộc 100% nhé!");
            } else {
                this.showRoundSummary();
                return;
            }
        }

        this.isAnswered = false;
        clearInterval(this.timer);
        this.timeLeft = 10;
        this._closeDrawer();

        const q = this.questions[this.currentIndex];

        // Progress bar
        const progressFill = document.getElementById("quiz-progress-bar-fill");
        if (progressFill && this.questions.length > 0) {
            const pct = Math.round(((this.currentIndex) / this.questions.length) * 100);
            progressFill.style.width = `${pct}%`;
        }

        const badgeElem = document.getElementById("quiz-type-badge");
        const promptElem = document.getElementById("quiz-question-prompt");
        const optionsContainer = document.getElementById("quiz-options-grid");

        if (badgeElem) badgeElem.textContent = q.badge || "ANH ➔ VIỆT";
        if (promptElem) promptElem.textContent = q.prompt || "";

        if (optionsContainer) {
            optionsContainer.innerHTML = "";
            const letters = ["A", "B", "C", "D"];
            q.options.forEach((optText, optIdx) => {
                const btn = document.createElement("button");
                btn.className = "duo-tile-btn";
                btn.id = `quiz-opt-${optIdx}`;
                btn.innerHTML = `<span class="tile-key">${letters[optIdx]}</span> <span class="tile-text">${optText}</span>`;
                btn.addEventListener("click", () => this.handleAnswer(optIdx));
                optionsContainer.appendChild(btn);
            });
        }

        window.mascotManager?.reactStudy();
        this._startCountdown();
    }

    _startCountdown() {
        const timerText = document.getElementById("quiz-timer-text");
        if (timerText) timerText.textContent = `${this.timeLeft}s`;

        this.timer = setInterval(() => {
            this.timeLeft -= 1;
            if (timerText) timerText.textContent = `${this.timeLeft}s`;
            if (this.timeLeft <= 0) {
                clearInterval(this.timer);
                this.handleTimeout();
            }
        }, 1000);
    }

    handleAnswer(chosenIndex) {
        if (this.isAnswered) return;
        this.isAnswered = true;
        clearInterval(this.timer);

        const q = this.questions[this.currentIndex];
        const isCorrect = (chosenIndex === q.correct_index);

        const chosenBtn = document.getElementById(`quiz-opt-${chosenIndex}`);
        const correctBtn = document.getElementById(`quiz-opt-${q.correct_index}`);

        if (isCorrect) {
            this.correctCount++;
            this.currentStreak++;
            if (this.currentStreak > this.bestStreakInRound) this.bestStreakInRound = this.currentStreak;

            if (chosenBtn) chosenBtn.classList.add("selected-correct");
            window.soundManager?.playCorrect();
            if (this.currentStreak % 5 === 0) window.soundManager?.playReward();
            window.mascotManager?.reactCorrect(this.currentStreak);

            const curScore = window.localStore.getWordScore(q.word_id, 1.0);
            window.localStore.setWordScore(q.word_id, Math.min(7.0, curScore + 0.5));
            this._showDrawer(true, "Chính xác tuyệt vời!", q.explanation);
        } else {
            this.currentStreak = 0;
            if (chosenBtn) chosenBtn.classList.add("selected-wrong");
            if (correctBtn) correctBtn.classList.add("selected-correct");
            this.mistakeQueue.push(q);

            window.energyManager?.deductHeart();
            window.soundManager?.playWrong();
            window.mascotManager?.reactWrong(q.explanation);
            this._showDrawer(false, "Chưa chính xác rồi!", q.explanation);
        }

        // Asynchronously sync with backend FSRS & user stats
        if (q && q.id) {
            fetch('/api/quiz/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question_id: q.id,
                    selected_index: chosenIndex,
                    target_word_id: q.word_id
                })
            }).catch(() => {});
        }
    }

    handleTimeout() {
        if (this.isAnswered) return;
        this.isAnswered = true;
        this.currentStreak = 0;

        const q = this.questions[this.currentIndex];
        const correctBtn = document.getElementById(`quiz-opt-${q.correct_index}`);
        if (correctBtn) correctBtn.classList.add("selected-correct");
        this.mistakeQueue.push(q);

        window.energyManager?.deductHeart();
        window.soundManager?.playWrong();
        window.mascotManager?.reactWrong("Hết thời gian!");
        this._showDrawer(false, "Hết thời gian 10s!", q.explanation);
    }

    _showDrawer(isCorrect, title, explanation) {
        const drawer = document.getElementById("quiz-feedback-drawer");
        const drawerTitle = document.getElementById("drawer-title");
        const drawerIcon = document.getElementById("drawer-icon");
        const drawerExp = document.getElementById("drawer-explanation");

        if (!drawer) return;
        drawer.className = `duo-feedback-drawer active ${isCorrect ? 'drawer-correct' : 'drawer-wrong'}`;
        if (drawerTitle) drawerTitle.textContent = title;
        if (drawerIcon) drawerIcon.textContent = isCorrect ? "✓" : "✕";
        if (drawerExp) drawerExp.textContent = explanation || "";
    }

    _closeDrawer() {
        const drawer = document.getElementById("quiz-feedback-drawer");
        if (drawer) drawer.className = "duo-feedback-drawer";
    }

    nextQuestion() {
        this.currentIndex++;
        this.renderQuestion();
    }

    showRoundSummary() {
        clearInterval(this.timer);
        this._closeDrawer();
        const arena = document.getElementById("quiz-active-arena");
        const summary = document.getElementById("quiz-summary-card");

        if (arena) arena.style.display = "none";
        if (summary) {
            summary.style.display = "block";
            const scoreDisplay = document.getElementById("quiz-summary-score");
            const streakDisplay = document.getElementById("quiz-summary-streak");
            const total = this.questions.length;

            if (scoreDisplay) scoreDisplay.textContent = `${this.correctCount} / ${total}`;
            if (streakDisplay) streakDisplay.textContent = `x${this.bestStreakInRound}`;

            window.soundManager?.playReward();
            window.mascotManager?.setEmotion("celebrate", "Đỉnh chóp! Bạn vừa hoàn thành bài học phản xạ cực đỉnh!");
            window.progressionManager?.completeNode(2);
        }
    }
}

window.quizBlitz = new QuizBlitz();
