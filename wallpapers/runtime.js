/*
 * LW wallpaper runtime — one shared optimisation and telemetry layer for every WebGPU wallpaper.
 *
 * Loaded from <head> before the wallpaper's own script, so the patches are in place before the
 * first `devicePixelRatio` read, before the first `requestAdapter()` and before the first frame.
 *
 * What it does
 *   - caps and scales the reported devicePixelRatio (resolution setting) and re-fires `resize`
 *   - rebuilds requestAnimationFrame on a virtual clock: pause, playback speed and a frame-rate cap
 *   - asks for the discrete GPU (`powerPreference: high-performance`) unless the wallpaper overrides it
 *   - reports init, frame, device-loss and console errors upward; the shell owns the error UI
 *   - reports measured FPS to the parent shell once per second
 *
 * Protocol (postMessage, both directions; every payload carries the wallpaper `slug`)
 *   parent -> frame : { type: 'wp:config', speed, fps, dpr, paused }
 *                     { type: 'wp:apply', action, value, transient? }
 *                     { type: 'wp:stateQuery' } | { type: 'wp:reset' } | { type: 'wp:ping' }
 *   frame  -> parent: { type: 'wp:ready' | 'wp:firstframe' | 'wp:fps' | 'wp:gpu' | 'wp:error' }
 */
