import React from 'react';
import Ogame from 'ogamejs';
import { useI18n } from '../../i18n/I18nContext';
import { CLASSES, FLEET_SHIPS, MISSIONS, shipModel } from '../formulas';

function Choices({ label, options, value, onChange }) {
	return (
		<div className="fl-choice">
			<h3 className="fl-choice-title">{label}</h3>
			<div className="chips" role="group" aria-label={label}>
				{options.map(({ key, text, hint }) => (
					<button
						key={key}
						type="button"
						className={`chip ${key === value ? 'is-active' : ''}`}
						aria-pressed={key === value}
						title={hint}
						onClick={() => onChange(key)}
					>
						{text}
					</button>
				))}
			</div>
		</div>
	);
}

// The slowest ship sets the pace of the whole fleet; the class and the kind of
// mission change how fast it goes.
function FleetPicker({ shipId, onShipChange, classKey, onClassChange, mission, onMissionChange }) {
	const { t, lang } = useI18n();

	return (
		<div className="fl-fleet">
			<Choices
				label={t('fl.ship')}
				value={shipId}
				onChange={onShipChange}
				options={FLEET_SHIPS.map((id) => ({ key: id, text: Ogame.i18n.getName(shipModel(id), lang) }))}
			/>
			<Choices
				label={t('fl.class')}
				value={classKey}
				onChange={onClassChange}
				options={CLASSES.map((key) => ({
					key,
					text: t(`fl.class.${key}`),
					hint: t(`fl.class.${key}.hint`),
				}))}
			/>
			<Choices
				label={t('fl.mission')}
				value={mission}
				onChange={onMissionChange}
				options={MISSIONS.map(({ key }) => ({
					key,
					text: t(`fl.mission.${key}`),
					hint: t(`fl.mission.${key}.hint`),
				}))}
			/>
		</div>
	);
}

export default FleetPicker;
