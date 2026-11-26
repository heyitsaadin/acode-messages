import { MAX_VOICE_MS } from "../constants.js";

export class VoiceMessagesMethods {
	/* ---------- voice messages ---------- */

	fmtDur(ms) {
		const s = Math.max(0, Math.round((ms || 0) / 1000));
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
	}

	voiceMsg(m) {
		const el = this.el.bind(this);
		const $b = el("button", { class: "pp" }, this.ico("play", 20));
		const $f = el("i");
		const $d = el("span", { class: "du", text: this.fmtDur(m.duration_ms) });
		const ui = { $b, $f, $d, m };
		$b.onclick = () => this.toggleVoiceMsg(ui);
		return el("div", { class: "am-vm" }, $b, el("div", { class: "trk" }, $f), $d);
	}

	toggleVoiceMsg(ui) {
		const cur = this.vmPlay;
		if (cur && cur.ui === ui) {
			if (cur.a.paused) cur.a.play().catch(() => {});
			else cur.a.pause();
			return;
		}
		this.stopVoiceMsg();
		const a = new Audio(this.bannerSrc(ui.m.media_url));
		const total = ui.m.duration_ms || 0;
		const setIcon = (n) => this.put(ui.$b, this.ico(n, 20));
		const p = { a, ui, setIcon };
		this.vmPlay = p;
		a.onplay = () => setIcon("pause");
		a.onpause = () => setIcon("play");
		a.ontimeupdate = () => {
			const d = total || (Number.isFinite(a.duration) ? a.duration * 1000 : 0);
			ui.$f.style.width = d ? `${Math.min(100, ((a.currentTime * 1000) / d) * 100)}%` : "0";
			ui.$d.textContent = this.fmtDur(a.currentTime * 1000);
		};
		a.onended = () => {
			ui.$f.style.width = "0";
			ui.$d.textContent = this.fmtDur(total);
			setIcon("play");
			if (this.vmPlay === p) this.vmPlay = null;
		};
		a.onerror = () => {
			this.flash("Couldn't play that voice message");
			this.stopVoiceMsg();
		};
		a.play().catch(() => a.onerror?.());
	}

	stopVoiceMsg() {
		const p = this.vmPlay;
		if (!p) return;
		this.vmPlay = null;
		p.a.onplay = p.a.onpause = p.a.onended = p.a.onerror = p.a.ontimeupdate = null;
		try {
			p.a.pause();
		} catch {}
		p.ui.$f.style.width = "0";
		p.ui.$d.textContent = this.fmtDur(p.ui.m.duration_ms);
		p.setIcon("play");
	}

	// Microphone access. Acode's Android build also has to declare RECORD_AUDIO; see readme.
	async getMic() {
		try {
			const p = window.cordova?.plugins?.permissions;
			if (p?.RECORD_AUDIO) await new Promise((res) => p.requestPermission(p.RECORD_AUDIO, res, res));
		} catch {}
		return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
	}

	micError(e) {
		const n = e?.name;
		if (n === "NotAllowedError" || n === "SecurityError") return "Microphone is blocked. Allow it for Acode in Android Settings > Apps > Acode > Permissions.";
		if (n === "NotFoundError") return "No microphone found";
		return `Microphone error (${e?.message || n || "unknown"})`;
	}

	blobB64(blob) {
		return new Promise((resolve, reject) => {
			const r = new FileReader();
			r.onload = () => resolve(String(r.result).split(",")[1] || "");
			r.onerror = () => reject(new Error("Could not read the recording"));
			r.readAsDataURL(blob);
		});
	}

	async recStart() {
		const c = this.state.channel;
		if (!c || this.rec || this.recBusy) return;
		if (c.kind !== "dm" && (this.isMuted(this.group) || this.chanInfo()?.can_send === false)) return this.syncMute();
		if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) return this.flash("Voice messages aren't supported on this device");
		if (this.voice) return this.flash("Leave the voice chat first, your microphone is in use");
		this.recBusy = true;
		let stream;
		try {
			stream = await this.getMic();
		} catch (e) {
			this.recBusy = false;
			return this.flash(this.micError(e));
		}
		this.recBusy = false;
		if (this.state.channel !== c) return stream.getTracks().forEach((t) => t.stop());
		const type = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((x) => MediaRecorder.isTypeSupported?.(x));
		let mr;
		try {
			mr = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 24000 });
		} catch {
			stream.getTracks().forEach((t) => t.stop());
			return this.flash("Couldn't start recording");
		}
		const rec = { stream, mr, chunks: [], t0: Date.now(), send: false, timer: null, ch: c };
		this.rec = rec;
		mr.ondataavailable = (e) => e.data?.size && rec.chunks.push(e.data);
		mr.onstop = () => this.recDone(rec);
		mr.start(250);
		this.$bar.classList.add("recording");
		const tick = () => {
			const ms = Date.now() - rec.t0;
			this.$recT.textContent = this.fmtDur(ms);
			if (ms >= MAX_VOICE_MS) this.recStop(true);
		};
		tick();
		rec.timer = setInterval(tick, 250);
	}

	// send = true sends the clip, false throws it away.
	recStop(send) {
		const r = this.rec;
		if (!r) return;
		this.rec = null;
		r.send = !!send;
		clearInterval(r.timer);
		this.$bar?.classList.remove("recording");
		try {
			if (r.mr.state !== "inactive") r.mr.stop();
			else this.recDone(r);
		} catch {
			this.recDone(r);
		}
		r.stream.getTracks().forEach((t) => t.stop());
	}

	async recDone(r) {
		if (!r.send || r.done) return;
		r.done = true;
		const ms = Date.now() - r.t0;
		if (ms < 700) return this.flash("Recording too short");
		const blob = new Blob(r.chunks, { type: r.mr.mimeType || "audio/webm" });
		if (blob.size > 500000) return this.flash("That voice message is too long");
		try {
			await this.postMessage("", { type: "voice", data: await this.blobB64(blob), duration_ms: ms }, r.ch);
		} catch (e) {
			this.flash(e.message);
		}
	}
}
