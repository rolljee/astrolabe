import React from 'react';
import { MapPin, Crosshair } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { MAX_FLIGHT_POSITION } from '../formulas';

// Coordinates are three numbers and two colons: the brackets the game writes
// around them ([2:106:15]) go away on paste.
const clean = (raw) => raw.replace(/[^\d:]/g, '');

function RouteInput({ origin, target, onOriginChange, onTargetChange, data }) {
	const { t } = useI18n();
	const galaxies = data ? Number(data.galaxies) : undefined;
	const systems = data ? Number(data.systems) : undefined;

	return (
		<div className="fl-route">
			<label className="field">
				<span className="field-label">
					<MapPin size={18} aria-hidden="true" />
					{t('fl.origin')}
				</span>
				<input
					type="text"
					inputMode="numeric"
					autoComplete="off"
					placeholder="2:106:15"
					value={origin}
					onChange={(e) => onOriginChange(clean(e.target.value))}
					aria-describedby="fl-route-range"
				/>
			</label>
			<label className="field">
				<span className="field-label">
					<Crosshair size={18} aria-hidden="true" />
					{t('fl.target')}
				</span>
				<input
					type="text"
					inputMode="numeric"
					autoComplete="off"
					placeholder="2:110:16"
					value={target}
					onChange={(e) => onTargetChange(clean(e.target.value))}
					aria-describedby="fl-route-range"
				/>
			</label>
			<p className="help" id="fl-route-range">
				{galaxies && systems
					? t('fl.route.range', { galaxies, systems, positions: MAX_FLIGHT_POSITION })
					: t('fl.route.help')}
			</p>
		</div>
	);
}

export default RouteInput;
