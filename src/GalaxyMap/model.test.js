import { describe, it, expect } from 'vitest';

import {
	axisTicks,
	buildHeatmap,
	describeSystem,
	addCompared,
	comparePlayers,
	findAlliance,
	findPlayer,
	listAlliances,
	playerSlots,
	suggestAlliances,
	MAX_COMPARED,
	removeCompared,
	heatLevel,
	HEAT_LEVELS,
	playerSystems,
	suggestPlayers,
} from './model';

const status = (over = {}) => ({
	raw: '',
	active: false,
	vacation: false,
	inactive: false,
	longInactive: false,
	banned: false,
	admin: false,
	outlaw: false,
	...over,
});

const player = (name, planets, over = {}) => ({
	id: name,
	name,
	alliance: null,
	status: status({ active: true }),
	planets: planets.map((coords) =>
		typeof coords === 'string' ? { coords, moon: false } : coords,
	),
	...over,
});

// Ada crowds 1:1 with two planets, Bo shares it, Cy is inactive elsewhere in
// galaxy 1, and Dee has no coordinates at all — universe.xml lags, so a recent
// player has none.
const ROSTER = [
	player('Ada', ['1:1:4', { coords: '1:1:8', moon: true }]),
	player('Bo', ['1:1:12']),
	player('Cy', ['1:9:3'], { status: status({ inactive: true }) }),
	player('Dee', []),
];

describe('buildHeatmap', () => {
	const cellAt = (map, galaxy, system) =>
		map.rows.find((row) => row.galaxy === galaxy).cells[system - 1];

	it('counts planets, moons and players per system', () => {
		const map = buildHeatmap(ROSTER, { galaxies: 2, systems: 10 });
		expect(cellAt(map, 1, 1)).toMatchObject({
			planets: 3,
			moons: 1,
			players: 2,
			inactive: 0,
			value: 3,
		});
	});

	it('draws the whole universe, empty systems included', () => {
		const map = buildHeatmap(ROSTER, { galaxies: 4, systems: 12 });
		expect(map.rows).toHaveLength(4);
		expect(map.rows[0].cells).toHaveLength(12);
		expect(cellAt(map, 3, 5)).toMatchObject({ planets: 0, value: 0, level: 0 });
	});

	it('grows past the announced size rather than dropping a planet', () => {
		const map = buildHeatmap([player('Far', ['9:600:1'])], { galaxies: 7, systems: 499 });
		expect(map.galaxies).toBe(9);
		expect(map.systems).toBe(600);
		expect(cellAt(map, 9, 600).planets).toBe(1);
	});

	it('shades a system by fixed ranges of its planets', () => {
		const map = buildHeatmap(ROSTER, { galaxies: 1, systems: 10 });
		expect(cellAt(map, 1, 1).level).toBe(3);
		expect(cellAt(map, 1, 9).level).toBe(1);
		// Systems per shade, empty first: 8 empty, one with 1 planet, one with 3.
		expect(map.levels).toEqual([8, 1, 0, 1, 0, 0, 0, 0]);
	});

	it('counts inactive planets when asked to', () => {
		const map = buildHeatmap(ROSTER, { galaxies: 1, systems: 10, metric: 'inactive' });
		expect(cellAt(map, 1, 1)).toMatchObject({ value: 0, level: 0 });
		expect(cellAt(map, 1, 9)).toMatchObject({ value: 1, level: 1 });
	});

	it('only counts the selected statuses', () => {
		const map = buildHeatmap(ROSTER, { galaxies: 1, systems: 10, statuses: ['inactive'] });
		expect(cellAt(map, 1, 1).planets).toBe(0);
		expect(cellAt(map, 1, 9).planets).toBe(1);
		expect(map.positioned).toBe(1);
	});

	it('ignores players the coordinates document does not know yet', () => {
		const map = buildHeatmap(ROSTER, { galaxies: 1, systems: 10 });
		expect(map.positioned).toBe(4);
	});

	it('survives an empty roster', () => {
		const map = buildHeatmap([], { galaxies: 2, systems: 3 });
		expect(map.max).toBe(0);
		expect(map.rows.flatMap((row) => row.cells).every((cell) => cell.level === 0)).toBe(true);
	});
});

