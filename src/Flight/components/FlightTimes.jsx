import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { groupDigits } from '../../components/format';
import { formatDuration } from '../formulas';

// Every speed step, one way and there and back. A click on a duration hands
// it to the clock calculator below.
function FlightTimes({ result, picked, onPick }) {
	const { t, lang } = useI18n();

	if (!result.ok) {
		return (
			<div className="result">
				<div className="result-head">
					<h2 className="result-title">{t('fl.result.title')}</h2>
				</div>
				<p className="result-empty">
					{t(`fl.error.${result.error}`, { drive: result.drive ? t(`fl.drive.${result.drive}`) : '' })}
				</p>
			</div>
		);
	}

	const { distance, fleetSpeed, missionSpeed, rows } = result;

	function cell(seconds) {
		const text = formatDuration(seconds, lang);
		return (
			<td>
				<button
					type="button"
					className={`fl-pick ${text === picked ? 'is-active' : ''}`}
					aria-pressed={text === picked}
					title={t('fl.result.pick')}
					onClick={() => onPick(text)}
				>
					{text}
				</button>
			</td>
		);
	}

	return (
		<div className="result">
			<div className="result-head">
				<h2 className="result-title">{t('fl.result.title')}</h2>
				<span className="result-meta">
					{t('fl.result.meta', {
						distance: groupDigits(distance),
						speed: groupDigits(fleetSpeed),
						universe: missionSpeed,
					})}
				</span>
			</div>

			<table className="fl-table">
				<thead>
					<tr>
						<th scope="col">{t('fl.result.speed')}</th>
						<th scope="col">{t('fl.result.oneWay')}</th>
						<th scope="col">{t('fl.result.roundTrip')}</th>
					</tr>
				</thead>
				<tbody>
					{rows.map(({ percent, duration, roundTrip }) => (
						<tr key={percent}>
							<th scope="row">{percent} %</th>
							{cell(duration)}
							{cell(roundTrip)}
						</tr>
					))}
				</tbody>
			</table>

			<p className="result-for">{t('fl.result.hint')}</p>
		</div>
	);
}

export default FlightTimes;
