import {canonical, digest, currentDay, seedPlan, validatePlan, validateQueue} from './online-workflow.mjs';
import {FILES} from './github-store.mjs';

export const SHEET_HEADERS = ['Date', 'Workout Type', 'Session Name', 'Exercise / Activity', 'Muscle Group',
  'Set #', 'Reps', 'Weight', 'Weight Unit', 'Volume', 'RPE', 'Duration (min)', 'Distance', 'Distance Unit',
  'Avg HR', 'Cardio Type', 'Sauna (min)', 'Notes', 'Estimated 1RM', 'Actual RIR', 'Session ID', 'Set ID'];

export function sheetRows(session) {
  const count = new Map();
  return session.sets.map(set => {
    const p = session.prescriptions.find(e => e.exerciseId === set.exerciseId);
    const index = (count.get(set.exerciseId) ?? 0) + 1; count.set(set.exerciseId, index);
    if (set.kind === 'cardio') return [session.date, 'Cardio', `Week ${session.week} Day ${session.day}`, p.name, '', '', '', '', '', '', '', set.durationMinutes, '', '', '', 'Treadmill walk', '', [set.notes, set.speedMph === null ? '' : `Speed ${set.speedMph} mph`, set.inclinePercent === null ? '' : `Incline ${set.inclinePercent}%`].filter(Boolean).join(' · '), '', '', session.id, set.id];
    const notes = [set.notes, p.loadSemantics, set.rir === null ? 'RPE unknown' : 'RPE derived from actual RIR']
      .filter(Boolean).join(' · ');
    return [session.date, 'Strength', `Week ${session.week} Day ${session.day}`, p.name, '', index,
      set.reps, set.weight ?? '', set.bodyweight ? '' : 'lb', set.weight === null ? '' : set.weight * set.reps,
      set.rir === null ? '' : 10 - set.rir, '', '', '', '', '', '', notes, '', set.rir ?? '', session.id, set.id];
  });
}
export async function prepareBatch(snapshot, program) {
  validateQueue(snapshot.queue, program); validatePlan(snapshot.plan, program);
  const sessions = await Promise.all(snapshot.queue.sessions.map(async s => ({id: s.id, digest: await digest(s), setIds: s.sets.map(x => x.id)})));
  const first = currentDay(snapshot.plan, snapshot.queue);
  const nextPlan = seedPlan(program, first ?? null);
  nextPlan.revision = snapshot.plan.revision;
  nextPlan.processedSessions = snapshot.plan.processedSessions;
  // Retain existing targets for overlapping workouts; new slots start from program.
  for (const workout of nextPlan.workouts) {
    const old = snapshot.plan.workouts.find(w => w.week === workout.week && w.day === workout.day);
    if (old) workout.exercises = structuredClone(old.exercises);
  }
  return {version: 1, baseHead: snapshot.head, sessions,
    rows: snapshot.queue.sessions.flatMap(sheetRows), headers: SHEET_HEADERS, nextPlan,
    recentSessions: snapshot.queue.sessions,
    skippedExercises: snapshot.queue.sessions.flatMap(s=>Object.entries(s.skipped || {}).map(([exerciseId,reason])=>({sessionId:s.id,exerciseId,reason}))),
    instructions: 'Bodyweight exercises build reps or difficulty; do not prescribe added load for Hanging Leg Raise. Skipped exercises are not completed sets and must not justify progression. Cardio entries use duration, not resistance reps. Legacy treadmill entries without duration require clarification; never infer minutes. Read the last one or two comparable sessions per exercise from Sheets, including these new rows. Adjust nextPlan with reasons; do not infer missing loads or equipment equivalence. Verify Sheets IDs and values before finalize.'};
}
export async function finalizeProcessing(store, batch, proposedPlan, sheetReceipt, program, attempts = 4) {
  if (!batch?.sessions?.length) throw Error('No sessions to process');
  const batchIds = new Set(batch.sessions.map(s => s.id));
  if (batch.version !== 1 || batchIds.size !== batch.sessions.length ||
      batch.sessions.some(s => typeof s.id !== 'string' || !/^[a-f0-9]{64}$/.test(s.digest) || !Array.isArray(s.setIds))) throw Error('Invalid processing batch');
  if (!sheetReceipt?.spreadsheetId || !sheetReceipt?.range || sheetReceipt.verified !== true ||
      !Array.isArray(sheetReceipt.sessions) || batch.sessions.some(s => {
        const receipt = sheetReceipt.sessions.find(r => r.id === s.id);
        return !receipt || !Array.isArray(receipt.setIds) || receipt.digest !== s.digest || canonical([...receipt.setIds].sort()) !== canonical([...s.setIds].sort());
      })) throw Error('Verified Sheets receipt covering every session and set is required');
  validatePlan(proposedPlan, program);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const snapshot = await store.snapshot(program);
    const priorReceipts = new Map(snapshot.plan.processedSessions.map(r => [r.id, r]));
    let alreadyDone = true;
    for (const expected of batch.sessions) {
      const current = snapshot.queue.sessions.find(s => s.id === expected.id);
      const prior = priorReceipts.get(expected.id);
      if (current) {
        if (await digest(current) !== expected.digest ||
            canonical(current.sets.map(s => s.id).sort()) !== canonical([...expected.setIds].sort())) {
          throw Error('Completed workout changed; prepare and verify again');
        }
        alreadyDone = false;
      } else if (prior?.digest !== expected.digest) throw Error('Workout missing without a matching processing receipt');
    }
    if (alreadyDone) return {head: snapshot.head, alreadyProcessed: true};
    // A new submission can be merged. Another plan update needs fresh analysis.
    if (snapshot.plan.revision !== batch.nextPlan.revision) throw Error('Upcoming plan changed; prepare and analyze again');
    if (canonical(proposedPlan.workouts.map(w => [w.week, w.day])) !== canonical(batch.nextPlan.workouts.map(w => [w.week, w.day]))) {
      throw Error('Upcoming plan must cover the prepared six training sessions');
    }
    const queue = {...snapshot.queue, sessions: snapshot.queue.sessions.filter(s => !batchIds.has(s.id))};
    const processedSessions = [...snapshot.plan.processedSessions];
    for (const s of batch.sessions) if (!priorReceipts.has(s.id)) processedSessions.push({id: s.id, digest: s.digest});
    const plan = {...proposedPlan, revision: 'processed-' + globalThis.crypto.randomUUID(), updatedAt: new Date().toISOString(),
      processedSessions, sheetsReceipt: {spreadsheetId: sheetReceipt.spreadsheetId, range: sheetReceipt.range,
        verifiedAt: new Date().toISOString(), sessionIds: [...batchIds]}};
    validatePlan(plan, program); validateQueue(queue, program);
    try {
      const head = await store.writeFiles(snapshot.head, {[FILES.queue]: queue, [FILES.plan]: plan}, 'Process completed workouts and update upcoming plan [skip ci]');
      return {head, processed: batch.sessions.length, remaining: queue.sessions.length};
    } catch (error) {
      if (attempt === attempts - 1 || error.status && ![409, 422, 500, 502, 503, 504].includes(error.status)) throw error;
    }
  }
}