describe('heatLevel', () => {
	it('paints nothing as empty and anything as at least the first shade', () => {
		expect(heatLevel(0)).toBe(0);
		expect(heatLevel(1)).toBe(1);
	});

	it('groups the counts into the legend ranges', () => {
		expect([2, 3, 4, 5, 6, 10, 11, 14].map(heatLevel)).toEqual([2, 3, 4, 4, 5, 5, 6, 6]);
	});

	it('keeps the top shade for a full system, and past it', () => {
		expect(heatLevel(15)).toBe(HEAT_LEVELS);
		expect(heatLevel(17)).toBe(HEAT_LEVELS);
	});
});

describe('findPlayer', () => {
	const players = [
		{ id: '1', name: 'Élysée', planets: [] },
		{ id: '2', name: 'Elysium', planets: [] },
	];

	it('matches the whole name, ignoring case and accents', () => {
		expect(findPlayer(players, ' ELYSEE ')?.id).toBe('1');
		expect(findPlayer(players, 'ely')).toBeNull();
		expect(findPlayer(players, '')).toBeNull();
	});
});

describe('suggestPlayers', () => {
	const players = [
		{ id: '1', name: 'Élysée' },
		{ id: '2', name: 'Elysium' },
		{ id: '3', name: 'Bely' },
		{ id: '4', name: 'Admiral Ara' },
	];

	it('puts the names starting with the query first, then those containing it', () => {
		const names = suggestPlayers(players, 'ely').map(({ player }) => player.name);
		expect(names).toEqual(['Élysée', 'Elysium', 'Bely']);
	});

	it('locates the match in the name, accents included', () => {
		const [first] = suggestPlayers(players, 'LYS');
		expect(first.player.name).toBe('Élysée');
		expect('Élysée'.slice(first.match.start, first.match.end)).toBe('lys');
		const [ara] = suggestPlayers(players, 'ara');
		expect('Admiral Ara'.slice(ara.match.start, ara.match.end)).toBe('Ara');
	});

	it('suggests nothing for an empty query and caps the list', () => {
		expect(suggestPlayers(players, '  ')).toEqual([]);
		expect(suggestPlayers(players, 'e', 2)).toHaveLength(2);
	});
});

describe('playerSystems', () => {
	it('groups the planets by system, in map order', () => {
		const systems = playerSystems({
			planets: [
				{ coords: '2:10:8', moon: false },
				{ coords: '1:5:9', moon: true },
				{ coords: '2:10:3', moon: false },
				{ coords: 'nope', moon: false },
			],
		});
		expect(systems.map(({ key }) => key)).toEqual(['1:5', '2:10']);
		expect(systems[1].planets.map(({ position }) => position)).toEqual([3, 8]);
		expect(systems[0].planets[0]).toMatchObject({ coords: '1:5:9', moon: true });
	});

	it('is empty without a player', () => {
		expect(playerSystems(null)).toEqual([]);
	});
});

describe('addCompared / removeCompared', () => {
	it('gives each entry the first free colour and keeps the others', () => {
		let list = addCompared([], 'player', 'a');
		list = addCompared(list, 'alliance', 'a');
		list = addCompared(list, 'alliance', 'a');
		expect(list).toEqual([
			{ kind: 'player', id: 'a', slot: 0 },
			{ kind: 'alliance', id: 'a', slot: 1 },
		]);
		list = addCompared(removeCompared(list, 'player', 'a'), 'player', 'c');
		expect(list).toEqual([
			{ kind: 'alliance', id: 'a', slot: 1 },
			{ kind: 'player', id: 'c', slot: 0 },
		]);
	});

	it('stops at MAX_COMPARED', () => {
		let list = [];
		for (let i = 0; i < MAX_COMPARED + 2; i += 1) list = addCompared(list, 'player', String(i));
		expect(list).toHaveLength(MAX_COMPARED);
	});
});

