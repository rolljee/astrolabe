import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderView, screen, userEvent, waitFor, within } from '../test/utils';
import GalaxyMap from './GalaxyMap';
import { fetchRoster, fetchServerData, fetchUniverses } from '../api/ogame';

vi.mock('../api/ogame', () => ({
	fetchUniverses: vi.fn(),
	fetchRoster: vi.fn(),
	fetchServerData: vi.fn(),
	ApiError: class ApiError extends Error {},
}));

const UNIVERSES = [
	{ language: 'en', number: 101, name: 'Quantum' },
	{ language: 'fr', number: 172, name: 'Tucana' },
];

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

// Two neighbours crowd 1:1, one long-inactive player sits alone in 2:3.
const ROSTER = {
	total: 3,
	coordsTimestamp: Math.round(Date.now() / 1000) - 7200,
	players: [
		{
			id: '1',
			name: 'Élysée',
			alliance: { id: '5', name: 'The Wolf Army', tag: 'TWA' },
			status: status({ active: true }),
			planets: [
				{ coords: '1:1:4', moon: false },
				{ coords: '1:1:8', moon: true },
			],
		},
		{
			id: '2',
			name: 'Elysium',
			alliance: null,
			status: status({ active: true }),
			planets: [{ coords: '1:1:12', moon: false }],
		},
		{
			id: '3',
			name: 'Sleeper',
			alliance: null,
			status: status({ inactive: true, longInactive: true }),
			planets: [{ coords: '2:3:6', moon: false }],
		},
	],
};

const cell = (coords) => screen.getByRole('button', { name: new RegExp(`^${coords} —`) });

beforeEach(() => {
	vi.clearAllMocks();
	fetchUniverses.mockResolvedValue(UNIVERSES);
	fetchRoster.mockResolvedValue(ROSTER);
	fetchServerData.mockResolvedValue({ galaxies: 2, systems: 4 });
});

