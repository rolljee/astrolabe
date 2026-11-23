// Presentation model for the galaxy heatmap.
//
// The roster already carries every player's planets, so the whole map is an
// aggregation done in the browser: one pass over the roster fills a
// galaxy × system grid, and changing the metric or a status chip only re-runs
// that pass. No new route, no request per cell.
//
// All pure, so it is tested without rendering anything.

import { formatCoordinates, galaxyUrl, parseCoordinates } from '../components/galaxy';
import { filterByStatus } from '../components/status';
import { normalizeForSearch } from '../components/search';

// What the colour of a cell counts. Planets say where the universe is crowded;
// inactives say where the farms are — the two questions people actually open a
// galaxy view for.
export const METRICS = [
	{ key: 'planets', labelKey: 'gm.metric.planets' },
	{ key: 'inactive', labelKey: 'gm.metric.inactive' },
];

// The shades, empty excluded, as fixed ranges of a system's 15 positions. Fixed
// rather than fitted to the universe: the same colour always means the same
// count, and a full system (15) gets a shade of its own so it stands out —
// that is the first thing a player looking for a slot wants to rule out.
export const HEAT_BINS = [
	{ level: 1, min: 1, max: 1 },
	{ level: 2, min: 2, max: 2 },
	{ level: 3, min: 3, max: 3 },
	{ level: 4, min: 4, max: 5 },
	{ level: 5, min: 6, max: 10 },
	{ level: 6, min: 11, max: 14 },
	{ level: 7, min: 15, max: 15 },
];

export const HEAT_LEVELS = HEAT_BINS.length;

// A player counts as a farm target once Gameforge has flagged them inactive,
// whichever of the two thresholds.
function isInactive(player) {
	return Boolean(player.status?.inactive || player.status?.longInactive);
}

// The universe size, from serverData.xml when the view has it. It may be
// missing (the request can fail on its own) and universe.xml can hold a planet
// past the announced bounds after a merge, so the data always gets the last
// word.
function gridSize({ galaxies, systems }, maxGalaxy, maxSystem) {
	return {
		galaxies: Math.max(Number(galaxies) || 0, maxGalaxy, 1),
		systems: Math.max(Number(systems) || 0, maxSystem, 1),
	};
}

function cellValue(cell, metric) {
	return metric === 'inactive' ? cell.inactive : cell.planets;
}

// Level 0 is "nothing here", so an occupied system is never painted as empty.
// Past 15 (a merge can leave odd data) still reads as full.
export function heatLevel(value) {
	if (!value || value <= 0) return 0;
	return (HEAT_BINS.find(({ max }) => value <= max) ?? HEAT_BINS[HEAT_BINS.length - 1]).level;
}

// The grid, ready to render: one row per galaxy, one cell per system.
//
// Players without coordinates are simply absent from it — universe.xml lags the
// roster by days, so anyone who registered since has no planet in it yet.
export function buildHeatmap(players, { galaxies, systems, statuses = [], metric = 'planets' } = {}) {
	const kept = filterByStatus(players, statuses);

	// Sparse while filling: a universe is 7 × 499 cells but only the occupied
	// ones are worth an object until the grid is laid out.
	const counts = new Map();
	let maxGalaxy = 0;
	let maxSystem = 0;

	for (const player of kept) {
		const inactive = isInactive(player);
		for (const planet of player.planets ?? []) {
			const parsed = parseCoordinates(planet.coords);
			if (!parsed) continue;

			maxGalaxy = Math.max(maxGalaxy, parsed.galaxy);
			maxSystem = Math.max(maxSystem, parsed.system);

			const key = `${parsed.galaxy}:${parsed.system}`;
			let cell = counts.get(key);
			if (!cell) {
				cell = { planets: 0, moons: 0, inactive: 0, players: new Set() };
				counts.set(key, cell);
			}
			cell.planets += 1;
			if (planet.moon) cell.moons += 1;
			if (inactive) cell.inactive += 1;
			cell.players.add(player.id);
		}
	}

	const size = gridSize({ galaxies, systems }, maxGalaxy, maxSystem);

	let max = 0;
	for (const cell of counts.values()) max = Math.max(max, cellValue(cell, metric));
	// Systems per shade, empty included, for the legend.
	const levels = Array(HEAT_LEVELS + 1).fill(0);

	const rows = [];
	for (let galaxy = 1; galaxy <= size.galaxies; galaxy += 1) {
		const cells = [];
		for (let system = 1; system <= size.systems; system += 1) {
			const cell = counts.get(`${galaxy}:${system}`);
			const value = cell ? cellValue(cell, metric) : 0;
			cells.push({
				galaxy,
				system,
				planets: cell?.planets ?? 0,
				moons: cell?.moons ?? 0,
				inactive: cell?.inactive ?? 0,
				players: cell?.players.size ?? 0,
				value,
				level: heatLevel(value),
			});
			levels[heatLevel(value)] += 1;
		}
		rows.push({ galaxy, cells });
	}

	return { rows, max, levels, galaxies: size.galaxies, systems: size.systems, positioned: countPositioned(kept) };
}

