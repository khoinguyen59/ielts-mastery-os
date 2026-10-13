/**
 * Energy Manager: 5-Heart Energy & Refill Lifecycle (R5).
 * Modular Gamified Architecture (< 160 lines).
 */
class EnergyManager {
    constructor() {
        this.maxHearts = 5;
        this.hearts = parseInt(localStorage.getItem('ielts_os_hearts') || '5');
        this.coins = parseInt(localStorage.getItem('ielts_os_coins') || '120');
        this.isExhausted = this.hearts <= 0;
        this.userId = 'default_user';
    }

    init(user) {
        if (user) {
            this.userId = user.id || this.userId;
            if (typeof user.hearts === 'number') this.hearts = user.hearts;
            if (typeof user.coins === 'number') this.coins = user.coins;
            this.isExhausted = this.hearts <= 0;
        }
        this._ensureModalDOM();
        this.updateUI();
    }

    canStartLesson() {
        if (this.hearts <= 0) {
            this.showExhaustedModal();
            return false;
        }
        return true;
    }

    deductHeart() {
        if (this.hearts <= 0) return { hearts: 0, isExhausted: true };
        this.hearts = Math.max(0, this.hearts - 1);
        this.isExhausted = this.hearts === 0;
        this._save();
        this.updateUI();

        if (this.isExhausted) {
            window.soundManager?.playWrong();
            window.mascotManager?.setEmotion('clumsy', 'Bạn đã hết Tim! Hãy ôn bài hoặc nạp Coin để tiếp tục nhé!', 4000);
            this.showExhaustedModal();
        }

        fetch('/api/user/hearts/deduct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: this.userId })
        }).catch(() => {});

        return { hearts: this.hearts, isExhausted: this.isExhausted };
    }

    refillWithCoins(cost = 50) {
        if (this.coins < cost) {
            alert(`Không đủ Coin! Bạn cần ${cost} Coin nhưng hiện chỉ có ${this.coins} Coin.`);
            return false;
        }
        this.coins -= cost;
        this.hearts = this.maxHearts;
        this.isExhausted = false;
        this._save();
        this.updateUI();
        this.closeExhaustedModal();

        window.soundManager?.playReward();
        window.mascotManager?.setEmotion('celebrate', '🎉 Đã nạp đầy 5 Tim! Tiếp tục học tập nào!', 3500);

        fetch('/api/user/hearts/refill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: this.userId, refill_type: 'coins' })
        }).catch(() => {});

        return true;
    }

    recoverViaPractice() {
        this.hearts = Math.min(this.maxHearts, this.hearts + 1);
        this.isExhausted = false;
        this._save();
        this.updateUI();
        this.closeExhaustedModal();

        window.soundManager?.playCorrect();
        window.mascotManager?.setEmotion('satisfied', '❤️ +1 Tim từ bài ôn tập! Tiếp tục phát huy nhé!', 3000);

        fetch('/api/user/hearts/refill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: this.userId, refill_type: 'practice' })
        }).catch(() => {});

        return true;
    }

    showExhaustedModal() {
        this._ensureModalDOM();
        const m = document.getElementById('energy-exhausted-modal');
        if (m) m.style.display = 'flex';
    }

    closeExhaustedModal() {
        const m = document.getElementById('energy-exhausted-modal');
        if (m) m.style.display = 'none';
    }

    updateUI() {
        const hVal = document.getElementById('topbar-heart-val');
        if (hVal) hVal.textContent = this.hearts;
        const cVal = document.getElementById('topbar-coin-val');
        if (cVal) cVal.textContent = this.coins;
    }

    _save() {
        localStorage.setItem('ielts_os_hearts', this.hearts.toString());
        localStorage.setItem('ielts_os_coins', this.coins.toString());
    }

    _ensureModalDOM() {
        if (document.getElementById('energy-exhausted-modal')) return;
        const div = document.createElement('div');
        div.id = 'energy-exhausted-modal';
        div.className = 'modal-overlay';
        div.style.display = 'none';
        div.innerHTML = `
            <div class="modal-dialog energy-exhausted-dialog">
                <div class="modal-header">
                    <div><h3 style="margin:0; color:#ef4444; font-size:18px;">Hết Tim Năng Lượng! ❤️</h3>
                    <p style="margin:4px 0 0; font-size:12px; color:#94a3b8;">Bạn cần tim để tiếp tục làm các bài học mới</p></div>
                    <button class="close-x" onclick="window.energyManager.closeExhaustedModal()">&times;</button>
                </div>
                <div class="energy-mascot-row"><span class="mascot-clumsy-head">🐹💔</span></div>
                <div class="energy-options-grid">
                    <div class="energy-option-card">
                        <div><div class="energy-option-icon">📖</div>
                        <div class="energy-option-title">Ôn Lại Từ Cũ</div>
                        <div class="energy-option-desc">Ôn thẻ từ vựng đã học để phục hồi +1 Tim miễn phí.</div></div>
                        <button class="btn-3d btn-3d-blue" style="width:100%;" onclick="window.energyManager.recoverViaPractice()">+1 TIM ❤️</button>
                    </div>
                    <div class="energy-option-card">
                        <div><div class="energy-option-icon">🪙</div>
                        <div class="energy-option-title">Nạp Bằng Coin</div>
                        <div class="energy-option-desc">Đổi 50 Coins tích lũy để làm đầy ngay 5 Tim năng lượng.</div></div>
                        <button class="btn-3d btn-3d-green" style="width:100%;" onclick="window.energyManager.refillWithCoins(50)">50 COIN ➔ 5 TIM</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(div);
    }
}

window.energyManager = new EnergyManager();
