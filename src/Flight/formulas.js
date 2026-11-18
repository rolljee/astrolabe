// Flight times, ported from the "Vol" page of Elmiral (src/js/flight.js).
//
// How long a fleet — usually the one coming at you — takes to cross a distance
// at every speed step, and a clock calculator to time a return to the second.
// Distance, ship speed and flight time all come from ogamejs; this file reads
// the universe settings, interprets what the player types and formats.

import Ogame from 'ogamejs';

import { parseCoordinates } from '../components/galaxy';

const { Fleets } = Ogame;
const { Destroyable } = Ogame.models;

// Library ids, in the order of the in-game fleet page: combat ships, then
// civil ones. 8 is the Deathstar, 11 the Small Cargo, 15 the Espionage Probe.
export const FLEET_SHIPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
export const DEFAULT_SHIP = 8;

// The expedition slot is reachable by a fleet, unlike for the other tools.
export const MAX_FLIGHT_POSITION = 16;
export const MAX_DRIVE_LEVEL = 40;

export const CLASSES = ['collector', 'general', 'explorer'];
// The Discoverer has no flight speed bonus: the neutral choice.
export const DEFAULT_CLASS = 'explorer';
export const DRIVES = ['combustion', 'impulse', 'hyperspace'];

// The Collector speeds up the cargo ships; the General the combat ships, the
// Pathfinder and the Recycler (proxyforgame's list, as in Elmiral).
const COLLECTOR_FAST = new Set([11, 12]);
const GENERAL_COMBAT = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const RECYCLER = 14;

// Settings the public API usually gives; the common values otherwise.
const DEFAULTS = {
	minerBonusFasterTradingShips: 1,
	warriorBonusFasterCombatShips: 1,
	warriorBonusFasterRecyclers: 1,
	warriorBonusFleetHalfSpeed: 1,
};

function positive(value, fallback) {
	const n = Number(value);
	return value != null && value !== '' && Number.isFinite(n) && n >= 0 ? n : fallback;
}

const setting = (data, key) => positive(data?.[key], DEFAULTS[key]);

export function shipModel(id) {
	return Destroyable[id];
}

// The in-game picture, by the game id of the ship (public/ogame/ships).
export function shipImage(id) {
	const ogameId = shipModel(id)?.ogameId;
	return ogameId ? `${import.meta.env.BASE_URL}ogame/ships/${ogameId}.webp` : null;
}

// Class speed bonus of a ship, as a share of its base speed. The life form
// class upgrade is left out: it cannot be seen on another player.
export function classSpeedBonus(classKey, data, id) {
	if (classKey === 'collector' && COLLECTOR_FAST.has(id)) {
		return setting(data, 'minerBonusFasterTradingShips');
	}
	if (classKey === 'general' && GENERAL_COMBAT.has(id)) {
		return setting(data, 'warriorBonusFasterCombatShips');
	}
	if (classKey === 'general' && id === RECYCLER) {
		return setting(data, 'warriorBonusFasterRecyclers');
	}
	return 0;
}

// The speed steps of the fleet page: by 10 %, by 5 % for a General when the
// universe grants it.
export function speedSteps(classKey, data) {
	const step = classKey === 'general' && setting(data, 'warriorBonusFleetHalfSpeed') > 0 ? 5 : 10;
	return Array.from({ length: 100 / step }, (_, i) => 100 - i * step);
}

// Universe fleet speed per kind of mission. Most universes use one speed for
// all three; some fly faster at war, or slower when holding.
export const MISSIONS = [
	{ key: 'peaceful', setting: 'speedFleetPeaceful' },
	{ key: 'war', setting: 'speedFleetWar' },
	{ key: 'holding', setting: 'speedFleetHolding' },
];
// One mostly times an incoming attack.
export const DEFAULT_MISSION = 'war';

export function missionSpeed(data, missionKey) {
	const mission = MISSIONS.find(({ key }) => key === missionKey) ?? MISSIONS[1];
	return positive(data?.[mission.setting], 1) || 1;
}

// The missions with their speed, only when the universe tells them apart:
// with one speed for all, the choice changes nothing and is not shown.
export function missionChoices(data) {
	const missions = MISSIONS.map(({ key }) => ({ key, speed: missionSpeed(data, key) }));
	return new Set(missions.map(({ speed }) => speed)).size > 1 ? missions : [];
}

function isFlag(value) {
	return value === true || value === 1 || value === '1';
}

export function universeShape(data) {
	return {
		galaxies: Number(data?.galaxies) || undefined,
		systems: Number(data?.systems) || undefined,
		donutGalaxy: isFlag(data?.donutGalaxy),
		donutSystem: isFlag(data?.donutSystem),
	};
}

// A drive level as typed: empty is 0, anything else must be a whole level.
export function parseDrive(raw) {
	const text = String(raw ?? '').trim();
	if (text === '') return 0;
	const n = Number(text);
	return Number.isInteger(n) && n >= 0 && n <= MAX_DRIVE_LEVEL ? n : null;
}

