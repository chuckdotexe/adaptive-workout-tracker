import {isCardio} from './activity.mjs';
import {validate} from './workout.mjs';

const assert = (condition, message) => { if (!condition) throw Error(message); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const number = value => Number.isFinite(value) && value >= 0;
const position = value => Number.isInteger(value?.week) && value.week >= 1 && value.week <= 8 &&
  Number.isInteger(value.day) && value.day >= 1 && value.day <= 6;
export const ordinal = ({week, day}) => (week - 1) * 6 + day;
export function following(value) {
  const index = ordinal(value);
  return index >= 48 ? null : {week: Math.floor(index / 6) + 1, day: index % 6 + 1};
}
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (object(value)) return '{' + Object.keys(value).sort().filter(k => value[k] !== undefined)
    .map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export async function digest(value) {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
}
export function validateQueue(queue, program) {
  assert(queue?.version === 1 && Array.isArray(queue.sessions), 'Invalid completed.json');
  validate({version: 1, sessions: queue.sessions, targets: {}, activeId: null});
  for (const session of queue.sessions) {
    assert(session.status === 'finished' && typeof session.submittedAt === 'string' &&
      Number.isFinite(Date.parse(session.submittedAt)) && typeof session.planRevision === 'string', 'Invalid completed workout');
    const exercises = program.filter(e => e.week === session.week && e.day === session.day);
    assert(Array.isArray(session.prescriptions) && session.prescriptions.length === exercises.length, 'Missing logged prescriptions');
    assert(Object.keys(session.skipped || {}).every(id=>exercises.some(e=>e.id===id)), 'Invalid skipped exercise');
    assert(session.sets.length > 0, 'No workout entries recorded');
    for (const ex of exercises) {
      const prescriptions = session.prescriptions.filter(p => p.exerciseId === ex.id);
      const count = session.sets.filter(s => s.exerciseId === ex.id).length;
      assert((session.skipped?.[ex.id] ? count < ex.sets : count === ex.sets) && prescriptions.length === 1,
        'Completed workout does not match program');
      assert(!session.sets.some(s=>s.exerciseId===ex.id && s.kind==='cardio' && !isCardio(ex)), 'Cardio data belongs to a resistance exercise');
      const p = prescriptions[0];
      assert(p.sets === ex.sets && p.minReps === ex.minReps && p.maxReps === ex.maxReps &&
        Number.isInteger(p.targetReps) && p.targetReps >= ex.minReps && p.targetReps <= ex.maxReps &&
        (p.weight === null || number(p.weight)) && (p.increment === null || number(p.increment)), 'Invalid logged prescription');
    }
  }
  return queue;
}
export function validatePlan(plan, program) {
  assert(plan?.version === 1 && typeof plan.revision === 'string' && plan.revision.length > 0 &&
    Number.isFinite(Date.parse(plan.updatedAt)) && Array.isArray(plan.workouts) && plan.workouts.length <= 6 &&
    Array.isArray(plan.processedSessions), 'Invalid next-week.json');
  const receipts = new Set();
  for (const receipt of plan.processedSessions) {
    assert(typeof receipt.id === 'string' && receipt.id && !receipts.has(receipt.id) &&
      /^[a-f0-9]{64}$/.test(receipt.digest), 'Invalid processed-session receipt');
    receipts.add(receipt.id);
  }
  let previous;
  for (const workout of plan.workouts) {
    assert(position(workout) && (!previous || ordinal(workout) === ordinal(previous) + 1), 'Upcoming workouts must be consecutive program days');
    const exercises = program.filter(e => e.week === workout.week && e.day === workout.day);
    assert(Array.isArray(workout.exercises) && workout.exercises.length === exercises.length, 'Upcoming exercise count mismatch');
    for (const ex of exercises) {
      const matching = workout.exercises.filter(e => e.exerciseId === ex.id);
      assert(matching.length === 1, 'Missing or duplicate upcoming exercise');
      const target = matching[0];
      assert((target.weight === null || number(target.weight)) && Number.isInteger(target.targetReps) &&
        target.targetReps >= ex.minReps && target.targetReps <= ex.maxReps &&
        (target.increment === null || number(target.increment)) && typeof target.reason === 'string', 'Invalid upcoming target');
    }
    previous = workout;
  }
  if (plan.workouts.length) assert(plan.workouts.length === Math.min(6, 49 - ordinal(plan.workouts[0])), 'Plan must cover the next six training sessions');
  return plan;
}
export function seedPlan(program, first = {week: 1, day: 1}, now = new Date().toISOString()) {
  const workouts = [];
  for (let cursor = first; cursor && workouts.length < 6; cursor = following(cursor)) {
    workouts.push({...cursor, dayLabel: program.find(e => e.week === cursor.week && e.day === cursor.day).dayLabel,
      exercises: program.filter(e => e.week === cursor.week && e.day === cursor.day).map(e => ({
        exerciseId: e.id, weight: e.weight, targetReps: e.minReps, increment: null,
        reason: 'Original program target; awaiting processed workout history.',
      }))});
  }
  return validatePlan({version: 1, revision: 'initial-program-v1', updatedAt: now, processedSessions: [], workouts}, program);
}
export function targetFromPlan(plan, exercise) {
  return plan.workouts.find(w => w.week === exercise.week && w.day === exercise.day)?.exercises.find(e => e.exerciseId === exercise.id);
}
export function currentDay(plan, queue) {
  return queue.sessions.length ? following(queue.sessions.at(-1)) :
    plan.workouts[0] ? {week: plan.workouts[0].week, day: plan.workouts[0].day} : null;
}
export function makeSubmission(session, exercises, plan, now = new Date().toISOString()) {
  const missing = exercises.filter(ex => !session.skipped?.[ex.id] && session.sets.filter(s => s.exerciseId === ex.id).length < ex.sets);
  if (missing.length) throw Error('Incomplete completed workout: ' + missing.map(ex => ex.name + ' (' + session.sets.filter(s => s.exerciseId === ex.id).length + '/' + ex.sets + ')').join(', '));
  const result = {...session, status: 'finished', decisions: {}, submittedAt: now, planRevision: plan.revision,
    prescriptions: exercises.map(ex => {
      const target = targetFromPlan(plan, ex);
      return {exerciseId: ex.id, name: ex.name, sets: ex.sets, minReps: ex.minReps, maxReps: ex.maxReps,
        weight: target?.weight ?? ex.weight, targetReps: target?.targetReps ?? ex.minReps,
        rirMin: ex.rirMin, rirMax: ex.rirMax, loadSemantics: ex.weightText,
        increment: session.increments?.[ex.id] ?? target?.increment ?? null};
    })};
  // A plan's explicit unknown load stays unknown rather than falling back to the CSV.
  result.prescriptions.forEach(p => { const t = targetFromPlan(plan, exercises.find(e => e.id === p.exerciseId)); if (t) p.weight = t.weight; });
  validateQueue({version: 1, sessions: [result]}, exercises);
  return result;
}
export async function appendToQueue(queue, plan, session, program) {
  validateQueue(queue, program); validatePlan(plan, program);
  validateQueue({version: 1, sessions: [session]}, program);
  const existing = queue.sessions.find(s => s.id === session.id);
  const receipt = plan.processedSessions.find(s => s.id === session.id);
  if (existing || receipt) {
    assert((existing ? await digest(existing) : receipt.digest) === await digest(session), 'Session ID already exists with different data');
    return {queue, duplicate: true};
  }
  return {queue: validateQueue({...queue, sessions: [...queue.sessions, session]}, program), duplicate: false};
}
