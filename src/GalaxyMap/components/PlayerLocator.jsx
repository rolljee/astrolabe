import React, { useId, useMemo, useState } from 'react';
import { Moon, UserSearch, X } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';
import StatusBadges from '../../components/StatusBadges';
import { suggestPlayers } from '../model';

// Put one player on the map. Nothing is listed until a name is being typed;
// then a short list of matching names opens under the field (an ARIA combobox:
// arrows move, Enter picks, Escape closes). Once the field names a player, its
// systems are marked on the grid and listed here, each one a shortcut to the
// system panel.
function PlayerLocator({ players, query, onQuery, player, systems, selected, onSelect }) {
	const { t } = useI18n();
	const listId = useId();
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(-1);
	const typed = query.trim().length > 0;
	const planets = systems.reduce((total, entry) => total + entry.planets.length, 0);

	const suggestions = useMemo(() => suggestPlayers(players, query), [players, query]);
	// Nothing left to offer once the field holds the only name that matches.
	const settled = player && suggestions.length === 1 && suggestions[0].player.id === player.id;
	const expanded = open && suggestions.length > 0 && !settled;
	const optionId = (index) => `${listId}-${index}`;

	const type = (value) => {
		onQuery(value);
		setOpen(true);
		setActive(-1);
	};

	const pick = (entry) => {
		onQuery(entry.name);
		setOpen(false);
		setActive(-1);
	};

	const handleKeyDown = (event) => {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			if (!suggestions.length) return;
			event.preventDefault();
			setOpen(true);
			const step = event.key === 'ArrowDown' ? 1 : -1;
			setActive((current) => (current + step + suggestions.length) % suggestions.length);
		} else if (event.key === 'Enter' && expanded) {
			const entry = suggestions[active] ?? (suggestions.length === 1 ? suggestions[0] : null);
			if (entry) {
				event.preventDefault();
				pick(entry.player);
			}
		} else if (event.key === 'Escape' && expanded) {
			event.preventDefault();
			setOpen(false);
			setActive(-1);
		}
	};

	return (
		<div className="gm-locator">
			<div className="gm-locator-row">
				<div className="gm-locator-combo">
					<label className="field gm-locator-field">
						<span className="field-label">
							<UserSearch size={18} aria-hidden="true" />
							{t('gm.player.label')}
						</span>
						<input
							type="search"
							role="combobox"
							autoComplete="off"
							spellCheck={false}
							aria-autocomplete="list"
							aria-controls={listId}
							aria-expanded={expanded}
							aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
							placeholder={t('gm.player.placeholder')}
							value={query}
							onChange={(event) => type(event.target.value)}
							onKeyDown={handleKeyDown}
							onFocus={() => setOpen(true)}
							onBlur={() => setOpen(false)}
						/>
					</label>
					<ul
						id={listId}
						role="listbox"
						aria-label={t('gm.player.suggestions')}
						className="gm-suggest"
						hidden={!expanded}
					>
						{expanded &&
							suggestions.map(({ player: entry, match }, index) => (
								<li
									key={entry.id}
									id={optionId(index)}
									role="option"
									aria-selected={index === active}
									className={`gm-suggest-option${index === active ? ' is-active' : ''}`}
									// mousedown, not click: the field would blur first and close the list.
									onMouseDown={(event) => {
										event.preventDefault();
										pick(entry);
									}}
									onMouseEnter={() => setActive(index)}
								>
									<span className="gm-suggest-name">
										{entry.name.slice(0, match.start)}
										<mark>{entry.name.slice(match.start, match.end)}</mark>
										{entry.name.slice(match.end)}
									</span>
									{entry.alliance && (
										<span className="gm-suggest-tag">[{entry.alliance.tag}]</span>
									)}
								</li>
							))}
					</ul>
				</div>
				{typed && (
					<button
						type="button"
						className="btn-text gm-locator-clear"
						onClick={() => type('')}
					>
						<X size={15} aria-hidden="true" /> {t('gm.player.clear')}
					</button>
				)}
			</div>

			{typed && !player && suggestions.length === 0 && <p className="help">{t('gm.player.none')}</p>}

			{player && (
				<div className="gm-locator-result" aria-live="polite">
					<p className="gm-locator-who">
						<span className="gm-locator-marker" aria-hidden="true" />
						<span className="gm-detail-name">{player.name}</span>
						{player.alliance && (
							<span className="pl-row-alliance">[{player.alliance.tag}]</span>
						)}
						<StatusBadges status={player.status} />
						<span className="help">
							{systems.length === 0
								? t('gm.player.unplaced')
								: t('gm.player.summary', { planets, systems: systems.length })}
						</span>
					</p>
					{systems.length > 0 && (
						<ul className="gm-locator-systems">
							{systems.map((entry) => {
								const isSelected =
									selected &&
									selected.galaxy === entry.galaxy &&
									selected.system === entry.system;
								return (
									<li key={entry.key}>
										<button
											type="button"
											className={`chip gm-locator-system${isSelected ? ' is-active' : ''}`}
											aria-pressed={Boolean(isSelected)}
											onClick={() =>
												onSelect({ galaxy: entry.galaxy, system: entry.system })
											}
										>
											<span className="gm-locator-coords">{entry.key}</span>
											<span className="gm-locator-positions">
												{entry.planets.map((planet) => (
													<span key={planet.position}>
														:{planet.position}
														{planet.moon && (
															<Moon size={11} aria-label={t('gm.detail.moon')} />
														)}
													</span>
												))}
											</span>
										</button>
									</li>
								);
							})}
						</ul>
					)}
				</div>
			)}
		</div>
	);
}

export default PlayerLocator;
