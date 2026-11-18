import React from 'react';
import Ogame from 'ogamejs';
import { useI18n } from '../../i18n/I18nContext';
import { CLASSES, FLEET_SHIPS, shipImage, shipModel } from '../formulas';

// The ships as the game draws them; the name of the picked one goes in the
// title, the others in a tooltip.
function ShipChoices({ label, value, onChange }) {
	const { lang } = useI18n();
	const name = (id) => Ogame.i18n.getName(shipModel(id), lang);

	return (
		<div className="fl-choice">
			<h3 className="fl-choice-title">
				{label} · <strong className="fl-ship-name">{name(value)}</strong>
			</h3>
			<div className="fl-ships" role="group" aria-label={label}>
				{FLEET_SHIPS.map((id) => (
					<button
						key={id}
						type="button"
						className={`fl-ship ${id === value ? 'is-active' : ''}`}
						aria-pressed={id === value}
						aria-label={name(id)}
						title={name(id)}
						onClick={() => onChange(id)}
					>
						<img src={shipImage(id)} alt="" width="48" height="48" loading="lazy" />
					</button>
				))}
			</div>
		</div>
	);
}

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

// The slowest ship sets the pace of the whole fleet; the class changes how
// fast it goes.
function FleetPicker({ shipId, onShipChange, classKey, onClassChange }) {
	const { t } = useI18n();

	return (
		<div className="fl-fleet">
			<ShipChoices label={t('fl.ship')} value={shipId} onChange={onShipChange} />
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
		</div>
	);
}

export default FleetPicker;