function countPositioned(players) {
	let planets = 0;
	for (const player of players) {
		for (const planet of player.planets ?? []) {
			if (parseCoordinates(planet.coords)) planets += 1;
		}
	}
	return planets;
}

// Ticks for the system axis. A universe has hundreds of systems and only a few
// can be labelled, so they are spaced evenly and always include the last one,
// which is what tells the reader where the map ends.
export function axisTicks(systems, step = 25) {
	const ticks = [];
	for (let system = 1; system <= systems; system += step) ticks.push(system);
	if (ticks[ticks.length - 1] !== systems) ticks.push(systems);
	return ticks;
}

// Who lives in the system a cell points at, for the panel below the map.
// Sorted by position so the list reads like the in-game galaxy view.
export function describeSystem(players, { galaxy, system, statuses = [], universe, lang } = {}) {
	const rows = [];

	for (const player of filterByStatus(players, statuses)) {
		const here = (player.planets ?? [])
			.map((planet) => ({ planet, parsed: parseCoordinates(planet.coords) }))
			.filter(({ parsed }) => parsed && parsed.galaxy === galaxy && parsed.system === system);

		for (const { planet, parsed } of here) {
			rows.push({
				id: `${player.id}:${parsed.position}`,
				player,
				position: parsed.position,
				coords: formatCoordinates(parsed),
				moon: planet.moon,
				url: universe && lang ? galaxyUrl({ universe, lang, ...parsed }) : null,
			});
		}
	}

	return rows.sort((a, b) => a.position - b.position);
}

// The player typed in the "locate" field, matched on the whole name so that
// "Ely" does not light up somebody else's planets while the name is being
// typed. Case and accents do not count, as everywhere else on the site.
export function findPlayer(players, query) {
	const wanted = normalizeForSearch(String(query ?? '').trim());
	if (!wanted) return null;
	return (players ?? []).find((player) => normalizeForSearch(player.name) === wanted) ?? null;
}

// The names offered under the "locate" field while a name is being typed:
// names that start with what was typed first, then names that merely contain
// it, each group in alphabetical order. Capped, so a two-letter query on a
// ten-thousand-player universe does not drop a wall of names on the map.
// `match` is where the typed text sits in the name, to underline it.
export function suggestPlayers(players, query, limit = 8) {
	const wanted = normalizeForSearch(String(query ?? '').trim());
	if (!wanted) return [];

	const starts = [];
	const contains = [];
	for (const player of players ?? []) {
		const at = matchRange(player.name, wanted);
		if (!at) continue;
		(at.start === 0 ? starts : contains).push({ player, match: at });
	}

	const byName = (a, b) => a.player.name.localeCompare(b.player.name);
	return [...starts.sort(byName), ...contains.sort(byName)].slice(0, limit);
}

// Where `wanted` (already normalised) sits in `name`, in the name's own
// characters: normalising strips accents, so "é" may stand for "e" + a combining
// mark, and the offsets of the normalised text are not those of the name.
function matchRange(name, wanted) {
	const chars = [...String(name)];
	let normalized = '';
	const origin = [];
	chars.forEach((char, index) => {
		const piece = normalizeForSearch(char);
		normalized += piece;
		for (let i = 0; i < piece.length; i += 1) origin.push(index);
	});

	const found = normalized.indexOf(wanted);
	if (found === -1) return null;
	const start = origin[found];
	const end = origin[found + wanted.length - 1] + 1;
	const before = chars.slice(0, start).join('');
	const hit = chars.slice(start, end).join('');
	return { start: before.length, end: before.length + hit.length };
}

