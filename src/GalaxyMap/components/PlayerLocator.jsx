import React, { useMemo } from 'react';
import { Moon, Plus, Shield, UserSearch, X } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';
import StatusBadges from '../../components/StatusBadges';
import {
	MAX_COMPARED,
	findAlliance,
	findPlayer,
	suggestAlliances,
	suggestPlayers,
} from '../model';
import NameCombobox from './NameCombobox';

const markStyle = (slot) => ({ '--gm-mark': `var(--gm-mark-${slot + 1})` });

function Highlight({ text, match }) {
	if (!match) return text;
	return (
		<>
			{text.slice(0, match.start)}
			<mark>{text.slice(match.start, match.end)}</mark>
			{text.slice(match.end)}
		</>
	);
}

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

// The positions held in a system; an alliance's say whose they are on hover.
function Positions({ planets, slot = null }) {
	const { t } = useI18n();
	return (
		<span className="gm-locator-positions">
			{slot !== null && (
				<span className="gm-locator-marker is-small" style={markStyle(slot)} aria-hidden="true" />
			)}
			{planets.map((planet) => (
				<span key={planet.position} title={planet.owner}>
					:{planet.position}
					{planet.moon && <Moon size={11} aria-label={t('gm.detail.moon')} />}
				</span>
			))}
		</span>
	);
}

function SystemChips({ systems, selected, onSelect }) {
	return (
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
	);
}

function RemoveButton({ label, onClick }) {
	const { t } = useI18n();
	return (
		<button
			type="button"
			className="btn-text gm-locator-remove"
			aria-label={t('gm.player.remove', { name: label })}
			title={t('gm.player.remove', { name: label })}
			onClick={onClick}
		>
			<X size={15} aria-hidden="true" />
		</button>
	);
}

function PlayerTrack({ track, selected, onSelect, onRemove }) {
	const { t } = useI18n();
	const { player, slot, systems } = track;
	const planets = systems.reduce((total, entry) => total + entry.planets.length, 0);
	return (
		<div className="gm-locator-result">
			<p className="gm-locator-who">
				<span className="gm-locator-marker" style={markStyle(slot)} aria-hidden="true" />
				<span className="gm-detail-name">{player.name}</span>
				{player.alliance && <span className="pl-row-alliance">[{player.alliance.tag}]</span>}
				<StatusBadges status={player.status} />
				<span className="help">
					{systems.length === 0
						? t('gm.player.unplaced')
						: t('gm.player.summary', { planets, systems: systems.length })}
				</span>
				<RemoveButton label={player.name} onClick={onRemove} />
			</p>
			{systems.length > 0 && <SystemChips systems={systems} selected={selected} onSelect={onSelect} />}
		</div>
	);
}

// An alliance can hold hundreds of planets: it shows its spread per galaxy, and
// keeps its systems and members folded away. Any member can be put on the map
// on their own, in a colour of their own, to single them out.
function AllianceTrack({ track, full, alone, selected, onSelect, onRemove, onAddPlayer }) {
	const { t } = useI18n();
	const { alliance, slot, systems, members, spread } = track;
	const planets = systems.reduce((total, entry) => total + entry.planets.length, 0);
	return (
		<div className="gm-locator-result">
			<p className="gm-locator-who">
				<span className="gm-locator-marker" style={markStyle(slot)} aria-hidden="true" />
				<span className="gm-detail-name">[{alliance.tag}]</span>
				<span>{alliance.name}</span>
				<span className="help">
					{t('gm.alliance.summary', { members: members.length, planets, systems: systems.length })}
				</span>
				<RemoveButton label={`[${alliance.tag}]`} onClick={onRemove} />
			</p>
			{spread.length > 0 && (
				<p className="gm-locator-spread" aria-label={t('gm.alliance.spread')}>
					{spread.map(({ galaxy, planets: count }) => (
						<span key={galaxy} className="gm-locator-spread-item">
							<span className="gm-locator-coords">G{galaxy}</span> {count}
						</span>
					))}
				</p>
			)}
			{systems.length > 0 && (
				<details className="disclosure gm-locator-more">
					<summary>{t('gm.alliance.systems', { systems: systems.length })}</summary>
					<SystemChips systems={systems} selected={selected} onSelect={onSelect} />
				</details>
			)}
			<details className="disclosure gm-locator-more">
				<summary>{t('gm.alliance.members', { members: members.length })}</summary>
				<ul className="gm-locator-members">
					{members.map((player) => (
						<li key={player.id}>
							<button
								type="button"
								className="chip"
								disabled={full || alone.has(player.id)}
								title={t('gm.alliance.single', { name: player.name })}
								onClick={() => onAddPlayer(player)}
							>
								<Plus size={13} aria-hidden="true" /> {player.name}
							</button>
						</li>
					))}
				</ul>
			</details>
		</div>
	);
}

