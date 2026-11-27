// A short "pop" when a message is sent. It is made with WebAudio, so there is no sound file to
// package or download. It can be turned off in the plugin settings ("Send sound").
export class SoundMethods {
	/* ---------- sounds ---------- */

	sendSoundOn() {
		return this.settings.sendSound !== false;
	}

	// Browsers only let audio start after a tap. Call this from the tap that sends, then play the
	// sound later when the server confirms.
	primeSound() {
		if (!this.sendSoundOn()) return;
		try {
			const AC = window.AudioContext || window.webkitAudioContext;
			if (!AC) return;
			if (!this.sfxCtx) this.sfxCtx = new AC();
			if (this.sfxCtx.state === "suspended") this.sfxCtx.resume();
		} catch {}
	}

	playSendSound() {
		if (!this.sendSoundOn()) return;
		try {
			this.primeSound();
			const ctx = this.sfxCtx;
			if (!ctx) return;
			const t = ctx.currentTime;
			const gain = ctx.createGain();
			gain.connect(ctx.destination);
			gain.gain.setValueAtTime(0.0001, t);
			gain.gain.exponentialRampToValueAtTime(0.14, t + 0.012);
			gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
			const osc = ctx.createOscillator();
			osc.type = "sine";
			osc.frequency.setValueAtTime(620, t);
			osc.frequency.exponentialRampToValueAtTime(930, t + 0.07);
			osc.connect(gain);
			osc.start(t);
			osc.stop(t + 0.17);
		} catch {}
	}
}