// Where a player lives, as the map needs it: the systems to mark, each with the
// positions held there, in galaxy order.
export function playerSystems(player) {
	const systems = new Map();

	for (const planet of player?.planets ?? []) {
		const parsed = parseCoordinates(planet.coords);
		if (!parsed) continue;

		const key = `${parsed.galaxy}:${parsed.system}`;
		let entry = systems.get(key);
		if (!entry) {
			entry = { key, galaxy: parsed.galaxy, system: parsed.system, planets: [] };
			systems.set(key, entry);
		}
		entry.planets.push({ position: parsed.position, coords: formatCoordinates(parsed), moon: planet.moon });
	}

	return [...systems.values()]
		.map((entry) => ({ ...entry, planets: entry.planets.sort((a, b) => a.position - b.position) }))
		.sort((a, b) => a.galaxy - b.galaxy || a.system - b.system);
}

// How many entries (players or alliances) can be put on the map at once. Each
// one gets a colour of its own (`--gm-mark-1` to `--gm-mark-5`), and past five
// the colours stop being told apart on the heat ramp. An alliance takes a
// single colour however many members it has: that is what keeps a hundred-
// member alliance readable next to a lone player.
export const MAX_COMPARED = 5;

// The entries put on the map, as `{ kind, id, slot }` (kind is "player" or
// "alliance"): the slot is the entry's colour. A newcomer takes the first free
// slot, so removing one never repaints the others.
export function addCompared(list, kind, id) {
	if (list.some((entry) => entry.kind === kind && entry.id === id) || list.length >= MAX_COMPARED) {
		return list;
	}
	const taken = new Set(list.map(({ slot }) => slot));
	let slot = 0;
	while (taken.has(slot)) slot += 1;
	return [...list, { kind, id, slot }];
}

export function removeCompared(list, kind, id) {
	return list.filter((entry) => !(entry.kind === kind && entry.id === id));
}

// The alliances of a roster, built from the players' own alliance field (the
// roster has no separate list), with their member count, by tag.
export function listAlliances(players) {
	const alliances = new Map();
	for (const player of players ?? []) {
		const { alliance } = player;
		if (!alliance) continue;
		let entry = alliances.get(alliance.id);
		if (!entry) {
			entry = { id: alliance.id, tag: alliance.tag, name: alliance.name, members: 0 };
			alliances.set(alliance.id, entry);
		}
		entry.members += 1;
	}
	return [...alliances.values()].sort((a, b) => a.tag.localeCompare(b.tag));
}

// The alliances offered under the alliance field: tags that start with what
// was typed, then names that start with it, then anything that merely
// contains it; the biggest first within each group, since a big alliance is
// the one people come to look for. `match` says where to underline, in the
// tag or the name.
export function suggestAlliances(alliances, query, limit = 8) {
	const wanted = normalizeForSearch(String(query ?? '').trim());
	if (!wanted) return [];

	const ranked = [];
	for (const alliance of alliances ?? []) {
		const tag = matchRange(alliance.tag, wanted);
		const name = matchRange(alliance.name, wanted);
		if (!tag && !name) continue;
		let rank = 3;
		if (tag?.start === 0) rank = 0;
		else if (name?.start === 0) rank = 1;
		else if (tag) rank = 2;
		const field = tag && (rank !== 1 || !name) ? 'tag' : 'name';
		ranked.push({ alliance, rank, match: { field, ...(field === 'tag' ? tag : name) } });
	}

	return ranked
		.sort(
			(a, b) =>
				a.rank - b.rank ||
				b.alliance.members - a.alliance.members ||
				a.alliance.tag.localeCompare(b.alliance.tag),
		)
		.slice(0, limit)
		.map(({ alliance, match }) => ({ alliance, match }));
}

