import React, { useId, useMemo, useState } from 'react';
import { Moon, UserSearch, X } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';
import StatusBadges from '../../components/StatusBadges';
import { MAX_COMPARED, findPlayer, suggestPlayers } from '../model';

const markStyle = (slot) => ({ '--gm-mark': `var(--gm-mark-${slot + 1})` });

// One system as a chip: its coordinates, then the positions held there. A
// shortcut to the system panel.
function SystemChip({ entry, positions, selected, onSelect }) {
	const isSelected =
		selected && selected.galaxy === entry.galaxy && selected.system === entry.system;
	return (
		<li>
			<button
				type="button"
				className={`chip gm-locator-system${isSelected ? ' is-active' : ''}`}
				aria-pressed={Boolean(isSelected)}
				onClick={() => onSelect({ galaxy: entry.galaxy, system: entry.system })}
			>
				<span className="gm-locator-coords">{entry.key}</span>
				{positions}
			</button>
		</li>
	);
}

function Positions({ planets, slot = null }) {
	const { t } = useI18n();
	return (
		<span className="gm-locator-positions">
			{slot !== null && (
				<span className="gm-locator-marker is-small" style={markStyle(slot)} aria-hidden="true" />
			)}
			{planets.map((planet) => (
				<span key={planet.position}>
					:{planet.position}
					{planet.moon && <Moon size={11} aria-label={t('gm.detail.moon')} />}
				</span>
			))}
		</span>
	);
}

// Put players on the map to compare where they live. Nothing is listed until a
// name is being typed; then a short list of matching names opens under the
// field (an ARIA combobox: arrows move, Enter picks, Escape closes). Picking a
// name adds that player in a colour of their own, up to MAX_COMPARED; each one
// lists their systems, and the systems two of them share are listed apart.
function PlayerLocator({
	players,
	query,
	onQuery,
	tracks,
	shared,
	onAdd,
	onRemove,
	onClear,
	selected,
	onSelect,
}) {
	const { t } = useI18n();
	const listId = useId();
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(-1);
	const typed = query.trim().length > 0;
	const full = tracks.length >= MAX_COMPARED;

	// The players already on the map are not offered again.
	const available = useMemo(() => {
		const taken = new Set(tracks.map(({ player }) => player.id));
		return players.filter((player) => !taken.has(player.id));
	}, [players, tracks]);
	const suggestions = useMemo(() => suggestPlayers(available, query), [available, query]);
	const expanded = open && suggestions.length > 0;
	const optionId = (index) => `${listId}-${index}`;

	const type = (value) => {
		onQuery(value);
		setOpen(true);
		setActive(-1);
	};

	const pick = (entry) => {
		onAdd(entry);
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
		} else if (event.key === 'Enter') {
			// The highlighted name, the only one left, or a name typed in full.
			const entry =
				(expanded ? suggestions[active]?.player : null) ??
				(suggestions.length === 1 ? suggestions[0].player : null) ??
				findPlayer(available, query);
			if (entry) {
				event.preventDefault();
				pick(entry);
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
							placeholder={t(full ? 'gm.player.full' : 'gm.player.placeholder', {
								max: MAX_COMPARED,
							})}
							disabled={full}
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
				{tracks.length > 1 && (
					<button type="button" className="btn-text gm-locator-clear" onClick={onClear}>
						<X size={15} aria-hidden="true" /> {t('gm.player.clearAll')}
					</button>
				)}
			</div>

			{typed && suggestions.length === 0 && (
				<p className="help">
					{findPlayer(players, query) ? t('gm.player.already') : t('gm.player.none')}
				</p>
			)}
			{tracks.length === 0 && !typed && <p className="help">{t('gm.player.hint', { max: MAX_COMPARED })}</p>}

			{tracks.map(({ player, slot, systems }) => {
				const planets = systems.reduce((total, entry) => total + entry.planets.length, 0);
				return (
					<div className="gm-locator-result" key={player.id}>
						<p className="gm-locator-who">
							<span className="gm-locator-marker" style={markStyle(slot)} aria-hidden="true" />
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
							<button
								type="button"
								className="btn-text gm-locator-remove"
								aria-label={t('gm.player.remove', { name: player.name })}
								title={t('gm.player.remove', { name: player.name })}
								onClick={() => onRemove(player.id)}
							>
								<X size={15} aria-hidden="true" />
							</button>
						</p>
						{systems.length > 0 && (
							<ul className="gm-locator-systems">
								{systems.map((entry) => (
									<SystemChip
										key={entry.key}
										entry={entry}
										positions={<Positions planets={entry.planets} />}
										selected={selected}
										onSelect={onSelect}
									/>
								))}
							</ul>
						)}
					</div>
				);
			})}

			{/* Where they meet: only worth a section once two players are compared. */}
			{tracks.length > 1 && (
				<div className="gm-locator-result gm-locator-shared" aria-live="polite">
					<p className="gm-locator-who">
						<span className="gm-detail-name">{t('gm.player.shared')}</span>
						<span className="help">
							{shared.length === 0
								? t('gm.player.shared.none')
								: t('gm.player.shared.count', { systems: shared.length })}
						</span>
					</p>
					{shared.length > 0 && (
						<ul className="gm-locator-systems">
							{shared.map((entry) => (
								<SystemChip
									key={entry.key}
									entry={entry}
									positions={entry.members.map(({ player, slot, planets }) => (
										<Positions key={player.id} planets={planets} slot={slot} />
									))}
									selected={selected}
									onSelect={onSelect}
								/>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	);
}

export default PlayerLocator;
