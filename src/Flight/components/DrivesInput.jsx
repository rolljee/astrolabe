import React, { useId } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { DRIVES, MAX_DRIVE_LEVEL } from '../formulas';

// The three drive technologies, as a spy report shows them.
function DrivesInput({ value, onChange }) {
	const { t } = useI18n();
	const baseId = useId();

	return (
		<>
			<div className="fl-drives">
				{DRIVES.map((drive) => {
					const id = `${baseId}-${drive}`;
					return (
						<div className="mini-field" key={drive}>
							<label htmlFor={id}>{t(`fl.drive.${drive}`)}</label>
							<input
								id={id}
								type="text"
								inputMode="numeric"
								autoComplete="off"
								placeholder="0"
								value={value[drive]}
								onChange={(e) => onChange({ ...value, [drive]: e.target.value.replace(/\D/g, '') })}
							/>
						</div>
					);
				})}
			</div>
			<p className="help">{t('fl.drives.range', { max: MAX_DRIVE_LEVEL })}</p>
		</>
	);
}

export default DrivesInput;
