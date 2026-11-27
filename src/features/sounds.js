// Two short sounds, made with WebAudio so there is no sound file to package or download:
// a rising "pop" when you send a message and a soft two-note "ding" when someone else's arrives.
// Each can be turned off in the plugin settings ("Send sound", "Receive sound").
export class SoundMethods {
	/* ---------- sounds ---------- */

	sendSoundOn() {
		return this.settings.sendSound !== false;
	}

	receiveSoundOn() {
		return this.settings.receiveSound !== false;
	}

	// Browsers only let audio start after a tap. Call this from a tap (the send tap, or any tap in the
	// chat) so the sound can play later, when the server confirms or a message arrives.
	primeSound() {
		if (!this.sendSoundOn() && !this.receiveSoundOn()) return;
		try {
			const AC = window.AudioContext || window.webkitAudioContext;
			if (!AC) return;
			if (!this.sfxCtx) this.sfxCtx = new AC();
			if (this.sfxCtx.state === "suspended") this.sfxCtx.resume();
		} catch {}
	}

	// One sine note with a quick fade in and out. Returns nothing; it cleans itself up.
	tone(ctx, from, to, start, dur, vol) {
		const gain = ctx.createGain();
		gain.connect(ctx.destination);
		gain.gain.setValueAtTime(0.0001, start);
		gain.gain.exponentialRampToValueAtTime(vol, start + 0.012);
		gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
		const osc = ctx.createOscillator();
		osc.type = "sine";
		osc.frequency.setValueAtTime(from, start);
		if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, start + dur * 0.45);
		osc.connect(gain);
		osc.start(start);
		osc.stop(start + dur + 0.01);
	}

	playSendSound() {
		if (!this.sendSoundOn()) return;
		try {
			this.primeSound();
			const ctx = this.sfxCtx;
			if (!ctx) return;
			this.tone(ctx, 620, 930, ctx.currentTime, 0.16, 0.14);
		} catch {}
	}

	// Lower and softer than the send sound, and in two steps going down, so the two are easy to tell apart.
	playReceiveSound() {
		if (!this.receiveSoundOn()) return;
		const now = Date.now();
		if (now - (this.rxAt || 0) < 400) return; // a burst of messages is one ding, not a rattle
		this.rxAt = now;
		try {
			this.primeSound();
			const ctx = this.sfxCtx;
			if (!ctx || ctx.state !== "running") return; // nobody has tapped yet, so the browser would block it anyway
			const t = ctx.currentTime;
			this.tone(ctx, 988, 988, t, 0.11, 0.1);
			this.tone(ctx, 740, 740, t + 0.085, 0.16, 0.1);
		} catch {}
	}
}