(() => {
	'use strict';
	if (window.__LW_RUNTIME__) return;

	const nativeRAF = window.requestAnimationFrame.bind(window);
	const nativeCAF = window.cancelAnimationFrame.bind(window);
	const nativeNow = performance.now.bind(performance);
	const nativeConsoleError = console.error.bind(console);
	const HARD_DPR_CAP = 2;

	// Read the real DPR through the original accessor, so zoom / monitor changes still work after
	// the property below is redefined.
	const readNativeDpr = (() => {
		const own = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
		const proto = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window), 'devicePixelRatio');
		const desc = own && own.get ? own : proto && proto.get ? proto : null;
		if (desc) return () => Number(desc.get.call(window)) || 1;
		const initial = Number(window.devicePixelRatio) || 1;
		return () => initial;
	})();

	const SLUG = document.documentElement.dataset.lwSlug || '';
	const preview = new URLSearchParams(location.search).get('preview') === '1';

	const state = {
		speed: 1,
		// Gallery previews run cheap: 30 fps and ~60% resolution, one document at a time.
		fps: preview ? 30 : 60,
		/** <1 lowers the render resolution, 1 is native (still capped at 2x). */
		dpr: preview ? 0.6 : 1,
		paused: false,
		/** What the user asked for. The document visibility pause is applied on top of this. */
		userPaused: false,
		/** Pause requested by the WallpaperGPU host (idle freeze / hidden wallpaper). */
		hostPaused: false
	};

	/* ---------------------------------------------------------------- resolution */

	Object.defineProperty(window, 'devicePixelRatio', {
		configurable: true,
		get() {
			return Math.min(readNativeDpr(), HARD_DPR_CAP) * state.dpr;
		}
	});

	function applyDpr(scale) {
		const next = Math.max(0.35, Math.min(1, Number(scale) || 1));
		if (Math.abs(next - state.dpr) < 0.001) return;
		state.dpr = next;
		// Two ticks: one for the code that reads devicePixelRatio, one for layout-driven handlers.
		window.dispatchEvent(new Event('resize'));
		setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
	}

	/* ------------------------------------------------------------ virtual clock */

	let virtualNow = nativeNow();
	let lastReal = null;
	let lastEmit = -Infinity;
	let scheduled = false;
	let nextId = 1;
	let firstFrameSent = false;
	const pending = new Map();
	let framesThisSecond = 0;
	let fpsWindowStart = nativeNow();

	performance.now = () => virtualNow;

	function schedule() {
		if (scheduled || state.paused || pending.size === 0) return;
		scheduled = true;
		nativeRAF(loop);
	}

	function loop(real) {
		scheduled = false;
		if (state.paused) return;
		if (lastReal === null) lastReal = real;
		let dt = real - lastReal;
		lastReal = real;
		if (dt > 250) dt = 250;
		virtualNow += dt * state.speed;

		const frameMs = state.fps > 0 ? 1000 / state.fps : 0;
		// Allow a small tolerance so a 60 fps cap is not silently reduced to 48 fps on a 144 Hz panel.
		if (frameMs === 0 || real - lastEmit >= frameMs * 0.9) {
			lastEmit = frameMs > 0 ? Math.max(lastEmit + frameMs, real - frameMs) : real;
			framesThisSecond++;
			if (real - fpsWindowStart >= 1000) {
				post({ type: 'wp:fps', fps: Math.round((framesThisSecond * 1000) / (real - fpsWindowStart)) });
				framesThisSecond = 0;
				fpsWindowStart = real;
			}
			const batch = [...pending.entries()];
			pending.clear();
			for (const [, cb] of batch) {
				try {
					cb(virtualNow);
				} catch (err) {
					report(err);
				}
			}
			if (!firstFrameSent) {
				firstFrameSent = true;
				post({ type: 'wp:firstframe' });
			}
		}
		if (pending.size) schedule();
	}

	window.requestAnimationFrame = (cb) => {
		const id = nextId++;
		pending.set(id, cb);
		schedule();
		return id;
	};
	window.cancelAnimationFrame = (id) => pending.delete(id);

	function setPaused(paused) {
		const next = !!paused;
		if (next === state.paused) return;
		state.paused = next;
		lastReal = null;
		if (!next) schedule();
	}

	/** The user, host and browser-hidden pauses are tracked separately. */
	function syncPaused() {
		setPaused(state.userPaused || state.hostPaused || document.hidden);
	}

	/** Used by the WallpaperGPU bridge for smart-idle freezes without clobbering user pause. */
	function setHostPaused(paused) {
		state.hostPaused = !!paused;
		syncPaused();
	}

	function setSpeed(speed) {
		state.speed = Math.max(0.05, Math.min(4, Number(speed) || 1));
	}

	function setFps(fps) {
		const n = Number(fps);
		state.fps = n > 0 ? Math.max(15, Math.min(240, n)) : 0;
	}

	/* ------------------------------------------------------------------ channel */

	function notifyHostGpu(status) {
		// Android WebView host (WgpuWebBridge) uses this to show a Canvas2D fallback when the
		// device cannot create a WebGPU adapter. Browsers don't expose WallpaperGPUHost.
		try {
			window.WallpaperGPUHost?.onGpuStatus?.(!!status.supported, String(status.error || ''));
		} catch {
			/* host bridge is optional */
		}
	}

	function post(message) {
		const payload = { ...message, slug: SLUG };
		if (window.parent && window.parent !== window) {
			const target = location.origin && location.origin !== 'null' ? location.origin : '*';
			window.parent.postMessage(payload, target);
		}
		window.dispatchEvent(new CustomEvent('lw:message', { detail: payload }));
	}

	const seenErrors = new Set();
	let errorCount = 0;

	function errorText(err) {
		if (err && typeof err === 'object') {
			if (err.message) return String(err.message);
			if (err.reason) return String(err.reason);
		}
		return String(err ?? 'Unknown error');
	}

	function report(err) {
		const message = errorText(err).trim().slice(0, 500);
		if (!message || message === 'Script error.') return;
		nativeConsoleError('[LW]', err);
		// The shell shows a banner, so a broken render loop must not turn into a message flood.
		if (seenErrors.has(message) || errorCount >= 5) return;
		seenErrors.add(message);
		errorCount++;
		post({ type: 'wp:error', message });
	}

	// The shell is the only place that shows errors. Wallpapers report and move on.
	window.__LW_REPORT_ERROR__ = report;

	// Caught errors never reach window.onerror; forward them from console.error instead.
	console.error = (...args) => {
		nativeConsoleError(...args);
		const message = args.map(errorText).join(' ').trim();
		if (message && !message.startsWith('[LW]')) report(message);
	};

	window.addEventListener('error', (event) => {
		// Resource-level errors (a missing image, for example) have no message; they are not JS
		// exceptions and must not turn into a shell banner.
		if (event.error) report(event.error);
		else if (event.message) report(event.message);
	});
	window.addEventListener('unhandledrejection', (event) => report(event.reason));

	/* ------------------------------------------------------------------- device */

	const watchedDevices = new WeakSet();
	const wrappedAdapters = new WeakSet();

	function watchDevice(device) {
		if (!device || watchedDevices.has(device)) return device;
		watchedDevices.add(device);
		device.lost?.then((info) => {
			// `destroyed` is an intentional teardown (iframe unmount / failed init), not a crash.
			if (info?.reason === 'destroyed') return;
			report(`GPU device lost${info?.message ? `: ${info.message}` : ''}. Reload the wallpaper to continue.`);
		});
		device.addEventListener?.('uncapturederror', (event) => {
			report(event?.error?.message || 'WebGPU validation error');
		});
		return device;
	}

	if (!navigator.gpu || typeof navigator.gpu.requestAdapter !== 'function') {
		const status = {
			supported: false,
			secure: window.isSecureContext,
			error: 'navigator.gpu is missing. WebGPU needs HTTPS or localhost and a browser with WebGPU enabled.'
		};
		notifyHostGpu(status);
		post({ type: 'wp:gpu', ...status });
	} else {
		const nativeRequestAdapter = navigator.gpu.requestAdapter.bind(navigator.gpu);

		const attemptList = (options) => {
			const list = [];
			// Prefer the discrete GPU, but never let a refused preference look like "no WebGPU".
			if (!options || !options.powerPreference) list.push({ powerPreference: 'high-performance', ...(options || {}) });
			if (options) list.push(options);
			list.push({});
			if (!options || !options.powerPreference) list.push({ powerPreference: 'low-power' });
			// Last resort: a software WebGPU adapter (SwiftShader / WARP) when the hardware one is blocklisted.
			if (!options || !options.forceFallbackAdapter) list.push({ forceFallbackAdapter: true });
			return list;
		};

		const tryAll = async (list) => {
			let lastError = null;
			for (const attempt of list) {
				try {
					const adapter = await nativeRequestAdapter(attempt);
					if (adapter) return { adapter, attempt, lastError };
				} catch (err) {
					lastError = err;
				}
			}
			return { adapter: null, attempt: null, lastError };
		};

		const reportGpu = (status) => {
			window.__LW_GPU_STATUS__ = status;
			notifyHostGpu(status);
			post({ type: 'wp:gpu', ...status });
		};

		navigator.gpu.requestAdapter = async (options) => {
			const list = attemptList(options);
			let result = await tryAll(list);
			// A cold GPU process can return null on the very first request; retry once after a beat.
			if (!result.adapter) {
				await new Promise((resolve) => setTimeout(resolve, 400));
				result = await tryAll(list);
			}
			if (result.adapter) {
				const adapter = result.adapter;
				if (!wrappedAdapters.has(adapter) && typeof adapter.requestDevice === 'function') {
					wrappedAdapters.add(adapter);
					const nativeRequestDevice = adapter.requestDevice.bind(adapter);
					try {
						adapter.requestDevice = async (descriptor) => watchDevice(await nativeRequestDevice(descriptor));
					} catch {
						// Some engines expose non-writable host objects. Rendering still works; the shell
						// simply relies on the adapter status and window error events.
					}
				}
				reportGpu({
					supported: true,
					secure: window.isSecureContext,
					powerPreference: result.attempt?.powerPreference ?? null,
					fallbackAdapter: !!result.attempt?.forceFallbackAdapter,
					info: {
						vendor: adapter.info?.vendor || '',
						architecture: adapter.info?.architecture || '',
						device: adapter.info?.device || '',
						description: adapter.info?.description || ''
					}
				});
				return adapter;
			}
			reportGpu({
				supported: false,
				secure: window.isSecureContext,
				error: result.lastError ? String(result.lastError.message || result.lastError) : 'requestAdapter() returned null'
			});
			return null;
		};
	}

	/* ------------------------------------------------------------------ messages */

	window.addEventListener('message', (event) => {
		if (window.parent !== window && event.source !== window.parent) return;
		const data = event.data;
		if (!data || typeof data !== 'object') return;
		if (data.type === 'wp:config') {
			if (data.speed !== undefined) setSpeed(data.speed);
			if (data.fps !== undefined) setFps(data.fps);
			if (data.dpr !== undefined) applyDpr(data.dpr);
			if (data.paused !== undefined) {
				state.userPaused = !!data.paused;
				syncPaused();
			}
		} else if (data.type === 'wp:reset') {
			setSpeed(1);
			setFps(preview ? 30 : 60);
			applyDpr(preview ? 0.6 : 1);
			state.userPaused = false;
			state.hostPaused = false;
			syncPaused();
		} else if (data.type === 'wp:ping') {
			post({ type: 'wp:pong' });
		}
	});

	document.addEventListener('visibilitychange', syncPaused);

	window.__LW_RUNTIME__ = { state, setSpeed, setFps, setDpr: applyDpr, setPaused, setHostPaused, syncPaused };
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => post({ type: 'wp:ready' }));
	} else {
		post({ type: 'wp:ready' });
	}
})();
