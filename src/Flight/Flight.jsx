import React, { useMemo, useState } from 'react';

import { useI18n } from '../i18n/I18nContext';
import { fetchServerData } from '../api/ogame';
import { useApiData } from '../api/useApiData';
import { useUniverse } from '../universe/UniverseContext';
import { Group, ToolGrid } from '../components/Layout';
import { computeFlight, DEFAULT_MISSION, DEFAULT_SHIP, formatInput } from './formulas';
import RouteInput from './components/RouteInput';
import FleetPicker from './components/FleetPicker';
import DrivesInput from './components/DrivesInput';
import FlightTimes from './components/FlightTimes';
import ClockCalculator from './components/ClockCalculator';

const NO_DRIVES = { combustion: '', impulse: '', hyperspace: '' };

function Flight() {
	const { t } = useI18n();
	const { selection } = useUniverse();

	const [origin, setOrigin] = useState('');
	const [target, setTarget] = useState('');
	const [shipId, setShipId] = useState(DEFAULT_SHIP);
	const [classKey, setClassKey] = useState('other');
	const [mission, setMission] = useState(DEFAULT_MISSION);
	const [drives, setDrives] = useState(NO_DRIVES);

	// The clock starts on the current time, frozen until "Now" is pressed again.
	const [clock, setClock] = useState(() => ({ base: formatInput(new Date()), sign: '+', duration: '' }));

	const { data, error, loading } = useApiData(
		selection.universe ? (signal) => fetchServerData(selection, { signal }) : null,
		[selection.universe, selection.lang],
	);

	const result = useMemo(
		() => computeFlight({ data, origin, target, shipId, classKey, mission, drives }),
		[data, origin, target, shipId, classKey, mission, drives],
	);

	return (
		<ToolGrid
			settings={
				<>
					<Group title={t('fl.step.route')} help={t('fl.step.route.help')}>
						<RouteInput
							origin={origin}
							target={target}
							onOriginChange={setOrigin}
							onTargetChange={setTarget}
							data={data}
						/>
					</Group>
					<Group title={t('fl.step.fleet')} help={t('fl.step.fleet.help')}>
						<FleetPicker
							shipId={shipId}
							onShipChange={setShipId}
							classKey={classKey}
							onClassChange={setClassKey}
							mission={mission}
							onMissionChange={setMission}
						/>
					</Group>
					<Group title={t('fl.step.drives')} help={t('fl.step.drives.help')}>
						<DrivesInput value={drives} onChange={setDrives} />
					</Group>
				</>
			}
			report={
				<>
					{loading && <p className="help">{t('srv.loading')}</p>}
					{error && (
						<p className="api-error" role="alert">
							{t('srv.error.data')} <span className="api-error-detail">{error.message}</span>
						</p>
					)}
					<FlightTimes
						result={result}
						picked={clock.duration}
						onPick={(duration) => setClock((value) => ({ ...value, duration }))}
					/>
					<ClockCalculator value={clock} onChange={setClock} />
				</>
			}
		/>
	);
}

export default Flight;