describe('<GalaxyMap />', () => {
	it('draws the whole universe from a single roster request', async () => {
		renderView(<GalaxyMap />, { lang: 'en' });
		await screen.findByLabelText('Community');

		await waitFor(() =>
			expect(fetchRoster).toHaveBeenCalledWith({ lang: 'en', universe: '101' }, expect.anything()),
		);

		expect(await screen.findByLabelText(/^1:1 — 3 planet\(s\), 2 player\(s\), 1 moon\(s\)/)).toBeInTheDocument();
		expect(screen.getByLabelText(/^2:4 — 0 planet\(s\)/)).toBeInTheDocument();
		expect(screen.getByText('4 placed planet(s) across 2 galaxy(ies) × 4 systems.')).toBeInTheDocument();
	});

	it('shades a system by how many planets it holds', async () => {
		renderView(<GalaxyMap />, { lang: 'en' });
		await screen.findByLabelText(/^1:1 —/);

		expect(cell('1:1')).toHaveClass('gm-level-3');
		expect(cell('2:3')).toHaveClass('gm-level-1');
		expect(cell('1:2')).toHaveClass('gm-level-0');
	});

	it('names the range each shade covers', async () => {
		renderView(<GalaxyMap />, { lang: 'en' });
		await screen.findByLabelText(/^1:1 —/);

		expect(screen.getByRole('button', { name: 'Empty' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: '6–10' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: '15' })).toBeInTheDocument();
		expect(screen.getByText('planets per system')).toBeInTheDocument();
	});

	it('fades the systems outside the shades picked in the legend', async () => {
		const user = userEvent.setup();
		renderView(<GalaxyMap />, { lang: 'en' });
		await screen.findByLabelText(/^1:1 —/);

		await user.click(screen.getByRole('button', { name: '3' }));

		expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-pressed', 'true');
		expect(cell('1:1')).not.toHaveClass('is-dimmed');
		expect(cell('2:3')).toHaveClass('is-dimmed');
		expect(screen.getByText(/1 system\(s\) highlighted\./)).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Show all' }));

		expect(cell('2:3')).not.toHaveClass('is-dimmed');
	});

	it('recolours for inactives without another request', async () => {
		const user = userEvent.setup();
		renderView(<GalaxyMap />, { lang: 'en' });
		await screen.findByLabelText(/^1:1 —/);

		await user.click(screen.getByRole('button', { name: 'Inactives' }));

		expect(cell('2:3')).toHaveClass('gm-level-1');
		expect(cell('1:1')).toHaveClass('gm-level-0');
		expect(fetchRoster).toHaveBeenCalledTimes(1);
	});

	it('only counts the selected statuses', async () => {
		const user = userEvent.setup();
		renderView(<GalaxyMap />, { lang: 'en' });
		await screen.findByLabelText(/^1:1 —/);

		await user.click(screen.getByRole('button', { name: /Inactive \(28 d\)/ }));

		expect(cell('1:1')).toHaveClass('gm-level-0');
		expect(screen.getByText('1 placed planet(s) across 2 galaxy(ies) × 4 systems.')).toBeInTheDocument();
	});

	it('lists who lives in a system when its cell is clicked', async () => {
		const user = userEvent.setup();
		renderView(<GalaxyMap />, { lang: 'en' });
		await screen.findByLabelText(/^1:1 —/);

		await user.click(cell('1:1'));

		expect(screen.getByText('System 1:1')).toBeInTheDocument();
		const rows = within(screen.getByRole('list'));
		expect(rows.getAllByRole('link').map((link) => link.textContent)).toEqual([
			'1:1:4',
			'1:1:8',
			'1:1:12',
		]);
		// Élysée holds two planets there, so she gets two rows.
		expect(rows.getAllByText('Élysée')).toHaveLength(2);
		expect(rows.getAllByText('[TWA]')).toHaveLength(2);
	});

	it('marks the systems of a located player and lists them', async () => {
		const user = userEvent.setup();
		renderView(<GalaxyMap />, { lang: 'en' });
		await screen.findByLabelText(/^1:1 —/);

		const field = screen.getByRole('combobox', { name: 'Player' });
		// Nothing is suggested before typing.
		await user.click(field);
		expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

		await user.type(field, 'zz');
		expect(screen.getByText('No player by that name in this universe.')).toBeInTheDocument();

		await user.clear(field);
		await user.type(field, 'ely');
		// A partial name marks nobody, but offers the matching names.
		expect(cell('1:1')).not.toHaveClass('is-marked');
		const options = within(screen.getByRole('listbox')).getAllByRole('option');
		expect(options.map((option) => option.textContent)).toEqual(['Élysée[TWA]', 'Elysium']);

		await user.keyboard('{ArrowDown}{Enter}');
		// Picking puts the player on the map and frees the field for the next one.
		expect(field).toHaveValue('');
		expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

		expect(cell('1:1')).toHaveClass('is-marked');
		expect(cell('1:1')).toHaveAccessibleName(/home of Élysée$/);
		expect(cell('2:3')).toHaveClass('is-faded');
		expect(screen.getByText('2 planet(s) in 1 system(s)')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: /^1:1\s*:4/ }));
		expect(screen.getByText('System 1:1')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Remove Élysée from the map' }));
		expect(cell('1:1')).not.toHaveClass('is-marked');
		expect(cell('2:3')).not.toHaveClass('is-faded');

		// Picking with the mouse works the same way.
		await user.type(field, 'sleep');
		await user.click(screen.getByRole('option', { name: 'Sleeper' }));
		expect(cell('2:3')).toHaveClass('is-marked');
	});

	it('compares several players, each in their own colour', async () => {
		const user = userEvent.setup();
		renderView(<GalaxyMap />, { lang: 'en' });
		await screen.findByLabelText(/^1:1 —/);

		const field = screen.getByRole('combobox', { name: 'Player' });
		await user.type(field, 'sleeper{Enter}');
		expect(cell('2:3')).toHaveClass('is-marked');
		expect(cell('2:3').style.getPropertyValue('--gm-mark')).toBe('var(--gm-mark-1)');

		await user.type(field, 'elysium{Enter}');
		expect(cell('1:1').style.getPropertyValue('--gm-mark')).toBe('var(--gm-mark-2)');
		// Nobody shares a system yet.
		expect(screen.getByText('no shared system')).toBeInTheDocument();

		// A player already on the map is not offered again.
		await user.type(field, 'elysium');
		expect(screen.getByText('That player is already on the map.')).toBeInTheDocument();
		await user.clear(field);

		await user.type(field, 'élysée{Enter}');
		expect(cell('1:1')).toHaveClass('is-shared');
		expect(cell('1:1')).toHaveAccessibleName(/home of Elysium, Élysée$/);
		expect(cell('2:3')).toHaveClass('is-marked');
		expect(screen.getByText('1 system(s) where several entries of the map meet')).toBeInTheDocument();

		// Removing a player keeps the colours of the others.
		await user.click(screen.getByRole('button', { name: 'Remove Sleeper from the map' }));
		expect(cell('2:3')).toHaveClass('is-faded');
		expect(cell('1:1')).toHaveClass('is-shared');

		await user.click(screen.getByRole('button', { name: /Remove everyone/ }));
		expect(cell('1:1')).not.toHaveClass('is-marked');
	});

	it('puts a whole alliance on the map in a single colour', async () => {
		const user = userEvent.setup();
		renderView(<GalaxyMap />, { lang: 'en' });
		await screen.findByLabelText(/^1:1 —/);

		const field = screen.getByRole('combobox', { name: 'Alliance' });
		await user.type(field, 'wolf');
		expect(
			within(screen.getByRole('listbox', { name: 'Alliance' }))
				.getAllByRole('option')
				.map((option) => option.textContent),
		).toEqual(['[TWA] The Wolf Army1 member(s)']);
		await user.keyboard('{Enter}');

		expect(field).toHaveValue('');
		expect(cell('1:1')).toHaveClass('is-marked');
		expect(cell('1:1')).toHaveAccessibleName(/home of \[TWA\]$/);
		expect(cell('2:3')).toHaveClass('is-faded');
		expect(screen.getByText('1 member(s), 2 planet(s) in 1 system(s)')).toBeInTheDocument();

		await user.type(field, 'twa');
		expect(screen.getByText('That alliance is already on the map.')).toBeInTheDocument();
		await user.clear(field);

		// A member put on the map on their own leaves the alliance's colour.
		await user.click(screen.getByText('Members (1): add one on their own'));
		await user.click(screen.getByRole('button', { name: /Élysée/ }));
		expect(cell('1:1')).toHaveAccessibleName(/home of Élysée$/);
		expect(cell('1:1')).not.toHaveClass('is-shared');
		expect(cell('1:1').style.getPropertyValue('--gm-mark')).toBe('var(--gm-mark-2)');
		expect(screen.getByText('no shared system')).toBeInTheDocument();
	});

	it('still draws the map when the universe size is unavailable', async () => {
		fetchServerData.mockRejectedValue(new Error('nope'));
		renderView(<GalaxyMap />, { lang: 'en' });

		expect(await screen.findByLabelText(/^1:1 —/)).toBeInTheDocument();
		expect(screen.getByText('4 placed planet(s) across 2 galaxy(ies) × 3 systems.')).toBeInTheDocument();
	});

	it('reports a roster the proxy could not load', async () => {
		fetchRoster.mockRejectedValue(new Error('upstream 502'));
		renderView(<GalaxyMap />, { lang: 'en' });

		expect(await screen.findByRole('alert')).toHaveTextContent(
			"Could not load this universe's roster.",
		);
	});
});
