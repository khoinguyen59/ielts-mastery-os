/**
 * Placement Manager: Onboarding Gateway & 8-Question Adaptive Diagnostic Engine (< 280 lines).
 * Duolingo Gamified Aesthetic, 5 Tiers (Band 3.0+ to 8.5+), FSRS v5 Calibration.
 */
class PlacementManager {
    constructor() {
        this.diagQuestions = [];
        this.currentDiagIndex = 0;
        this.userAnswers = {};
        this.init();
    }

    getUserId() {
        return localStorage.getItem('ielts_os_user_id') || window.authManager?.currentUser?.id || 'default_user';
    }

    init() {
        const storedBand = localStorage.getItem('ielts_user_band') || '6.5';
        this.updateHeaderBandDisplay(storedBand);

        const btnOpen = document.getElementById('btn-open-placement');
        if (btnOpen) btnOpen.addEventListener('click', () => this.openOnboardingModal());
    }

    updateHeaderBandDisplay(band) {
        const span = document.getElementById('header-user-band');
        if (span) span.textContent = band;
    }

    openOnboardingModal() {
        const modal = document.getElementById('onboarding-modal');
        if (!modal) return;
        this.renderChoiceGateway();
        modal.style.display = 'flex';
    }

    closeOnboardingModal() {
        const modal = document.getElementById('onboarding-modal');
        if (modal) modal.style.display = 'none';
    }

    renderChoiceGateway() {
        const dialog = document.getElementById('onboarding-dialog-inner');
        if (!dialog) return;
        dialog.innerHTML = `
            <div style="text-align:center; margin-bottom:20px;">
                <img src="assets/mascot/cabi_academic_logo.svg" style="width:78px; height:78px; margin:0 auto 10px; display:block;" alt="Cabi">
                <h2 class="onboarding-hero-title">Xác Định Xuất Phát Điểm Học Tập 🎓</h2>
                <p class="onboarding-hero-sub">Cabi sẽ thiết lập lộ trình FSRS v5 tối ưu nhất cho bạn (Hỗ trợ từ Band 3.0+ đến 8.5+)</p>
            </div>
            <div class="onboarding-choice-grid">
                <div class="onboarding-choice-card card-recommended" id="card-choice-test">
                    <span class="choice-rec-badge">⭐ KHUYÊN DÙNG • 2 PHÚT</span>
                    <div class="choice-card-icon">📝</div>
                    <h3 class="choice-card-title">Làm Bài Test Nhanh (8 Câu)</h3>
                    <p class="choice-card-desc">Bài test thích ứng từ A2 đến C2 giúp Cabi đo lường chính xác vốn từ vựng và tự động xếp lớp chuẩn nhất.</p>
                    <button class="btn-3d-emerald" id="btn-choice-test">BẮT ĐẦU TEST NGAY 🚀</button>
                </div>
                <div class="onboarding-choice-card" id="card-choice-manual">
                    <div class="choice-card-icon">🎯</div>
                    <h3 class="choice-card-title">Tự Chọn Trình Độ Của Bạn</h3>
                    <p class="choice-card-desc">Dành cho bạn đã biết rõ Band điểm mong muốn (Gồm 5 cấp độ từ Mất Gốc 3.0 đến Xuất Sắc 8.5+).</p>
                    <button class="btn-3d-cobalt" id="btn-choice-manual">XEM 5 CẤP ĐỘ ➔</button>
                </div>
            </div>`;

        dialog.querySelector('#btn-choice-test')?.addEventListener('click', () => this.startDiagnosticTest());
        dialog.querySelector('#btn-choice-manual')?.addEventListener('click', () => this.showLevelsGrid());
    }

    async startDiagnosticDirect() {
        this.openOnboardingModal();
        await this.startDiagnosticTest();
    }

    async startDiagnosticTest() {
        const modal = document.getElementById('onboarding-modal');
        if (modal) modal.style.display = 'flex';
        this.currentDiagIndex = 0;
        this.userAnswers = {};
        const dialog = document.getElementById('onboarding-dialog-inner');
        if (!dialog) return;

        dialog.innerHTML = `
            <div style="text-align:center; padding:30px;">
                <div style="font-size:24px; font-weight:800; margin-bottom:10px;">Đang chuẩn bị bài test thích ứng...</div>
                <p style="color:#94a3b8;">Cabi đang nạp 8 câu hỏi từ vựng từ ngân hàng Cambridge 21 & CEFR.</p>
            </div>`;

        try {
            const resp = await fetch('/api/placement/test?count=8');
            const data = await resp.json();
            this.diagQuestions = data.questions || [];
            this.renderDiagQuestion();
        } catch (e) {
            console.error('Failed to start diagnostic test:', e);
            dialog.innerHTML = `<div style="text-align:center; padding:20px;">Lỗi kết nối. <button class="btn-3d-cobalt" onclick="window.placementManager.renderChoiceGateway()" style="margin-top:14px;">Quay Lại</button></div>`;
        }
    }

