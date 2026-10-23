export const isBodyweight = exercise => exercise.name === 'Hanging Leg Raise';
export const isCardio = exercise => exercise.notes?.startsWith('CARDIO ONLY:') === true;
export const cardioTarget = exercise => exercise.notes?.match(/Cardio target: ([^;]+);/)?.[1] || '';
export function validateCardio(set) {
 if (set.kind === undefined) return;
 if (set.kind !== 'cardio') throw Error('Unknown activity type');
 if (!Number.isFinite(set.durationMinutes) || set.durationMinutes <= 0 || set.weight !== null || set.rir !== null || set.reps !== 0) throw Error('Enter cardio duration in minutes; load, reps and RIR do not apply.');
 for (const key of ['speedMph','inclinePercent']) if (set[key] !== null && (!Number.isFinite(set[key]) || set[key] < 0 || key === 'inclinePercent' && set[key] > 100)) throw Error('Enter valid speed and incline.');
}
