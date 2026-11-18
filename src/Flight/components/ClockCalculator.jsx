import React, { useId } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { computeClock, formatInput, formatWhen } from '../formulas';

const SIGNS = ['+', '-'];

// A time plus or minus a duration: when the fleet lands, when to leave to be
// back to the second. Works without a universe.
function ClockCalculator({ value, onChange }) {
	const { t, lang } = useI18n();
	const baseId = useId();
	const durationId = useId();
	const set = (patch) => onChange({ ...value, ...patch });

	const clock = computeClock(value);

	return (
		<div className="result">
			<div className="result-head">
				<h2 className="result-title">{t('fl.clock.title')}</h2>
			</div>

			<div className="fl-clock">
				<div className="mini-field">
					<label htmlFor={baseId}>{t('fl.clock.base')}</label>
					<div className="fl-clock-row">
						<input
							id={baseId}
							type="text"
							autoComplete="off"
							placeholder="03.11.2026 21:45:12"
							value={value.base}
							onChange={(e) => set({ base: e.target.value })}
						/>
						<button type="button" className="btn btn-quiet" onClick={() => set({ base: formatInput(new Date()) })}>
							{t('fl.clock.now')}
						</button>
					</div>
				</div>

				<div className="fl-clock-row">
					<div className="chips" role="group" aria-label={t('fl.clock.sign')}>
						{SIGNS.map((sign) => (
							<button
								key={sign}
								type="button"
								className={`chip ${sign === value.sign ? 'is-active' : ''}`}
								aria-pressed={sign === value.sign}
								onClick={() => set({ sign })}
							>
								{t(sign === '+' ? 'fl.clock.add' : 'fl.clock.subtract')}
							</button>
						))}
					</div>
					<div className="mini-field fl-clock-duration">
						<label htmlFor={durationId}>{t('fl.clock.duration')}</label>
						<input
							id={durationId}
							type="text"
							autoComplete="off"
							placeholder={t('fl.clock.duration.placeholder')}
							value={value.duration}
							onChange={(e) => set({ duration: e.target.value })}
						/>
					</div>
				</div>
			</div>

			{clock.error && (
				<p className="result-empty" role="alert">
					{t(`fl.clock.error.${clock.error}`)}
				</p>
			)}
			{clock.ok && (
				<div className="result-for fl-clock-result">
					<span>
						{t('fl.clock.result')} <strong>{formatWhen(clock.date, lang)}</strong>
					</span>
					<button
						type="button"
						className="btn btn-quiet"
						onClick={() => set({ base: formatInput(clock.date) })}
					>
						{t('fl.clock.reuse')}
					</button>
				</div>
			)}
			{!clock.ok && !clock.error && <p className="help">{t('fl.clock.help')}</p>}
		</div>
	);
}

export default ClockCalculator;