describe('comparePlayers', () => {
	const red = { id: '7', tag: 'RED', name: 'Red Fleet' };
	const players = [
		{ id: '1', name: 'Ann', alliance: red, planets: [{ coords: '1:5:4', moon: false }, { coords: '2:9:1', moon: true }] },
		{ id: '2', name: 'Bob', alliance: null, planets: [{ coords: '1:5:10', moon: false }] },
		{ id: '3', name: 'Cid', alliance: red, planets: [{ coords: '3:1:1', moon: false }, { coords: '1:5:6', moon: false }] },
	];

	it('marks every system and lists the shared ones with who holds what', () => {
		const { tracks, marks, shared } = comparePlayers(players, [
			{ kind: 'player', id: '2', slot: 1 },
			{ kind: 'player', id: '1', slot: 0 },
			{ kind: 'player', id: 'gone', slot: 2 },
		]);
		expect(tracks.map(({ label }) => label)).toEqual(['Bob', 'Ann']);
		expect(marks.get('1:5')).toEqual([
			{ slot: 0, name: 'Ann' },
			{ slot: 1, name: 'Bob' },
		]);
		expect(marks.get('2:9')).toEqual([{ slot: 0, name: 'Ann' }]);
		expect(marks.has('3:1')).toBe(false);
		expect(shared.map(({ key }) => key)).toEqual(['1:5']);
		expect(shared[0].members.map(({ planets }) => planets[0].position)).toEqual([4, 10]);
	});

	it('merges an alliance into one track, minus the members on the map on their own', () => {
		const { tracks, marks, shared } = comparePlayers(players, [
			{ kind: 'alliance', id: '7', slot: 0 },
			{ kind: 'player', id: '2', slot: 1 },
		]);
		const [alliance] = tracks;
		expect(alliance).toMatchObject({ label: '[RED]', alliance: { tag: 'RED', name: 'Red Fleet' } });
		expect(alliance.members.map(({ name }) => name)).toEqual(['Ann', 'Cid']);
		expect(alliance.systems.find(({ key }) => key === '1:5').planets).toEqual([
			{ position: 4, coords: '1:5:4', moon: false, owner: 'Ann' },
			{ position: 6, coords: '1:5:6', moon: false, owner: 'Cid' },
		]);
		expect(alliance.spread).toEqual([
			{ galaxy: 1, planets: 2 },
			{ galaxy: 2, planets: 1 },
			{ galaxy: 3, planets: 1 },
		]);
		expect(marks.get('1:5').map(({ name }) => name)).toEqual(['[RED]', 'Bob']);
		expect(shared.map(({ key }) => key)).toEqual(['1:5']);

		const split = comparePlayers(players, [
			{ kind: 'alliance', id: '7', slot: 0 },
			{ kind: 'player', id: '1', slot: 1 },
		]);
		expect(split.marks.get('2:9')).toEqual([{ slot: 1, name: 'Ann' }]);
		expect(split.shared.map(({ key }) => key)).toEqual(['1:5']);
		expect(playerSlots(split.tracks)).toEqual(
			new Map([
				['1', 1],
				['3', 0],
			]),
		);
	});

	it('is empty when nobody is compared', () => {
		expect(comparePlayers(players, [])).toMatchObject({ tracks: [], shared: [] });
	});
});

describe('alliances', () => {
	const players = [
		{ id: '1', name: 'A', alliance: { id: '7', tag: 'RED', name: 'Red Fleet' } },
		{ id: '2', name: 'B', alliance: { id: '7', tag: 'RED', name: 'Red Fleet' } },
		{ id: '3', name: 'C', alliance: { id: '8', tag: 'BLU', name: 'Deep Red' } },
		{ id: '4', name: 'D', alliance: { id: '9', tag: 'XRE', name: 'Xeno' } },
		{ id: '5', name: 'E', alliance: null },
	];
	const alliances = listAlliances(players);

	it('lists them from the roster with their member count', () => {
		expect(alliances).toEqual([
			{ id: '8', tag: 'BLU', name: 'Deep Red', members: 1 },
			{ id: '7', tag: 'RED', name: 'Red Fleet', members: 2 },
			{ id: '9', tag: 'XRE', name: 'Xeno', members: 1 },
		]);
	});

	it('suggests tags first, then names, then anything containing the query', () => {
		const found = suggestAlliances(alliances, 're');
		expect(found.map(({ alliance }) => alliance.tag)).toEqual(['RED', 'XRE', 'BLU']);
		// The biggest first among equally good matches.
		const small = { id: '10', tag: 'REA', name: 'Rear', members: 1 };
		expect(
			suggestAlliances([small, ...alliances], 're').map(({ alliance }) => alliance.tag),
		).toEqual(['RED', 'REA', 'XRE', 'BLU']);
		expect(found.map(({ match }) => match.field)).toEqual(['tag', 'tag', 'name']);
		expect(suggestAlliances(alliances, 'deep')[0].match).toEqual({ field: 'name', start: 0, end: 4 });
	});

	it('finds one typed in full, by tag or name', () => {
		expect(findAlliance(alliances, 'red')?.id).toBe('7');
		expect(findAlliance(alliances, 'deep red')?.id).toBe('8');
		expect(findAlliance(alliances, 'r')).toBeNull();
	});
});
