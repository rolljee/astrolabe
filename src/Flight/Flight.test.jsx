import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderView, screen, userEvent, waitFor } from '../test/utils';
import Flight from './Flight';
import { fetchServerData, fetchUniverses } from '../api/ogame';

vi.mock('../api/ogame', () => ({
	fetchUniverses: vi.fn(),
	fetchServerData: vi.fn(),
	ApiError: class ApiError extends Error {},
}));

const UNIVERSES = [{ language: 'fr', number: 282, name: 'Astrid' }];

const ASTRID = {
	name: 'Astrid',
	number: 282,
	language: 'fr',
	galaxies: 6,
	systems: 499,
	donutGalaxy: 1,
	donutSystem: 1,
	speedFleetPeaceful: 2,
	speedFleetWar: 2,
	speedFleetHolding: 2,
};

beforeEach(() => {
	vi.clearAllMocks();
	fetchUniverses.mockResolvedValue(UNIVERSES);
	fetchServerData.mockResolvedValue(ASTRID);
});

async function fillRoute(user) {
	// Pasted from the game, brackets included.
	await user.clear(screen.getByLabelText(/^From/));
	await user.paste('[2:106:15]');
	expect(screen.getByLabelText(/^From/)).toHaveValue('2:106:15');
	await user.clear(screen.getByLabelText(/^To/));
	await user.type(screen.getByLabelText(/^To/), '2:110:16');
}

describe('<Flight />', () => {
	it('starts on 1:1:1 to 1:1:1, so the table shows at once', async () => {
		renderView(<Flight />, { lang: 'en' });
		expect(screen.getByLabelText(/^From/)).toHaveValue('1:1:1');
		expect(screen.getByLabelText(/^To/)).toHaveValue('1:1:1');
		expect(await screen.findByText(/Distance 5 /)).toBeInTheDocument();
	});

	it('asks for both coordinates before showing durations', async () => {
		const user = userEvent.setup();
		renderView(<Flight />, { lang: 'en' });
		await waitFor(() => expect(fetchServerData).toHaveBeenCalled());
		await user.clear(screen.getByLabelText(/^To/));
		expect(await screen.findByText(/once both coordinates are filled in/)).toBeInTheDocument();
	});

	it('picks the slowest ship by its picture', async () => {
		const user = userEvent.setup();
		renderView(<Flight />, { lang: 'en' });
		await waitFor(() => expect(fetchServerData).toHaveBeenCalled());
		const probe = screen.getByRole('button', { name: 'Espionage Probe' });
		expect(probe.querySelector('img')).toHaveAttribute('src', '/ogame/ships/210.webp');
		await user.click(probe);
		expect(probe).toHaveAttribute('aria-pressed', 'true');
	});

	it('lists a duration for every speed step', async () => {
		const user = userEvent.setup();
		renderView(<Flight />, { lang: 'en' });
		await waitFor(() => expect(fetchServerData).toHaveBeenCalled());
		await fillRoute(user);

		expect(await screen.findByText('100 %')).toBeInTheDocument();
		expect(screen.getByText('10 %')).toBeInTheDocument();
		expect(screen.queryByText('95 %')).not.toBeInTheDocument();
		expect(screen.getByText(/Distance 3\.080/)).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'General' }));
		expect(screen.getByText('95 %')).toBeInTheDocument();
	});

	it('hands a clicked duration to the clock calculator', async () => {
		const user = userEvent.setup();
		renderView(<Flight />, { lang: 'en' });
		await waitFor(() => expect(fetchServerData).toHaveBeenCalled());
		await fillRoute(user);

		const time = screen.getByLabelText('Time');
		await user.clear(time);
		await user.type(time, '03.11.2026 21:00:00');

		const [first] = await screen.findAllByTitle('Use in the clock calculator');
		await user.click(first);
		expect(screen.getByLabelText('Duration')).toHaveValue(first.textContent);
		expect(screen.getByText(/Result:/)).toBeInTheDocument();
	});

	it('runs the clock without a universe', async () => {
		const user = userEvent.setup();
		fetchUniverses.mockResolvedValue([]);
		renderView(<Flight />, { lang: 'fr' });

		const time = screen.getByLabelText('Heure');
		await user.clear(time);
		await user.type(time, '03.11.2026 21:00:00');
		await user.type(screen.getByLabelText('Durée'), '3h 30m');

		expect(screen.getByText('mer. 04.11.2026 00:30:00')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: '− Retirer' }));
		expect(screen.getByText('mar. 03.11.2026 17:30:00')).toBeInTheDocument();
	});
});
