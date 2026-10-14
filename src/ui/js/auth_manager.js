/**
 * IELTS Mastery OS — Gamified Auth & Profile Gateway Manager (< 220 lines).
 * Features: Cabi Mascot Welcome, 1-Click Guest Access, Multi-Profile Switcher.
 */
class AuthManager {
    constructor() {
        this.token = localStorage.getItem('ielts_os_auth_token') || null;
        this.currentUser = null;
        this.viewMode = 'quick'; // 'quick' | 'form'
        this.currentTab = 'login';
    }

    async init() {
        if (this.token) {
            try {
                const res = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${this.token}` } });
                const data = await res.json();
                if (data.success && data.user) {
                    this.currentUser = data.user;
                    this.renderBadge();
                    window.progressionManager?.init(data.user);
                    window.energyManager?.init(data.user);
                    if (!data.user.onboarding_completed) {
                        window.placementManager?.openOnboardingModal();
                    }
                    return;
                }
            } catch (e) { console.warn('Session check failed:', e); }
        }
        this.showWelcomeModal('quick');
    }

    showWelcomeModal(mode = 'quick') {
        let overlay = document.getElementById('auth-welcome-modal');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'auth-welcome-modal';
            overlay.className = 'auth-modal-overlay';
            document.body.appendChild(overlay);
        }
        this.viewMode = mode;
        this.renderModalContent(overlay);
        overlay.style.display = 'flex';
    }

    renderModalContent(overlay) {
        if (this.viewMode === 'quick') {
            overlay.innerHTML = `
                <div class="auth-dialog">
                    <div class="auth-mascot-hero">
                        <img src="assets/mascot/cabi_academic_logo.svg" class="auth-mascot-img" alt="Cabi Mascot">
                        <div class="cabi-speech-bubble">
                            "Chào mừng bạn đến với IELTS Mastery OS 🎓! Cùng Cabi chinh phục mục tiêu IELTS 7.0+ nhé."
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:12px; margin-top:20px;">
                        <button type="button" class="btn-3d-emerald" id="btn-auth-guest-quick">
                            ⚡ VÀO HỌC NGAY (1-Click Không Cần Đăng Ký)
                        </button>
                        <button type="button" class="btn-3d-cobalt" id="btn-show-auth-form">
                            👤 ĐÃ CÓ TÀI KHOẢN / ĐĂNG KÝ
                        </button>
                    </div>
                </div>`;
            overlay.querySelector('#btn-auth-guest-quick')?.addEventListener('click', () => this.handleGuestClick());
            overlay.querySelector('#btn-show-auth-form')?.addEventListener('click', () => {
                this.viewMode = 'form';
                this.renderModalContent(overlay);
            });
            return;
        }

        overlay.innerHTML = `
            <div class="auth-dialog">
                <div class="auth-mascot-hero">
                    <img src="assets/mascot/cabi_academic_logo.svg" style="width:64px;height:64px;" alt="Cabi">
                    <h3 style="margin:8px 0 2px; font-size:18px; font-weight:800;">Hồ Sơ Học Viên</h3>
                </div>
                <div class="auth-tabs" style="display:flex; gap:8px; margin-bottom:14px; background:#1e293b; padding:4px; border-radius:12px;">
                    <button class="auth-tab-btn ${this.currentTab === 'login' ? 'active' : ''}" id="tab-auth-login" style="flex:1; padding:8px; border:none; background:${this.currentTab === 'login' ? '#0284c7' : 'transparent'}; color:#fff; font-weight:700; border-radius:8px; cursor:pointer;">Đăng Nhập</button>
                    <button class="auth-tab-btn ${this.currentTab === 'register' ? 'active' : ''}" id="tab-auth-reg" style="flex:1; padding:8px; border:none; background:${this.currentTab === 'register' ? '#0284c7' : 'transparent'}; color:#fff; font-weight:700; border-radius:8px; cursor:pointer;">Tạo Tài Khoản</button>
                </div>
                <div class="auth-error-msg" id="auth-error-box"></div>
                <form id="auth-form" onsubmit="return false;" class="auth-form-card">
                    <div class="auth-form-group"><label class="auth-label">Tên đăng nhập</label><input type="text" class="auth-input" id="auth-username" required placeholder="vd: hocvien_70"></div>
                    <div class="auth-form-group" id="group-auth-name" style="display:${this.currentTab === 'register' ? 'block' : 'none'}"><label class="auth-label">Tên hiển thị</label><input type="text" class="auth-input" id="auth-display-name" placeholder="vd: Minh Quân"></div>
                    <div class="auth-form-group"><label class="auth-label">Mật khẩu</label><input type="password" class="auth-input" id="auth-password" required placeholder="••••••••"></div>
                    <button class="btn-3d-cobalt" id="btn-auth-submit" style="margin-top:10px;">${this.currentTab === 'login' ? 'Đăng Nhập' : 'Tạo Tài Khoản & Vào Học'}</button>
                </form>
                <button type="button" class="btn-auth-toggle" id="btn-back-to-quick">← Quay lại chế độ 1-Click</button>
            </div>`;

        overlay.querySelector('#tab-auth-login')?.addEventListener('click', () => { this.currentTab = 'login'; this.renderModalContent(overlay); });
        overlay.querySelector('#tab-auth-reg')?.addEventListener('click', () => { this.currentTab = 'register'; this.renderModalContent(overlay); });
        overlay.querySelector('#btn-auth-submit')?.addEventListener('click', () => this.handleAuthSubmit());
        overlay.querySelector('#btn-back-to-quick')?.addEventListener('click', () => { this.viewMode = 'quick'; this.renderModalContent(overlay); });
    }

    async handleAuthSubmit() {
        const username = document.getElementById('auth-username')?.value.trim();
        const password = document.getElementById('auth-password')?.value;
        const displayName = document.getElementById('auth-display-name')?.value.trim();
        if (!username || !password) return this.showError('Vui lòng nhập tên đăng nhập và mật khẩu');
        const endpoint = this.currentTab === 'login' ? '/api/auth/login' : '/api/auth/register';
        const payload = this.currentTab === 'login' ? { username, password } : { username, password, display_name: displayName };
        try {
            const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Thao tác thất bại');
            this.onAuthSuccess(data);
        } catch (err) { this.showError(err.message); }
    }

    async handleGuestClick() {
        try {
            const res = await fetch('/api/auth/guest', { method: 'POST' });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Tạo hồ sơ khách thất bại');
            this.onAuthSuccess(data);
        } catch (err) { this.showError(err.message); }
    }

    showError(msg) {
        const box = document.getElementById('auth-error-box');
        if (box) { box.textContent = msg; box.style.display = 'block'; }
    }

    onAuthSuccess(data) {
        this.token = data.token;
        this.currentUser = data.user;
        localStorage.setItem('ielts_os_auth_token', data.token);
        localStorage.setItem('ielts_os_user_id', data.user.id);
        const overlay = document.getElementById('auth-welcome-modal');
        if (overlay) overlay.style.display = 'none';
        this.renderBadge();
        window.soundManager?.playSuccess();
        window.progressionManager?.init(data.user);
        window.energyManager?.init(data.user);

        // Sync local guest progress if user logged in or registered
        if (!data.is_guest && window.localStore) {
            try {
                const localScores = window.localStore.getScores();
                const localStreak = window.localStore.getStreak();
                const localCoins = parseInt(localStorage.getItem('ielts_os_coins') || '100');
                if (Object.keys(localScores).length > 0 || localStreak.current > 1 || localCoins > 100) {
                    fetch('/api/auth/sync-guest', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${data.token}`
                        },
                        body: JSON.stringify({
                            userId: data.user.id,
                            scores: localScores,
                            streak: localStreak,
                            coins: localCoins
                        })
                    }).catch(() => {});
                }
            } catch (e) {}
        }

        // Always open the placement gate if user has not completed onboarding
        if (window.placementManager) {
            window.placementManager.openOnboardingModal();
        }
    }

    renderBadge() {
        const container = document.getElementById('topbar-user-badge');
        if (!container || !this.currentUser) return;
        const u = this.currentUser;
        const targetBand = u.target_band ? u.target_band.split(' ')[0] : '7.0';
        container.innerHTML = `
            <div class="topbar-profile-badge" id="btn-profile-badge" title="Tài khoản: ${u.display_name}">
                <span class="profile-badge-avatar"><img src="assets/mascot/cabi_academic_logo.svg" alt="Avatar"></span>
                <span class="profile-badge-name">${u.display_name || u.username}</span>
                <span class="profile-badge-tag">Band ${targetBand}</span>
            </div>
            <div class="profile-dropdown-menu" id="profile-dropdown-menu"></div>`;
        document.getElementById('btn-profile-badge')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });
        document.addEventListener('click', () => {
            document.getElementById('profile-dropdown-menu')?.classList.remove('show');
        });
    }

    async toggleDropdown() {
        const menu = document.getElementById('profile-dropdown-menu');
        if (!menu) return;
        if (menu.classList.contains('show')) { menu.classList.remove('show'); return; }
        try {
            const res = await fetch('/api/auth/profiles');
            const data = await res.json();
            const profiles = data.profiles || [];
            menu.innerHTML = `
                <div class="profile-dropdown-header">Hồ sơ học viên trên thiết bị</div>
                ${profiles.map(p => `
                    <button class="profile-item-btn ${p.id === this.currentUser?.id ? 'active-profile' : ''}" data-user-id="${p.id}">
                        <span>${p.is_guest ? '⚡' : '👤'} ${p.display_name || p.username}</span>
                        <span class="profile-badge-tag">${p.target_band || '7.5'}</span>
                    </button>`).join('')}
                <div style="height:1px; background:#1e3a8a; margin:4px 0;"></div>
                <button class="profile-switch-action-btn" id="btn-dropdown-switch-acc">➕ Đăng nhập tài khoản khác</button>
                <button class="profile-switch-action-btn" id="btn-dropdown-retest">📝 Làm lại bài Test đầu vào</button>`;
            menu.querySelectorAll('.profile-item-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const uid = btn.dataset.userId;
                    if (uid && uid !== this.currentUser?.id) await this.switchProfile(uid);
                });
            });
            document.getElementById('btn-dropdown-switch-acc')?.addEventListener('click', () => {
                menu.classList.remove('show');
                this.showWelcomeModal('form');
            });
            document.getElementById('btn-dropdown-retest')?.addEventListener('click', () => {
                menu.classList.remove('show');
                window.placementManager?.startDiagnosticDirect();
            });
            menu.classList.add('show');
        } catch (e) { console.error('Failed to load profiles:', e); }
    }

    async switchProfile(userId) {
        try {
            const res = await fetch('/api/auth/switch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });
            const data = await res.json();
            if (data.success) { this.onAuthSuccess(data); location.reload(); }
        } catch (e) { console.error('Profile switch failed:', e); }
    }
}

window.authManager = new AuthManager();
