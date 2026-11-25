/*
 * Wallpaper control bridge.
 *
 * The wallpaper documents ship without their own chrome: their control panels are hidden by
 * `#lw-hide-ui`, but the elements (and their listeners) stay in the DOM so this bridge can drive
 * them. The Svelte shell owns the presentation (labels, values, English copy) and sends
 * `{ type: 'wp:apply', action, value }`; the bridge clicks/sets the original controls here.
 *
 * Every action is written against the wallpaper's own handlers, so no wallpaper internals have to
 * be re-implemented in the shell. Repeating the same value is a no-op, because the shell may push
 * the saved settings more than once (iframe load + runtime ready).
 */
(() => {
	'use strict';
	const $ = (sel) => document.querySelector(sel);
	const $$ = (sel) => [...document.querySelectorAll(sel)];

	const asBool = (value) => value === true || value === 'true' || value === 1 || value === '1' || value === 'on';

	const clickIndex = (sel, index) => {
		const el = $$(sel)[index];
		if (el) el.click();
		return !!el;
	};

	const setInput = (sel, value) => {
		const el = $(sel);
		if (!el) return false;
		const next = String(value);
		if (String(el.value) === next) return true;
		el.value = next;
		el.dispatchEvent(new Event('input', { bubbles: true }));
		return true;
	};

	const setCheckbox = (sel, value) => {
		const el = $(sel);
		if (!el) return false;
		const next = asBool(value);
		if (el.checked === next) return true;
		el.checked = next;
		el.dispatchEvent(new Event('change', { bubbles: true }));
		return true;
	};

	const setSelect = (sel, value) => {
		const el = $(sel);
		if (!el) return false;
		const next = String(value);
		if (el.value === next) return true;
		el.value = next;
		el.dispatchEvent(new Event('change', { bubbles: true }));
		return true;
	};

	/** Toggle a button that keeps its state in a class, only clicking when the state must change. */
	const setToggle = (sel, value) => {
		const el = $(sel);
		if (!el) return false;
		const next = asBool(value);
		const isOn = el.classList.contains('on') || el.classList.contains('active');
		if (isOn === next) return true;
		el.click();
		return true;
	};

	const clickAttr = (attr, value) => {
		const el = $(`[${attr}="${value}"]`);
		if (el) el.click();
		return !!el;
	};

	const ACTIONS = {
		bubbles: {
			theme: (v) => clickIndex('#ui button', Number(v))
		},
		'cosmic-flow': {
			palette: (v) => clickIndex('#ui i', Number(v))
		},
		'htc-bokeh': {
			speed: (v) => {
				const index = { '0.5': 0, '1': 1, '2': 2 }[String(v)];
				return clickIndex('#ui button', index ?? 1);
			}
		},
		'windy-weather': {
			weather: (v) => clickIndex('#w button', Number(v)),
			time: (v) => clickIndex('#t button', { auto: 0, day: 1, night: 2 }[v] ?? 0)
		},
		'secret-sea': {
			scene: (v) => clickAttr('data-k', 'w' + Number(v)),
			night: (v) => setToggle('[data-k="n"]', v),
			autoTime: (v) => setToggle('[data-k="a"]', v),
			cycle: (v) => setToggle('[data-k="c"]', v)
		},
		'xperia-x': {
			palette: (v) => setSelect('#pal', String(v))
		},
		'breakout-weather': {
			weather: (v) => setSelect('#w', String(v))
		},
		'my-water': {
			battery: (v) => setInput('#bat', String(v)),
			charging: (v) => setCheckbox('#chg', v),
			tilt: (v) => setInput('#tilt', String(v))
		},
		'enchanted-forest': {
			time: (v) => clickAttr('data-time', v),
			realtime: (v) => setToggle('#btn-realtime-clock', v),
			weather: (v) => clickAttr('data-weather', v),
			weatherRandom: () => $('#btn-random-weather')?.click(),
			spawn: (v) => {
				const select = $('#animal-select');
				if (!select) return false;
				select.value = v;
				$('#btn-spawn-selected')?.click();
				return true;
			},
			spawnRandom: () => $('#btn-spawn-random')?.click(),
			clearCreatures: () => $('#btn-clear-spawns')?.click(),
			parallax: (v) => setInput('#slider-offset', String(v)),
			autoPan: (v) => setToggle('#btn-autopan', v)
		},
		'experience-flow': {
			theme: (v) => clickIndex('.theme-card', Number(v)),
			mode: (v) => clickAttr('data-mode', v)
		},
		'puddle-drops': {
			rain: (v) => setToggle('#bDrops', v),
			scroll: (v) => setToggle('#bScroll', v)
		}
	};

	/** Read the live control state back from the original DOM, so the shell opens in sync. */
	const STATE = {
		bubbles: () => {
			const stored = Number(localStorage.getItem('bubbles-bg'));
			return { theme: Number.isFinite(stored) ? stored : 0 };
		},
		'cosmic-flow': () => ({ palette: $$('#ui i').findIndex((el) => el.classList.contains('on')) }),
		'htc-bokeh': () => {
			const label = $('#ui button.on')?.textContent?.trim();
			const speed = label === '½×' ? 0.5 : label === '2×' ? 2 : 1;
			return { speed };
		},
		'windy-weather': () => ({
			weather: $$('#w button').findIndex((el) => el.classList.contains('on')),
			time: ['auto', 'day', 'night'][$$('#t button').findIndex((el) => el.classList.contains('on'))] ?? 'auto'
		}),
		'secret-sea': () => {
			const weatherButtons = $$('#ui button').filter((el) => /^w\d+$/.test(el.dataset.k ?? ''));
			return {
				scene: weatherButtons.findIndex((el) => el.classList.contains('on')),
				night: !!$('[data-k="n"].on'),
				autoTime: !!$('[data-k="a"].on'),
				cycle: !!$('[data-k="c"].on')
			};
		},
		'xperia-x': () => ({ palette: Number($('#pal')?.value ?? 0) }),
		'breakout-weather': () => ({ weather: $('#w')?.value }),
		'my-water': () => ({
			battery: Number($('#bat')?.value ?? 70),
			charging: !!$('#chg')?.checked,
			tilt: Number($('#tilt')?.value ?? 0)
		}),
		'enchanted-forest': () => ({
			time: $('[data-time].active')?.dataset.time,
			realtime: !!$('#btn-realtime-clock.active'),
			weather: $('[data-weather].active')?.dataset.weather,
			parallax: Number($('#slider-offset')?.value ?? 0.5),
			autoPan: !!$('#btn-autopan.active')
		}),
		'experience-flow': () => ({
			theme: $$('.theme-card').findIndex((el) => el.classList.contains('active')),
			mode: $('[data-mode].active')?.dataset.mode ?? 'dynamic'
		}),
		'puddle-drops': () => ({ rain: !!$('#bDrops.on'), scroll: !!$('#bScroll.on') })
	};

	const slug = document.documentElement.dataset.lwSlug || '';
	const handlers = ACTIONS[slug] || {};
	const readState = STATE[slug];
	const applied = new Map();

	window.addEventListener('message', (event) => {
		if (event.source !== window.parent) return;
		const data = event.data;
		if (!data || data.type !== 'wp:apply') return;
		const handler = handlers[data.action];
		const key = String(data.action);
		const fingerprint = JSON.stringify(data.value ?? null);
		let ok = false;
		try {
			// Non-action settings are re-sent after reload; apply them once per value.
			if (!data.transient && applied.get(key) === fingerprint) {
				ok = true;
			} else {
				ok = handler ? handler(data.value) !== false : false;
				if (ok && !data.transient) applied.set(key, fingerprint);
			}
		} catch (err) {
			console.error('[LW bridge]', data.action, err);
		}
		if (window.parent !== window) {
			window.parent.postMessage({ type: 'wp:applied', action: data.action, ok, slug }, location.origin === 'null' ? '*' : location.origin);
		}
	});

	window.addEventListener('message', (event) => {
		if (event.source !== window.parent) return;
		const data = event.data;
		if (!data || data.type !== 'wp:stateQuery') return;
		let state = {};
		try {
			state = readState ? readState() : {};
		} catch (err) {
			console.error('[LW bridge] state', err);
		}
		if (window.parent !== window) {
			window.parent.postMessage({ type: 'wp:state', slug, state }, location.origin === 'null' ? '*' : location.origin);
		}
	});

	// The original panels are hidden by CSS (`#lw-hide-ui`); make sure they cannot steal focus.
	for (const el of $$('#ui,#hud,#hud-panel,#hud-toggle,#hint,#hint-banner,#diag-banner')) {
		el.setAttribute('aria-hidden', 'true');
		el.setAttribute('inert', '');
	}
})();