// Put players and alliances on the map to compare where they live: two fields,
// so a big alliance takes one colour instead of filling the map with its
// members. Up to MAX_COMPARED entries in all; the systems two of them share
// are listed apart.
function PlayerLocator({
	players,
	alliances,
	tracks,
	shared,
	onAdd,
	onRemove,
	onClear,
	selected,
	onSelect,
}) {
	const { t } = useI18n();
	const full = tracks.length >= MAX_COMPARED;

	// What is already on the map is not offered again.
	const alone = useMemo(
		() => new Set(tracks.filter(({ kind }) => kind === 'player').map(({ player }) => player.id)),
		[tracks],
	);
	const onMap = useMemo(
		() =>
			new Set(tracks.filter(({ kind }) => kind === 'alliance').map(({ alliance }) => alliance.id)),
		[tracks],
	);
	const freePlayers = useMemo(() => players.filter((p) => !alone.has(p.id)), [players, alone]);
	const freeAlliances = useMemo(() => alliances.filter((a) => !onMap.has(a.id)), [alliances, onMap]);

	const placeholder = (key) => t(full ? 'gm.player.full' : key, { max: MAX_COMPARED });

	return (
		<div className="gm-locator">
			<div className="gm-locator-row">
				<NameCombobox
					label={t('gm.player.label')}
					Icon={UserSearch}
					placeholder={placeholder('gm.player.placeholder')}
					disabled={full}
					suggest={(query) =>
						suggestPlayers(freePlayers, query).map(({ player, match }) => ({
							key: player.id,
							item: player,
							content: (
								<>
									<span className="gm-suggest-name">
										<Highlight text={player.name} match={match} />
									</span>
									{player.alliance && (
										<span className="gm-suggest-tag">[{player.alliance.tag}]</span>
									)}
								</>
							),
						}))
					}
					findExact={(query) => findPlayer(freePlayers, query)}
					missing={(query) =>
						findPlayer(players, query) ? t('gm.player.already') : t('gm.player.none')
					}
					onPick={(player) => onAdd('player', player.id)}
				/>
				<NameCombobox
					label={t('gm.alliance.label')}
					Icon={Shield}
					placeholder={placeholder('gm.alliance.placeholder')}
					disabled={full}
					suggest={(query) =>
						suggestAlliances(freeAlliances, query).map(({ alliance, match }) => ({
							key: alliance.id,
							item: alliance,
							content: (
								<>
									<span className="gm-suggest-name">
										[<Highlight text={alliance.tag} match={match.field === 'tag' ? match : null} />]{' '}
										<Highlight text={alliance.name} match={match.field === 'name' ? match : null} />
									</span>
									<span className="gm-suggest-tag">
										{t('gm.alliance.count', { members: alliance.members })}
									</span>
								</>
							),
						}))
					}
					findExact={(query) => findAlliance(freeAlliances, query)}
					missing={(query) =>
						findAlliance(alliances, query) ? t('gm.alliance.already') : t('gm.alliance.none')
					}
					onPick={(alliance) => onAdd('alliance', alliance.id)}
				/>
				{tracks.length > 1 && (
					<button type="button" className="btn-text gm-locator-clear" onClick={onClear}>
						<X size={15} aria-hidden="true" /> {t('gm.player.clearAll')}
					</button>
				)}
			</div>

			{tracks.length === 0 && <p className="help">{t('gm.player.hint', { max: MAX_COMPARED })}</p>}

			{tracks.map((track) =>
				track.kind === 'alliance' ? (
					<AllianceTrack
						key={track.key}
						track={track}
						full={full}
						alone={alone}
						selected={selected}
						onSelect={onSelect}
						onRemove={() => onRemove('alliance', track.alliance.id)}
						onAddPlayer={(player) => onAdd('player', player.id)}
					/>
				) : (
					<PlayerTrack
						key={track.key}
						track={track}
						selected={selected}
						onSelect={onSelect}
						onRemove={() => onRemove('player', track.player.id)}
					/>
				),
			)}

			{/* Where they meet: only worth a section once two entries are compared. */}
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
									positions={entry.members.map(({ key, slot, planets }) => (
										<Positions key={key} planets={planets} slot={slot} />
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