// The alliance typed in full, by tag or name; case and accents do not count.
export function findAlliance(alliances, query) {
	const wanted = normalizeForSearch(String(query ?? '').trim());
	if (!wanted) return null;
	return (
		(alliances ?? []).find(
			(alliance) =>
				normalizeForSearch(alliance.tag) === wanted || normalizeForSearch(alliance.name) === wanted,
		) ?? null
	);
}

// Where a group of players lives, merged: the systems to mark, each with the
// positions held there and who holds them.
function groupSystems(members) {
	const systems = new Map();
	for (const player of members) {
		for (const entry of playerSystems(player)) {
			let merged = systems.get(entry.key);
			if (!merged) {
				merged = { ...entry, planets: [] };
				systems.set(entry.key, merged);
			}
			merged.planets.push(...entry.planets.map((planet) => ({ ...planet, owner: player.name })));
		}
	}
	return [...systems.values()]
		.map((entry) => ({ ...entry, planets: entry.planets.sort((a, b) => a.position - b.position) }))
		.sort((a, b) => a.galaxy - b.galaxy || a.system - b.system);
}

// Planets per galaxy, for an alliance too spread out to list system by system.
function galaxySpread(systems) {
	const counts = new Map();
	for (const { galaxy, planets } of systems) counts.set(galaxy, (counts.get(galaxy) ?? 0) + planets.length);
	return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([galaxy, planets]) => ({ galaxy, planets }));
}

// Everything the map needs to compare the entries put on it:
// - `tracks`, one per entry still in the roster, with their systems; an
//   alliance's track leaves out the members also put on the map on their own,
//   so they keep their own colour instead of "sharing" a system with their
//   own alliance;
// - `marks`, who to draw in each "galaxy:system" cell, as `{ slot, name }`;
// - `shared`, the systems where at least two entries live, in map order, each
//   with who holds which positions there — the answer to "where do they meet".
export function comparePlayers(players, compared) {
	const roster = players ?? [];
	const byId = new Map(roster.map((player) => [player.id, player]));
	const alone = new Set(
		compared.filter(({ kind }) => kind !== 'alliance').map(({ id }) => id),
	);

	const tracks = [];
	for (const { kind, id, slot } of compared) {
		if (kind === 'alliance') {
			const everyone = roster.filter((player) => player.alliance?.id === id);
			if (!everyone.length) continue;
			const members = everyone.filter((player) => !alone.has(player.id));
			const { tag, name } = everyone[0].alliance;
			const systems = groupSystems(members);
			tracks.push({
				kind,
				key: `alliance:${id}`,
				slot,
				alliance: { id, tag, name },
				label: `[${tag}]`,
				members: [...everyone].sort((a, b) => a.name.localeCompare(b.name)),
				systems,
				spread: galaxySpread(systems),
			});
		} else {
			const player = byId.get(id);
			if (!player) continue;
			tracks.push({
				kind: 'player',
				key: `player:${id}`,
				slot,
				player,
				label: player.name,
				systems: playerSystems(player),
			});
		}
	}

	const cells = new Map();
	for (const track of tracks) {
		for (const entry of track.systems) {
			let cell = cells.get(entry.key);
			if (!cell) {
				cell = { key: entry.key, galaxy: entry.galaxy, system: entry.system, members: [] };
				cells.set(entry.key, cell);
			}
			cell.members.push({ key: track.key, label: track.label, slot: track.slot, planets: entry.planets });
		}
	}

	const marks = new Map();
	for (const cell of cells.values()) {
		cell.members.sort((a, b) => a.slot - b.slot);
		marks.set(
			cell.key,
			cell.members.map(({ slot, label }) => ({ slot, name: label })),
		);
	}

	const shared = [...cells.values()]
		.filter((cell) => cell.members.length > 1)
		.sort((a, b) => a.galaxy - b.galaxy || a.system - b.system);

	return { tracks, marks, shared };
}

// The colour each player of the system panel carries: their own when they are
// on the map, else their alliance's when it is.
export function playerSlots(tracks) {
	const slots = new Map();
	for (const track of tracks) {
		if (track.kind !== 'alliance') continue;
		for (const player of track.members) slots.set(player.id, track.slot);
	}
	for (const track of tracks) {
		if (track.kind === 'player') slots.set(track.player.id, track.slot);
	}
	return slots;
}