// `data` is a serverData payload; the rest is the form as typed. Returns
// `{ ok: false, error }` so the view can explain what is missing.
export function computeFlight({ data, origin, target, shipId, classKey, mission, drives = {} }) {
	if (!data) return { ok: false, error: 'universe' };

	const universe = universeShape(data);
	if (!String(origin ?? '').trim() || !String(target ?? '').trim()) {
		return { ok: false, error: 'empty' };
	}
	const bounds = { ...universe, maxPosition: MAX_FLIGHT_POSITION };
	const from = parseCoordinates(origin, bounds);
	if (!from) return { ok: false, error: 'origin' };
	const to = parseCoordinates(target, bounds);
	if (!to) return { ok: false, error: 'target' };

	const ship = shipModel(shipId);
	if (!FLEET_SHIPS.includes(shipId) || !ship) return { ok: false, error: 'ship' };

	const levels = {};
	for (const drive of DRIVES) {
		const level = parseDrive(drives[drive]);
		if (level === null) return { ok: false, error: 'drive', drive };
		levels[drive] = level;
	}

	const fleet = [{ ship, count: 1, speedBonus: classSpeedBonus(classKey, data, shipId) }];
	const distance = Fleets.getDistance(from, to, universe);
	const fleetSpeed = Fleets.getFleetSpeed(fleet, levels);
	const speed = missionSpeed(data, mission);

	return {
		ok: true,
		distance,
		fleetSpeed,
		universeSpeed: speed,
		rows: speedSteps(classKey, data).map((percent) => {
			const duration = Fleets.getFlightTime(distance, fleetSpeed, percent, speed);
			return { percent, duration, roundTrip: 2 * duration };
		}),
	};
}

// --- Clock and durations ----------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');

// As the game writes it: 03.11.2026 21:45:12
export function formatInput(date) {
	return (
		`${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ` +
		`${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
	);
}

// The same, after the short day name: « mar. 03.11.2026 21:45:12 ».
export function formatWhen(date, lang = 'fr') {
	const day = date.toLocaleDateString(lang, { weekday: 'short' });
	return `${day} ${formatInput(date)}`;
}

// 2j 03:04:05 (2d in English), or 03:04:05 under a day.
export function formatDuration(seconds, lang = 'fr') {
	const s = Math.max(0, Math.round(seconds));
	const days = Math.floor(s / 86400);
	const clock = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
	return days > 0 ? `${days}${lang === 'fr' ? 'j' : 'd'} ${clock}` : clock;
}

function build(year, month, day, h = 0, m = 0, s = 0) {
	const date = new Date(year, month - 1, day, h, m, s);
	const ok =
		date.getFullYear() === year &&
		date.getMonth() === month - 1 &&
		date.getDate() === day &&
		h < 24 &&
		m < 60 &&
		s < 60;
	return ok ? date : null;
}

// A time typed or pasted from the game: « 03.11.2026 21:45:12 »,
// « mar. 03.11.2026 21:45:12 », « 03/11/2026 21:45 », « 2026-11-03 21:45:12 »,
// or « 21:45:12 » for today.
export function parseWhen(text, now = new Date()) {
	// The day name the game writes in front (« mar. », « Tue ») is ignored.
	const t = String(text ?? '')
		.trim()
		.replace(/\s+/g, ' ')
		.replace(/^[a-zéû]+\.? /i, '');
	if (!t) return null;
	const time = '(?:[ T,à]+(\\d{1,2})[:h](\\d{2})(?::(\\d{2}))?)?';
	let m = t.match(new RegExp(`^(\\d{1,2})[./-](\\d{1,2})[./-](\\d{2,4})${time}$`));
	if (m) {
		const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
		return build(year, Number(m[2]), Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0));
	}
	m = t.match(new RegExp(`^(\\d{4})-(\\d{1,2})-(\\d{1,2})${time}$`));
	if (m) {
		return build(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0));
	}
	m = t.match(/^(\d{1,2})[:h](\d{2})(?::(\d{2}))?$/);
	if (m) {
		return build(now.getFullYear(), now.getMonth() + 1, now.getDate(), Number(m[1]), Number(m[2]), Number(m[3] ?? 0));
	}
	return null;
}

const UNITS = { j: 86400, d: 86400, h: 3600, m: 60, min: 60, s: 1, sec: 1 };

// A duration: « 1j 2h 3m 4s », « 2:03:04 », « 1:02:03:04 » or « 2j 03:04:05 »
// (as formatDuration writes it). Nothing readable: null.
export function parseDuration(text) {
	let t = String(text ?? '')
		.trim()
		.toLowerCase();
	if (!t) return null;
	let total = 0;
	// A clock at the end, with or without days in front.
	const clock = t.match(/(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
	if (clock) {
		const parts = clock[0].split(':').map(Number);
		if (parts.slice(1).some((n) => n >= 60)) return null;
		const [h, mi, s = 0] = parts;
		total += h * 3600 + mi * 60 + s;
		t = t.slice(0, clock.index).trim();
		// 1:02:03:04: the first number counts days.
		const days = t.match(/^(\d+):$/);
		if (days) {
			total += Number(days[1]) * 86400;
			t = '';
		}
	}
	const units = /(\d+)\s*(min|sec|[jdhms])(?![a-z])/g;
	const rest = t.replace(units, (_, n, unit) => {
		total += Number(n) * UNITS[unit];
		return '';
	});
	if (rest.trim() || (!clock && !/\d/.test(t))) return null;
	return total;
}

// Add a duration to a time, or take it away. Returns the date, or an error
// key; nothing typed yet is neither.
export function computeClock({ base, sign, duration, now = new Date() }) {
	if (!String(base ?? '').trim() || !String(duration ?? '').trim()) return { ok: false, error: null };
	const start = parseWhen(base, now);
	if (!start) return { ok: false, error: 'time' };
	const seconds = parseDuration(duration);
	if (seconds == null) return { ok: false, error: 'duration' };
	return { ok: true, date: new Date(start.getTime() + (sign === '-' ? -1 : 1) * seconds * 1000) };
}
