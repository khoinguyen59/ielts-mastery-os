/**
 * Sound Manager: Audio Sensory Feedback & Study Ambiance.
 * Tái tạo từ game_sound_service.dart trong Luyện Từ & Duolingo.
 */
class SoundManager {
    constructor() {
        this.sfxEnabled = true;
        this.bgmEnabled = false;
        this.currentBgmIndex = 0;
        this.bgmTracks = [
            "assets/audio/music_at_ease.mp3",
            "assets/audio/music_slowburn.mp3",
            "assets/audio/music_fancy_park.mp3"
        ];
        this.audioCache = {};
        this.bgmAudio = null;
        this._loadPreferences();
        this._preloadSounds();
    }

    _loadPreferences() {
        try {
            const p = JSON.parse(localStorage.getItem("ielts_os_sound_prefs") || "{}");
            this.sfxEnabled = p.sfxEnabled ?? true;
            this.bgmEnabled = p.bgmEnabled ?? false;
        } catch (_) {}
    }

    _savePreferences() {
        try {
            localStorage.setItem("ielts_os_sound_prefs", JSON.stringify({ sfxEnabled: this.sfxEnabled, bgmEnabled: this.bgmEnabled }));
        } catch (_) {}
    }

    _preloadSounds() {
        const sfxFiles = {
            correct: "assets/audio/answer_correct.wav",
            wrong: "assets/audio/answer_wrong.wav",
            reward: "assets/audio/coin_reward.mp3"
        };
        for (const [key, path] of Object.entries(sfxFiles)) {
            const audio = new Audio(path);
            audio.preload = "auto";
            this.audioCache[key] = audio;
        }

        this.bgmAudio = new Audio(this.bgmTracks[0]);
        this.bgmAudio.loop = true;
        this.bgmAudio.volume = 0.22;
    }

    playCorrect() {
        if (!this.sfxEnabled) return;
        const snd = this.audioCache.correct;
        if (snd) {
            snd.currentTime = 0;
            snd.play().catch(() => {});
        }
    }

    playClick() {
        if (!this.sfxEnabled) return;
        const snd = this.audioCache.reward || this.audioCache.correct;
        if (snd) {
            snd.currentTime = 0;
            snd.play().catch(() => {});
        }
    }

    playWrong() {
        if (!this.sfxEnabled) return;
        const snd = this.audioCache.wrong;
        if (snd) {
            snd.currentTime = 0;
            snd.play().catch(() => {});
        }
    }

    playReward() {
        if (!this.sfxEnabled) return;
        const snd = this.audioCache.reward;
        if (snd) {
            snd.currentTime = 0;
            snd.play().catch(() => {});
        }
    }

    playLock() {
        if (!this.sfxEnabled) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(140, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.11);
        } catch (_) {}
    }

    toggleSfx() {
        this.sfxEnabled = !this.sfxEnabled;
        this._savePreferences();
        return this.sfxEnabled;
    }

    toggleBgm() {
        this.bgmEnabled = !this.bgmEnabled;
        if (this.bgmEnabled) {
            if (this.bgmAudio) {
                this.bgmAudio.play().catch(e => {
                    console.log("Audio autoplay prevented, user interaction required:", e);
                });
            }
        } else {
            if (this.bgmAudio) {
                this.bgmAudio.pause();
            }
        }
        this._savePreferences();
        return this.bgmEnabled;
    }

    nextBgmTrack() {
        this.currentBgmIndex = (this.currentBgmIndex + 1) % this.bgmTracks.length;
        const wasPlaying = !this.bgmAudio.paused;
        this.bgmAudio.pause();
        this.bgmAudio = new Audio(this.bgmTracks[this.currentBgmIndex]);
        this.bgmAudio.loop = true;
        this.bgmAudio.volume = 0.22;
        if (wasPlaying && this.bgmEnabled) {
            this.bgmAudio.play().catch(() => {});
        }
    }

    speakWord(word) {
        if (!('speechSynthesis' in window) || !word) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = "en-US";
        utterance.rate = 0.92;
        window.speechSynthesis.speak(utterance);
    }
}

window.soundManager = new SoundManager();
