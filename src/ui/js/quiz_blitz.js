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
        this.initialTotalQuestions = 0;
        this.userId = localStorage.getItem('ielts_os_user_id') || 'default_user';
        this.currentReportQuestionId = null;
        this._bindEvents();
    }

    _bindEvents() {
        document.getElementById("drawer-continue-btn")?.addEventListener("click", () => this.nextQuestion());
        document.getElementById("drawer-report-btn")?.addEventListener("click", () => this.openReportModal());
        document.getElementById("quiz-report-close-btn")?.addEventListener("click", () => this.closeReportModal());
        document.getElementById("quiz-report-cancel-btn")?.addEventListener("click", () => this.closeReportModal());
        document.getElementById("quiz-report-submit-btn")?.addEventListener("click", () => this.submitQuestionReport());
        document.getElementById("quiz-report-modal")?.addEventListener("click", (e) => {
            if (e.target && e.target.id === "quiz-report-modal") this.closeReportModal();
        });

        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                this.closeReportModal();
                return;
            }
            const modal = document.getElementById("quiz-report-modal");
            if (modal && modal.style.display !== "none" && modal.style.display !== "") return;
            if (e.target && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;

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
        this.initialTotalQuestions = 0;
        this.userId = localStorage.getItem('ielts_os_user_id') || 'default_user';

        const loading = document.getElementById("quiz-loading-state");
        const arena = document.getElementById("quiz-active-arena");
        const summary = document.getElementById("quiz-summary-card");
        this._closeDrawer();

        if (loading) loading.style.display = "block";
        if (arena) arena.style.display = "none";
        if (summary) summary.style.display = "none";

        try {
            const level = localStorage.getItem('ielts_user_level') || 'intermediate';
            const resp = await fetch(`/api/practice/quiz?count=${count}&user_id=${encodeURIComponent(this.userId)}&level=${encodeURIComponent(level)}`);
            const data = await resp.json();
            this.questions = data.questions || [];
            this.initialTotalQuestions = this.questions.length;
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

        if (badgeElem) {
            badgeElem.textContent = (q.badge && q.badge !== 'Anh -> Việt' && q.badge !== 'ANH ➔ VIỆT')
                ? q.badge
                : 'Điền từ học thuật';
        }
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
            this._showDrawer(true, "Chính xác tuyệt vời!", q.explanation, q.band_75_upgrade, q.band_85_upgrade);
        } else {
            this.currentStreak = 0;
            if (chosenBtn) chosenBtn.classList.add("selected-wrong");
            if (correctBtn) correctBtn.classList.add("selected-correct");
            this.mistakeQueue.push(q);

            window.energyManager?.deductHeart();
            window.soundManager?.playWrong();
            window.mascotManager?.reactWrong(q.explanation);
            this._showDrawer(false, "Chưa chính xác rồi!", q.explanation, q.band_75_upgrade, q.band_85_upgrade);
        }

        // Asynchronously sync with backend FSRS & user stats
        if (q && q.id) {
            const currentUserId = this.userId || localStorage.getItem('ielts_os_user_id') || 'default_user';
            fetch('/api/quiz/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question_id: q.id,
                    selected_index: chosenIndex,
                    target_word_id: q.word_id,
                    user_id: currentUserId
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
        this._showDrawer(false, "Hết thời gian 10s!", q.explanation, q.band_75_upgrade, q.band_85_upgrade);
    }

    _showDrawer(isCorrect, title, explanation, band75 = "", band85 = "") {
        const q = this.questions[this.currentIndex];
        this.currentReportQuestionId = q ? q.id : null;

        const drawer = document.getElementById("quiz-feedback-drawer");
        const drawerTitle = document.getElementById("drawer-title");
        const drawerIcon = document.getElementById("drawer-icon");
        const drawerExp = document.getElementById("drawer-explanation");
        const upgradesContainer = document.getElementById("drawer-upgrades");
        const u75 = document.getElementById("drawer-upgrade-75");
        const u85 = document.getElementById("drawer-upgrade-85");

        if (!drawer) return;
        drawer.className = `duo-feedback-drawer active ${isCorrect ? 'drawer-correct' : 'drawer-wrong'}`;
        if (drawerTitle) drawerTitle.textContent = title;
        if (drawerIcon) drawerIcon.textContent = isCorrect ? "✓" : "✕";
        if (drawerExp) drawerExp.textContent = explanation || "";

        if (upgradesContainer) {
            const has75 = Boolean(band75 && band75.trim());
            const has85 = Boolean(band85 && band85.trim());
            if (has75 || has85) {
                upgradesContainer.style.display = "flex";
                if (u75) {
                    u75.textContent = band75 || "";
                    const item75 = u75.closest ? u75.closest('.drawer-upgrade-item') : null;
                    if (item75) item75.style.display = has75 ? "flex" : "none";
                }
                if (u85) {
                    u85.textContent = band85 || "";
                    const item85 = u85.closest ? u85.closest('.drawer-upgrade-item') : null;
                    if (item85) item85.style.display = has85 ? "flex" : "none";
                }
            } else {
                upgradesContainer.style.display = "none";
            }
        }
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
            const total = this.initialTotalQuestions || this.questions.length;
            const finalScore = Math.min(this.correctCount, total);

            if (scoreDisplay) scoreDisplay.textContent = `${finalScore} / ${total}`;
            if (streakDisplay) streakDisplay.textContent = `x${this.bestStreakInRound}`;

            window.soundManager?.playReward();
            window.mascotManager?.setEmotion("celebrate", "Đỉnh chóp! Bạn vừa hoàn thành bài học phản xạ cực đỉnh!");
            window.progressionManager?.completeNode(2);
        }
    }

    openReportModal() {
        const q = this.questions[this.currentIndex];
        if (!q && !this.currentReportQuestionId) return;
        if (q) this.currentReportQuestionId = q.id;

        const modal = document.getElementById("quiz-report-modal");
        const msg = document.getElementById("report-status-msg");
        const detailsInput = document.getElementById("report-details-input");
        const reasonSelect = document.getElementById("report-reason-select");
        const submitBtn = document.getElementById("quiz-report-submit-btn");

        if (reasonSelect) reasonSelect.value = "grammar_typo";
        if (msg) {
            msg.style.display = "none";
            msg.textContent = "";
            msg.className = "report-status-msg";
        }
        if (detailsInput) detailsInput.value = "";
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Gửi Báo Lỗi";
        }
        if (modal) modal.style.display = "flex";
    }

    closeReportModal() {
        const modal = document.getElementById("quiz-report-modal");
        if (modal) modal.style.display = "none";
    }

    async submitQuestionReport() {
        const qId = this.currentReportQuestionId || (this.questions[this.currentIndex] && this.questions[this.currentIndex].id);
        if (!qId) return;

        const reasonSelect = document.getElementById("report-reason-select");
        const detailsInput = document.getElementById("report-details-input");
        const msg = document.getElementById("report-status-msg");
        const submitBtn = document.getElementById("quiz-report-submit-btn");

        const reason = reasonSelect?.value || 'grammar_typo';
        const details = detailsInput?.value?.trim() || '';
        const uid = this.userId || localStorage.getItem('ielts_os_user_id') || 'default_user';

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Đang gửi...";
        }

        try {
            const resp = await fetch('/api/feedback/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question_id: qId,
                    user_id: uid,
                    reason: reason,
                    details: details
                })
            });
            const data = await resp.json();
            if (resp.ok && data.success) {
                if (msg) {
                    msg.className = "report-status-msg report-status-success";
                    msg.textContent = "✓ " + (data.message || "Báo lỗi đã được tiếp nhận thành công!");
                    msg.style.display = "block";
                }
                setTimeout(() => { this.closeReportModal(); }, 1600);
            } else {
                if (msg) {
                    msg.className = "report-status-msg report-status-error";
                    msg.textContent = "✕ " + (data.message || "Lỗi gửi báo cáo. Vui lòng thử lại!");
                    msg.style.display = "block";
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Gửi Báo Lỗi";
                }
            }
        } catch (err) {
            if (msg) {
                msg.className = "report-status-msg report-status-error";
                msg.textContent = "✕ Không thể kết nối máy chủ!";
                msg.style.display = "block";
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Gửi Báo Lỗi";
            }
        }
    }
}

window.quizBlitz = new QuizBlitz();
