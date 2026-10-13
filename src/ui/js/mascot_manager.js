/**
 * Mascot Manager: Cabi Mascot Interactive Expressions & Emotional Reinforcement.
 * Tái tạo từ cabi_mascot.dart trong Luyện Từ.
 */
class MascotManager {
    constructor() {
        this.currentEmotion = "idle";
        this.emotions = {
            idle: { src: "assets/mascot/cabi_01_idle.svg", defaultMsg: "Sẵn sàng bứt phá Band 7.5+ chưa nào!" },
            study: { src: "assets/mascot/cabi_02_chamhoc.svg", defaultMsg: "Tập trung cao độ! Đọc kỹ từ khóa nhé." },
            clumsy: { src: "assets/mascot/cabi_03_haudau.svg", defaultMsg: "Úi nhầm rồi! Nhìn kỹ lại collocation nào." },
            satisfied: { src: "assets/mascot/cabi_04_amap.svg", defaultMsg: "No nê vốn từ Master 450 rồi đó!" },
            celebrate: { src: "assets/mascot/cabi_05_anmung.svg", defaultMsg: "Đỉnh chóp! Chuỗi combo rực sáng!" },
            sleep: { src: "assets/mascot/cabi_06_ngu.svg", defaultMsg: "Khò khò... Bạn đi đâu thế, quay lại học đi!" }
        };
        this.idleTimeout = null;
        this.resetTimeout = null;
        this._setupInactivityDetector();
    }

    _setupInactivityDetector() {
        const resetIdle = () => {
            if (this.currentEmotion === "sleep") {
                this.setEmotion("idle", "Chào bạn quay trở lại! Tiếp tục thôi!");
            }
            clearTimeout(this.idleTimeout);
            this.idleTimeout = setTimeout(() => {
                this.setEmotion("sleep");
            }, 45000); // 45s idle -> sleep
        };

        window.addEventListener("mousemove", resetIdle, { passive: true });
        window.addEventListener("keydown", resetIdle, { passive: true });
        window.addEventListener("click", resetIdle, { passive: true });
        resetIdle();
    }

    setEmotion(emotionKey, customMsg = null, restoreAfterMs = null) {
        const config = this.emotions[emotionKey];
        if (!config) return;

        this.currentEmotion = emotionKey;
        const imgElem = document.getElementById("cabi-mascot-img");
        const msgElem = document.getElementById("cabi-mascot-speech");

        if (imgElem) {
            imgElem.src = config.src;
            imgElem.classList.remove("bounce-anim", "shake-anim");
            if (emotionKey === "celebrate") imgElem.classList.add("bounce-anim");
            if (emotionKey === "clumsy") imgElem.classList.add("shake-anim");
        }

        if (msgElem) {
            msgElem.textContent = customMsg || config.defaultMsg;
            msgElem.classList.remove("speech-pop");
            void msgElem.offsetWidth; // Trigger reflow
            msgElem.classList.add("speech-pop");
        }

        if (restoreAfterMs) {
            clearTimeout(this.resetTimeout);
            this.resetTimeout = setTimeout(() => {
                this.setEmotion("idle");
            }, restoreAfterMs);
        }
    }

    reactCorrect(combo = 1) {
        if (combo >= 5) {
            this.setEmotion("celebrate", `🔥 COMBO x${combo}! Bạn đang phản xạ như người bản xứ!`, 4000);
        } else {
            this.setEmotion("celebrate", "Chính xác tuyệt đối! +1 điểm nhớ vững!", 2500);
        }
    }

    reactWrong(explanation = null) {
        const msg = explanation ? `Đừng lo! Chú ý: ${explanation}` : "Không sao! Nhớ kỹ từ này để ôn lại nhé.";
        this.setEmotion("clumsy", msg, 3500);
    }

    reactStudy() {
        this.setEmotion("study", "Tập trung suy nghĩ và phản xạ nào!", 3000);
    }
}

window.mascotManager = new MascotManager();
