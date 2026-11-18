import { describe, it, expect } from 'vitest';
import Ogame from 'ogamejs';
import {
	classSpeedBonus,
	computeClock,
	computeFlight,
	formatDuration,
	formatInput,
	formatWhen,
	parseDrive,
	parseDuration,
	parseWhen,
	shipImage,
	speedSteps,
	universeFleetSpeed,
} from './formulas';

// A donut universe of 6 galaxies, fleet speed x3 at war (serverData as the
// Worker returns it: numbers come as they are in the XML).
const UNIVERSE = {
	number: 282,
	language: 'fr',
	galaxies: 6,
	systems: 499,
	donutGalaxy: 1,
	donutSystem: 1,
	speedFleetPeaceful: 2,
	speedFleetWar: 3,
	speedFleetHolding: 1,
};

const DRIVES = { combustion: '16', impulse: '13', hyperspace: '12' };
const form = (overrides = {}) => ({
	data: UNIVERSE,
	origin: '2:106:15',
	target: '2:110:16',
	shipId: 1, // Light Fighter
	classKey: 'explorer',
	drives: DRIVES,
	...overrides,
});

describe('times and durations', () => {
	it('reads times as the game writes them, or the French way', () => {
		const expected = new Date(2026, 10, 3, 21, 45, 12).getTime();
		const now = new Date(2026, 10, 3, 9, 0, 0);
		expect(parseWhen('03.11.2026 21:45:12')?.getTime()).toBe(expected);
		expect(parseWhen('03/11/2026 21:45:12')?.getTime()).toBe(expected);
		expect(parseWhen('2026-11-03T21:45:12')?.getTime()).toBe(expected);
		expect(parseWhen('3.11.26 21h45')?.getTime()).toBe(new Date(2026, 10, 3, 21, 45, 0).getTime());
		expect(parseWhen('21:45:12', now)?.getTime()).toBe(expected);
		expect(parseWhen('mar. 03.11.2026 21:45:12')?.getTime()).toBe(expected);
		expect(parseWhen('Tue 03.11.2026 21:45:12')?.getTime()).toBe(expected);
	});

	it('refuses a date that does not exist', () => {
		expect(parseWhen('31.02.2026 10:00:00')).toBeNull();
		expect(parseWhen('03.11.2026 25:00:00')).toBeNull();
		expect(parseWhen('tomorrow')).toBeNull();
	});

	it('reads durations in several shapes', () => {
		expect(parseDuration('1j 2h 3m 4s')).toBe(93784);
		expect(parseDuration('1d 2h 3m 4s')).toBe(93784);
		expect(parseDuration('1j2h')).toBe(93600);
		expect(parseDuration('45min')).toBe(2700);
		expect(parseDuration('2:03:04')).toBe(7384);
		expect(parseDuration('1:02:03:04')).toBe(93784);
		expect(parseDuration('2j 03:04:05')).toBe(2 * 86400 + 11045);
		expect(parseDuration('1:30')).toBe(5400);
		expect(parseDuration('soon')).toBeNull();
		expect(parseDuration('2:75:00')).toBeNull();
	});

	it('writes a duration it can read back, in both languages', () => {
		expect(formatDuration(7384)).toBe('02:03:04');
		expect(formatDuration(2 * 86400 + 11045, 'fr')).toBe('2j 03:04:05');
		expect(formatDuration(2 * 86400 + 11045, 'en')).toBe('2d 03:04:05');
		expect(parseDuration(formatDuration(200000, 'fr'))).toBe(200000);
		expect(parseDuration(formatDuration(200000, 'en'))).toBe(200000);
	});

	it('adds a duration to a time, or takes it away', () => {
		const add = computeClock({ base: '03.11.2026 21:00:00', sign: '+', duration: '3h 30m' });
		expect(formatInput(add.date)).toBe('04.11.2026 00:30:00');
		const back = computeClock({ base: '03.11.2026 21:00:00', sign: '-', duration: '1j' });
		expect(formatWhen(back.date, 'fr')).toBe('lun. 02.11.2026 21:00:00');
		expect(computeClock({ base: '03.11.2026 21:00:00', sign: '+', duration: 'soon' })).toEqual({
			ok: false,
			error: 'duration',
		});
		expect(computeClock({ base: 'yesterday', sign: '+', duration: '1h' }).error).toBe('time');
		expect(computeClock({ base: '', sign: '+', duration: '1h' })).toEqual({ ok: false, error: null });
	});
});

