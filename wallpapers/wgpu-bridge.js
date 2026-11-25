/*
 * WallpaperGPU API Bridge (wgpu-bridge.js)
 * Specification Version: 1.0
 * Target Host: kerneldroid/WallpaperGPU (Rust + Kotlin Android Live Wallpaper Engine)
 * License: Apache-2.0
 *
 * Responsibilities:
 *   1. Exposes `window.WallpaperGPU` API for WebGPU live wallpaper templates (.theme).
 *   2. Bridges Android WallpaperService touch events (`onTouchEvent`), launcher home-screen
 *      swipe offsets (`onOffsetsChanged`), gyroscope/accelerometer sensors, and battery state
 *      into both high-level `WallpaperGPU` hooks and standard DOM Pointer/Touch/Mouse/Orientation
 *      events on the WebGPU canvas.
 *   3. Implements Smart Static Conversion: when nobody is looking at the wallpaper (visibility lost,
 *      screen off, proximity covered, or idle freeze), captures the current WebGPU frame into a
 *      zero-cost static snapshot and halts the WebGPU render loop (0% GPU usage) until resumed.
 */
(() => {
	'use strict';
	if (window.WallpaperGPU && window.WallpaperGPU.__initialized) return;

	const SLUG = document.documentElement.dataset.lwSlug || document.documentElement.dataset.wgpuTheme || 'unknown';

	const listeners = {
		touch: new Set(),
		tap: new Set(),
		offset: new Set(),
		tilt: new Set(),
		battery: new Set(),
		visibility: new Set(),
		idle: new Set(),
		setting: new Set()
	};

	const state = {
		slug: SLUG,
		engineVersion: '1.0.0',
		visible: !document.hidden,
		idleFrozen: false,
		idleReason: null,
		offsetX: 0.5,
		offsetY: 0.5,
		offsetStepX: 0.25,
		offsetStepY: 0.0,
		pointer: {
			x: -1e5,
			y: -1e5,
			normX: 0.5,
			normY: 0.5,
			vx: 0,
			vy: 0,
			down: false,
			pressure: 0,
			pointerId: 1,
			lastTime: 0
		},
		tilt: {
			gamma: 0,
			beta: 60,
			alpha: 0,
			ax: 0,
			ay: 0,
			az: 9.81
		},
		battery: {
			level: 80,
			charging: false
		},
		settings: {}
	};

	function emit(bucket, payload) {
		const set = listeners[bucket];
		if (!set) return;
		for (const fn of set) {
			try {
				fn(payload, state);
			} catch (err) {
				console.error('[WallpaperGPU Bridge]', bucket, err);
			}
		}
		window.dispatchEvent(new CustomEvent(`wgpu:${bucket}`, { detail: payload }));
	}

	function getPrimaryCanvas() {
		return (
			document.querySelector('canvas#c') ||
			document.querySelector('canvas#gpuCanvas') ||
			document.querySelector('canvas#main-canvas') ||
			document.querySelector('canvas#glcanvas') ||
			document.querySelector('canvas')
		);
	}

	/* ------------------------------------------------ Smart Static Snapshot */

	let snapshotCanvas = null;

	function ensureSnapshotCanvas() {
		if (snapshotCanvas && snapshotCanvas.isConnected) return snapshotCanvas;
		snapshotCanvas = document.createElement('canvas');
		snapshotCanvas.id = 'wgpu-static-snapshot';
		snapshotCanvas.setAttribute('aria-hidden', 'true');
		Object.assign(snapshotCanvas.style, {
			position: 'fixed',
			inset: '0',
			width: '100%',
			height: '100%',
			pointerEvents: 'none',
			zIndex: '2147483640',
			opacity: '0',
			transition: 'opacity 140ms ease-out',
			display: 'none'
		});
		(document.body || document.documentElement).appendChild(snapshotCanvas);
		return snapshotCanvas;
	}

	function captureStaticFrame(reason = 'idle') {
		const src = getPrimaryCanvas();
		if (!src || src.width === 0 || src.height === 0) return false;
		try {
			const snap = ensureSnapshotCanvas();
			if (snap.width !== src.width || snap.height !== src.height) {
				snap.width = src.width;
				snap.height = src.height;
			}
			const ctx2d = snap.getContext('2d');
			if (ctx2d) {
				ctx2d.drawImage(src, 0, 0, snap.width, snap.height);
				snap.style.display = 'block';
				snap.style.opacity = '1';
			}
			if (window.WallpaperGPUHost && typeof window.WallpaperGPUHost.onStaticFrameState === 'function') {
				window.WallpaperGPUHost.onStaticFrameState(SLUG, true, String(reason));
			}
			return true;
		} catch {
			return false;
		}
	}

	function releaseStaticFrame() {
		if (snapshotCanvas) {
			snapshotCanvas.style.opacity = '0';
			setTimeout(() => {
				if (!state.idleFrozen && snapshotCanvas) {
					snapshotCanvas.style.display = 'none';
				}
			}, 150);
		}
		if (window.WallpaperGPUHost && typeof window.WallpaperGPUHost.onStaticFrameState === 'function') {
			window.WallpaperGPUHost.onStaticFrameState(SLUG, false, 'active');
		}
	}

	function setStaticFreeze(frozen, reason = 'smart-idle') {
		const next = !!frozen;
		if (state.idleFrozen === next) return;
		state.idleFrozen = next;
		state.idleReason = next ? String(reason) : null;
		if (next) {
			captureStaticFrame(reason);
			if (window.__LW_RUNTIME__ && typeof window.__LW_RUNTIME__.setHostPaused === 'function') {
				window.__LW_RUNTIME__.setHostPaused(true);
			}
		} else {
			if (window.__LW_RUNTIME__ && typeof window.__LW_RUNTIME__.setHostPaused === 'function') {
				window.__LW_RUNTIME__.setHostPaused(false);
			}
			releaseStaticFrame();
		}
		emit('idle', { frozen: next, reason: state.idleReason });
	}

	/* ------------------------------------------------ Touch & Pointer Synthesis */

	function dispatchSyntheticTouch(action, clientX, clientY, pointerId = 1, pressure = 0.8) {
		const target = getPrimaryCanvas() || document.body || window;
		const w = Math.max(1, window.innerWidth || 1);
		const h = Math.max(1, window.innerHeight || 1);
		const now = performance.now();

		const dt = Math.max(0.008, (now - (state.pointer.lastTime || now - 16)) / 1000);
		const vx = state.pointer.down ? (clientX - state.pointer.x) / dt : 0;
		const vy = state.pointer.down ? (clientY - state.pointer.y) / dt : 0;

		state.pointer.x = clientX;
		state.pointer.y = clientY;
		state.pointer.normX = Math.max(0, Math.min(1, clientX / w));
		state.pointer.normY = Math.max(0, Math.min(1, clientY / h));
		state.pointer.vx = vx;
		state.pointer.vy = vy;
		state.pointer.pointerId = pointerId;
		state.pointer.pressure = pressure;
		state.pointer.lastTime = now;

		if (state.idleFrozen) {
			setStaticFreeze(false, 'touch-wake');
		}

		let pointerTypeStr = 'pointermove';
		let mouseTypeStr = 'mousemove';
		let buttons = 1;

		if (action === 'down' || action === 0) {
			state.pointer.down = true;
			pointerTypeStr = 'pointerdown';
			mouseTypeStr = 'mousedown';
		} else if (action === 'up' || action === 1) {
			state.pointer.down = false;
			pointerTypeStr = 'pointerup';
			mouseTypeStr = 'mouseup';
			buttons = 0;
		} else if (action === 'cancel' || action === 3) {
			state.pointer.down = false;
			pointerTypeStr = 'pointercancel';
			mouseTypeStr = 'mouseup';
			buttons = 0;
		} else {
			buttons = state.pointer.down ? 1 : 0;
		}

		const eventInit = {
			bubbles: true,
			cancelable: true,
			view: window,
			clientX,
			clientY,
			screenX: clientX,
			screenY: clientY,
			pointerId,
			pointerType: 'touch',
			isPrimary: pointerId === 1 || pointerId === 0,
			button: 0,
			buttons,
			pressure: buttons ? pressure : 0
		};

		try {
			if (typeof PointerEvent === 'function') {
				target.dispatchEvent(new PointerEvent(pointerTypeStr, eventInit));
			}
			target.dispatchEvent(new MouseEvent(mouseTypeStr, eventInit));
			if (pointerTypeStr === 'pointerup') {
				target.dispatchEvent(new MouseEvent('click', eventInit));
				emit('tap', { x: clientX, y: clientY, normX: state.pointer.normX, normY: state.pointer.normY });
			}
		} catch {
			/* ignore synthetic event errors in restricted WebViews */
		}

		try {
			if (typeof Touch === 'function' && typeof TouchEvent === 'function') {
				const touchObj = new Touch({
					identifier: pointerId,
					target,
					clientX,
					clientY,
					screenX: clientX,
					screenY: clientY,
					pageX: clientX,
					pageY: clientY,
					radiusX: 12,
					radiusY: 12,
					force: buttons ? pressure : 0
				});
				const touchType =
					pointerTypeStr === 'pointerdown'
						? 'touchstart'
						: pointerTypeStr === 'pointermove'
							? 'touchmove'
							: pointerTypeStr === 'pointercancel'
								? 'touchcancel'
								: 'touchend';
				const activeTouches = buttons ? [touchObj] : [];
				target.dispatchEvent(
					new TouchEvent(touchType, {
						bubbles: true,
						cancelable: true,
						touches: activeTouches,
						targetTouches: activeTouches,
						changedTouches: [touchObj]
					})
				);
			}
		} catch {
			/* Touch constructor is optional in desktop browsers */
		}

		emit('touch', {
			action: pointerTypeStr,
			x: clientX,
			y: clientY,
			normX: state.pointer.normX,
			normY: state.pointer.normY,
			vx,
			vy,
			down: state.pointer.down,
			pointerId
		});
	}

	/* ------------------------------------------------ Launcher Offset & Tilt */

	function dispatchOffset(xOffset, yOffset = 0.5, xStep = 0.25, yStep = 0) {
		const prevX = state.offsetX;
		state.offsetX = Math.max(0, Math.min(1, Number(xOffset) || 0.5));
		state.offsetY = Math.max(0, Math.min(1, Number(yOffset) || 0.5));
		state.offsetStepX = Number(xStep) || 0.25;
		state.offsetStepY = Number(yStep) || 0;

		// Drive Enchanted Forest parallax slider if present
		const sliderOffset = document.querySelector('#slider-offset');
		if (sliderOffset) {
			sliderOffset.value = String(state.offsetX);
			sliderOffset.dispatchEvent(new Event('input', { bubbles: true }));
		}

		// For wallpapers that pan via wheel delta (cosmic-flow, windy-weather, xperia-x)
		const dx = (state.offsetX - prevX) * (window.innerWidth || 1080);
		if (Math.abs(dx) > 0.5) {
			const target = getPrimaryCanvas() || window;
			try {
				target.dispatchEvent(
					new WheelEvent('wheel', {
						bubbles: true,
						deltaX: dx,
						deltaY: dx * 0.5
					})
				);
			} catch {
				/* ignore */
			}
		}

		emit('offset', {
			xOffset: state.offsetX,
			yOffset: state.offsetY,
			xStep: state.offsetStepX,
			yStep: state.offsetStepY,
			deltaX: state.offsetX - prevX
		});
	}

	function dispatchTilt(gamma, beta, alpha = 0, ax = 0, ay = 0, az = 9.81) {
		state.tilt.gamma = Number(gamma) || 0;
		state.tilt.beta = Number(beta) || 0;
		state.tilt.alpha = Number(alpha) || 0;
		state.tilt.ax = Number(ax) || 0;
		state.tilt.ay = Number(ay) || 0;
		state.tilt.az = Number(az) || 9.81;

		try {
			if (typeof DeviceOrientationEvent === 'function') {
				window.dispatchEvent(
					new DeviceOrientationEvent('deviceorientation', {
						alpha: state.tilt.alpha,
						beta: state.tilt.beta,
						gamma: state.tilt.gamma
					})
				);
			}
		} catch {
			/* ignore */
		}

		// Update My Water tilt slider if present
		const tiltSlider = document.querySelector('#tilt');
		if (tiltSlider) {
			const deg = ((Math.round(state.tilt.gamma) % 360) + 360) % 360;
			tiltSlider.value = String(deg);
			tiltSlider.dispatchEvent(new Event('input', { bubbles: true }));
		}

		emit('tilt', { ...state.tilt });
	}

	function dispatchBattery(level, charging = false) {
		state.battery.level = Math.max(0, Math.min(100, Number(level) || 80));
		state.battery.charging = !!charging;

		const batInput = document.querySelector('#bat');
		if (batInput) {
			batInput.value = String(Math.round(state.battery.level));
			batInput.dispatchEvent(new Event('input', { bubbles: true }));
		}
		const chgInput = document.querySelector('#chg');
		if (chgInput && chgInput.checked !== state.battery.charging) {
			chgInput.checked = state.battery.charging;
			chgInput.dispatchEvent(new Event('change', { bubbles: true }));
		}

		emit('battery', { ...state.battery });
	}

	function dispatchVisibility(visible, reason = 'lifecycle') {
		state.visible = !!visible;
		emit('visibility', { visible: state.visible, reason });
		setStaticFreeze(!state.visible, state.visible ? 'visible' : reason);
	}

	function dispatchSetting(action, value) {
		state.settings[action] = value;
		window.postMessage({ type: 'wp:apply', action, value }, '*');
		emit('setting', { action, value });
	}

	function dispatchConfig(config) {
		if (!config || typeof config !== 'object') return;
		window.postMessage({ type: 'wp:config', ...config }, '*');
		if (config.paused !== undefined) {
			setStaticFreeze(!!config.paused, config.paused ? 'host-config-pause' : 'host-config-resume');
		}
	}

	// Listen for postMessage from either browser shell or Android WebView host.
	window.addEventListener('message', (event) => {
		// Same-origin host or self-posted control messages only.
		if (event.source !== window && event.source !== window.parent) return;
		const data = event.data;
		if (!data || typeof data !== 'object') return;
		switch (data.type) {
			case 'wgpu:touch':
				dispatchSyntheticTouch(data.action, data.x, data.y, data.pointerId ?? 1, data.pressure ?? 0.8);
				break;
			case 'wgpu:offset':
				dispatchOffset(data.xOffset, data.yOffset, data.xStep, data.yStep);
				break;
			case 'wgpu:tilt':
				dispatchTilt(data.gamma, data.beta, data.alpha, data.ax, data.ay, data.az);
				break;
			case 'wgpu:battery':
				dispatchBattery(data.level, data.charging);
				break;
			case 'wgpu:visibility':
				dispatchVisibility(data.visible, data.reason);
				break;
			case 'wgpu:idle':
				setStaticFreeze(data.frozen, data.reason || 'smart-idle');
				break;
			case 'wgpu:setting':
				dispatchSetting(data.action, data.value);
				break;
			case 'wgpu:config':
				dispatchConfig(data);
				break;
		}
	});

	document.addEventListener('visibilitychange', () => {
		dispatchVisibility(!document.hidden, document.hidden ? 'document-hidden' : 'document-visible');
	});

	window.WallpaperGPU = {
		__initialized: true,
		version: '1.0.0',
		slug: SLUG,
		state,
		onTouch: (fn) => (listeners.touch.add(fn), () => listeners.touch.delete(fn)),
		onTap: (fn) => (listeners.tap.add(fn), () => listeners.tap.delete(fn)),
		onParallaxOffset: (fn) => (listeners.offset.add(fn), () => listeners.offset.delete(fn)),
		onTilt: (fn) => (listeners.tilt.add(fn), () => listeners.tilt.delete(fn)),
		onBattery: (fn) => (listeners.battery.add(fn), () => listeners.battery.delete(fn)),
		onVisibilityChange: (fn) => (listeners.visibility.add(fn), () => listeners.visibility.delete(fn)),
		onIdleFreeze: (fn) => (listeners.idle.add(fn), () => listeners.idle.delete(fn)),
		onSettingChange: (fn) => (listeners.setting.add(fn), () => listeners.setting.delete(fn)),
		captureStaticFrame,
		releaseStaticFrame,
		setStaticFreeze,
		_dispatchTouch: dispatchSyntheticTouch,
		_dispatchOffset: dispatchOffset,
		_dispatchTilt: dispatchTilt,
		_dispatchBattery: dispatchBattery,
		_dispatchVisibility: dispatchVisibility,
		_dispatchIdle: setStaticFreeze,
		_dispatchSetting: dispatchSetting,
		_dispatchConfig: dispatchConfig
	};

	if (window.WallpaperGPUHost && typeof window.WallpaperGPUHost.onBridgeReady === 'function') {
		try {
			window.WallpaperGPUHost.onBridgeReady(SLUG, '1.0.0');
		} catch {
			/* ignore */
		}
	}
})();
