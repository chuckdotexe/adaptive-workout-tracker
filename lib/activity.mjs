// Load semantics belong to the JSON prescription, not an exercise-name allowlist.
export const isBodyweight = exercise => exercise?.bodyweight === true || String(exercise?.weightText || '').trim().toLowerCase() === 'bodyweight';
export const isCardio = exercise => exercise.notes?.startsWith('CARDIO ONLY:') === true;
export const cardioTarget = exercise => exercise.notes?.match(/Cardio target: ([^;]+);/)?.[1] || '';
export const OPTIONAL_TREADMILL_ID = 'optional-treadmill';
// Distance follows belt speed; step count is a range because actual stride is unmeasured.
export function treadmillMetrics(durationMinutes, speedMph) {
 if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || !Number.isFinite(speedMph) || speedMph <= 0) return null;
 const distanceMiles = durationMinutes * speedMph / 60;
 const meters = distanceMiles * 1609.344;
 return {distanceMiles, stepsLow:Math.round(meters / 0.75), stepsHigh:Math.round(meters / 0.65)};
}
export function validateCardio(set) {
 if (set.kind === undefined) return;
 if (set.kind !== 'cardio') throw Error('Unknown activity type');
 if (!Number.isFinite(set.durationMinutes) || set.durationMinutes <= 0 || set.weight !== null || set.rir !== null || set.reps !== 0) throw Error('Enter cardio duration in minutes; load, reps and RIR do not apply.');
 for (const key of ['speedMph','inclinePercent']) if (set[key] !== null && (!Number.isFinite(set[key]) || set[key] < 0 || key === 'inclinePercent' && set[key] > 100)) throw Error('Enter valid speed and incline.');
}