describe('universe and class', () => {
	it('offers the speed steps of the class', () => {
		expect(speedSteps('explorer', UNIVERSE)).toHaveLength(10);
		expect(speedSteps('general', UNIVERSE)).toHaveLength(20);
		expect(speedSteps('general', UNIVERSE).at(-1)).toBe(5);
		expect(speedSteps('general', { warriorBonusFleetHalfSpeed: 0 })).toHaveLength(10);
	});

	it('times with the war fleet speed of the universe', () => {
		expect(universeFleetSpeed(UNIVERSE)).toBe(3);
		expect(universeFleetSpeed({})).toBe(1);
	});

	it('shows a ship by its game id', () => {
		expect(shipImage(8)).toBe('/ogame/ships/214.webp');
		expect(shipImage(99)).toBeNull();
	});

	it('the Collector only speeds up the cargo ships', () => {
		expect(classSpeedBonus('collector', {}, 12)).toBe(1);
		expect(classSpeedBonus('collector', {}, 1)).toBe(0);
	});

	it('the General speeds up combat ships and the Recycler, as the universe says', () => {
		expect(classSpeedBonus('general', { warriorBonusFasterCombatShips: '0.5' }, 1)).toBe(0.5);
		expect(classSpeedBonus('general', {}, 14)).toBe(1);
		expect(classSpeedBonus('general', {}, 12)).toBe(0);
		expect(classSpeedBonus('explorer', {}, 1)).toBe(0);
	});

	it('reads a drive level, empty counting as 0', () => {
		expect(parseDrive('')).toBe(0);
		expect(parseDrive('12')).toBe(12);
		expect(parseDrive('41')).toBeNull();
	});
});

describe('computeFlight', () => {
	const drives = { combustion: 16, impulse: 13, hyperspace: 12 };

	it('gives the duration at every speed, with the universe speed', () => {
		const result = computeFlight(form());
		const distance = 2700 + 95 * 4;
		const speed = Ogame.Fleets.getFleetSpeed([{ ship: Ogame.models.Destroyable[1], count: 1 }], drives);
		expect(result.ok).toBe(true);
		expect(result.distance).toBe(distance);
		expect(result.universeSpeed).toBe(3);
		expect(result.rows).toHaveLength(10);
		const d50 = Ogame.Fleets.getFlightTime(distance, speed, 50, 3);
		expect(result.rows[5]).toEqual({ percent: 50, duration: d50, roundTrip: 2 * d50 });
	});

	it('goes round the edge of a donut universe', () => {
		expect(computeFlight(form({ target: '2:490:8' })).distance).toBe(2700 + 95 * 115);
		expect(computeFlight(form({ target: '6:1:1' })).distance).toBe(20000 * 2);
	});

	it('takes the class: speed and 5 % steps of the General', () => {
		const plain = computeFlight(form());
		const general = computeFlight(form({ classKey: 'general' }));
		expect(general.rows).toHaveLength(20);
		expect(plain.fleetSpeed).toBe(32500);
		expect(general.fleetSpeed).toBe(45000);
	});

	it('says what is missing', () => {
		expect(computeFlight(form({ data: null })).error).toBe('universe');
		expect(computeFlight(form({ target: '' })).error).toBe('empty');
		expect(computeFlight(form({ origin: '7:1:1' })).error).toBe('origin');
		expect(computeFlight(form({ target: '2:106' })).error).toBe('target');
		expect(computeFlight(form({ shipId: 16 })).error).toBe('ship');
		expect(computeFlight(form({ drives: { ...DRIVES, impulse: '99' } }))).toEqual({
			ok: false,
			error: 'drive',
			drive: 'impulse',
		});
	});

	it('reaches the expedition slot', () => {
		expect(computeFlight(form({ target: '2:106:16' })).distance).toBe(1000 + 5);
		expect(computeFlight(form({ target: '2:106:17' })).error).toBe('target');
	});
});
