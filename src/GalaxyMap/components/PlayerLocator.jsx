import React, { useId } from 'react';
import { Moon, UserSearch, X } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';
import StatusBadges from '../../components/StatusBadges';

// Put one player on the map. The field suggests every name of the roster (a
// native datalist: the browser does the filtering and the keyboard handling),
// and once a name matches, the player's systems are marked on the grid and
// listed here, each one a shortcut to the system panel.
function PlayerLocator({ players, query, onQuery, player, systems, selected, onSelect }) {
	const { t } = useI18n();
	const listId = useId();
	const typed = query.trim().length > 0;
	const planets = systems.reduce((total, entry) => total + entry.planets.length, 0);

	return (
		<div className="gm-locator">
			<div className="gm-locator-row">
				<label className="field gm-locator-field">
					<span className="field-label">
						<UserSearch size={18} aria-hidden="true" />
						{t('gm.player.label')}
					</span>
					<input
						type="search"
						autoComplete="off"
						list={listId}
						placeholder={t('gm.player.placeholder')}
						value={query}
						onChange={(event) => onQuery(event.target.value)}
					/>
				</label>
				{typed && (
					<button
						type="button"
						className="btn-text gm-locator-clear"
						onClick={() => onQuery('')}
					>
						<X size={15} aria-hidden="true" /> {t('gm.player.clear')}
					</button>
				)}
				<datalist id={listId}>
					{players.map((entry) => (
						<option key={entry.id} value={entry.name} />
					))}
				</datalist>
			</div>

			{typed && !player && <p className="help">{t('gm.player.none')}</p>}

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