    renderDiagQuestion() {
        const dialog = document.getElementById('onboarding-dialog-inner');
        if (!dialog) return;
        if (this.currentDiagIndex >= this.diagQuestions.length) {
            this.submitDiagnosticTest();
            return;
        }

        const q = this.diagQuestions[this.currentDiagIndex];
        const letters = ['A', 'B', 'C', 'D'];
        const progressPct = ((this.currentDiagIndex + 1) / this.diagQuestions.length) * 100;

        dialog.innerHTML = `
            <div class="diag-wizard-container">
                <div class="diag-top-bar">
                    <button class="btn-auth-toggle" id="btn-diag-exit" style="width:auto; margin:0; padding:6px 12px;">← Thoát</button>
                    <div class="diag-progress-track">
                        <div class="diag-progress-fill" style="width:${progressPct}%;"></div>
                    </div>
                    <div class="diag-step-count">Câu ${this.currentDiagIndex + 1}/${this.diagQuestions.length}</div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <span class="diag-tier-badge">Khảo sát: ${q.tier} (Mục tiêu Band ${q.target_band})</span>
                </div>
                <h3 class="diag-question-prompt">${q.prompt}</h3>
                <div class="diag-options-grid">
                    ${q.options.map((opt, idx) => `
                        <button class="diag-opt-btn" data-index="${idx}">
                            <span class="opt-key">${letters[idx]}</span>
                            <span class="opt-text">${opt}</span>
                        </button>
                    `).join('')}
                </div>
            </div>`;

        dialog.querySelector('#btn-diag-exit')?.addEventListener('click', () => this.renderChoiceGateway());
        dialog.querySelectorAll('.diag-opt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const chosenIdx = parseInt(btn.getAttribute('data-index'), 10);
                this.userAnswers[q.id] = chosenIdx;
                this.currentDiagIndex++;
                try { window.soundManager?.playClick?.(); } catch (_) {}
                this.renderDiagQuestion();
            });
        });
    }

    async submitDiagnosticTest() {
        const dialog = document.getElementById('onboarding-dialog-inner');
        const userId = this.getUserId();
        if (!dialog) return;

        dialog.innerHTML = `
            <div style="text-align:center; padding:30px;">
                <img src="assets/mascot/cabi_academic_logo.svg" style="width:72px; height:72px; animation:cabiFloat 1.5s infinite;" alt="Loading">
                <h3 style="margin-top:14px;">Đang phân tích kết quả & cấu hình FSRS v5...</h3>
            </div>`;

        try {
            const resp = await fetch('/api/placement/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
                body: JSON.stringify({ answers: this.userAnswers, user_id: userId })
            });
            const res = await resp.json();

            dialog.innerHTML = `
                <div class="diag-result-card">
                    <img src="assets/icons/badge_trophy.svg" class="diag-trophy-img" alt="Trophy">
                    <h2 class="diag-result-title">Hoàn Thành Bài Test Chẩn Đoán! 🎉</h2>
                    <div class="diag-band-hero">Xuất phát điểm đề xuất: <span class="highlight-band">Band ${res.estimated_band}</span></div>
                    <p class="diag-result-feedback">${res.feedback || ''}</p>
                    <div class="diag-stats-summary">
                        <div>📊 Số câu chính xác: <b>${res.correct_count} / ${res.total_questions}</b> câu (${res.accuracy_pct}%)</div>
                        <div>🗺️ Lộ trình gán: <b>${res.assigned_level_title}</b></div>
                        <div>⚡ Mục tiêu từ vựng: <b>${res.recommended_daily_vocab} từ/ngày</b></div>
                    </div>
                    <button class="btn-3d-emerald diag-apply-btn" id="btn-finish-diag">
                        🚀 BẮT ĐẦU HỌC VỚI LỘ TRÌNH NÀY
                    </button>
                </div>`;

            dialog.querySelector('#btn-finish-diag')?.addEventListener('click', () => {
                localStorage.setItem('ielts_user_level', res.assigned_level_key);
                localStorage.setItem('ielts_user_band', res.estimated_band);
                localStorage.setItem('ielts_onboarding_completed', 'true');
                this.updateHeaderBandDisplay(res.estimated_band);
                if (window.authManager?.currentUser) window.authManager.currentUser.onboarding_completed = 1;
                window.progressionManager?.reloadForLevel(res.assigned_level_key);
                window.flashcardStudio?.reloadForLevel(res.assigned_level_key);
                window.mascotManager?.setEmotion('satisfied', `Chào mừng bạn đến với lộ trình Band ${res.estimated_band}!`);
                window.soundManager?.playReward();
                this.closeOnboardingModal();
            });
        } catch (e) {
            console.error('Diagnostic submission failed:', e);
            dialog.innerHTML = `<div style="text-align:center; padding:20px;">Lỗi gửi kết quả. <button class="btn-3d-cobalt" onclick="window.placementManager.renderChoiceGateway()" style="margin-top:14px;">Thử Lại</button></div>`;
        }
    }

    async showLevelsGrid() {
        const dialog = document.getElementById('onboarding-dialog-inner');
        if (!dialog) return;

        dialog.innerHTML = `
            <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                    <button class="btn-auth-toggle" id="btn-back-to-gateway" style="width:auto; margin:0; padding:6px 14px;">← Quay lại</button>
                    <h3 style="margin:0; font-size:17px; font-weight:800;">5 Cấp Độ Từ Vựng & Lộ Trình</h3>
                    <div style="width:70px;"></div>
                </div>
                <div class="levels-grid-cards" id="levels-grid-cards-area"></div>
            </div>`;

        dialog.querySelector('#btn-back-to-gateway')?.addEventListener('click', () => this.renderChoiceGateway());
        const container = dialog.querySelector('#levels-grid-cards-area');

        try {
            const resp = await fetch('/api/placement/levels');
            const levels = await resp.json();
            const currentLevel = localStorage.getItem('ielts_user_level') || 'intermediate';
            const tierColors = { starter: 'green', foundation: 'yellow', intermediate: 'blue', advanced: 'purple', mastery: 'red' };

            for (const [key, lvl] of Object.entries(levels)) {
                const card = document.createElement('div');
                card.className = `level-select-card tier-${key} ${key === currentLevel ? 'active-level' : ''}`;
                card.innerHTML = `
                    <div class="level-card-badge badge-${tierColors[key] || 'blue'}">Band ${lvl.band}</div>
                    <h4 class="level-card-title">${lvl.title}</h4>
                    <p class="level-card-desc">${lvl.description}</p>
                    <div class="level-card-meta">
                        <span>🎯 ${lvl.recommended_daily} từ/ngày</span>
                        <span>⚡ FSRS S: ${lvl.fsrs_initial_stability || 1.0}</span>
                    </div>
                    <button class="level-card-choose-btn btn-3d-${tierColors[key] || 'blue'}" style="margin-top:auto;">
                        ${key === currentLevel ? '✓ Đang Áp Dụng' : 'Chọn Trình Độ Này'}
                    </button>`;

                card.querySelector('button')?.addEventListener('click', () => this.applyLevel(key, lvl));
                container.appendChild(card);
            }
        } catch (e) { console.error('Failed to load level presets:', e); }
    }

    async applyLevel(levelKey, lvl) {
        const userId = this.getUserId();
        localStorage.setItem('ielts_user_level', levelKey);
        localStorage.setItem('ielts_user_band', lvl.band);
        localStorage.setItem('ielts_onboarding_completed', 'true');
        this.updateHeaderBandDisplay(lvl.band);

        try {
            await fetch('/api/placement/select-level', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
                body: JSON.stringify({ level_key: levelKey, user_id: userId })
            });
            if (window.authManager?.currentUser) window.authManager.currentUser.onboarding_completed = 1;
        } catch (e) { console.warn('Sync placement error:', e); }

        window.progressionManager?.reloadForLevel(levelKey);
        window.flashcardStudio?.reloadForLevel(levelKey);
        window.mascotManager?.setEmotion('satisfied', `Đã kích hoạt lộ trình ${lvl.title}! Bắt đầu nạp từ vựng.`);
        window.soundManager?.playReward();
        this.closeOnboardingModal();
    }
}

window.placementManager = new PlacementManager();
