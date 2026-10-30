import {validateCardio,isBodyweight} from './activity.mjs';
import {evaluate} from './progression-core.mjs';

export const KEY = 'awt-v1';
export const RULE_VERSION = 'double-progression-v2';
export function empty() {
  return {version: 1, sessions: [], targets: {}, activeId: null};
}
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const nonnegative = value => Number.isFinite(value) && value >= 0;
const optionalNumber = value => value === null || nonnegative(value);

// Validate before replacing storage, including backups from the first local slice.
export function validate(state) {
  const fail = () => { throw Error('Invalid workout backup; existing data preserved'); };
  if (!object(state) || state.version !== 1 || !Array.isArray(state.sessions) || !object(state.targets)) fail();
  if (state.selection !== undefined && (!object(state.selection) ||
      !Number.isInteger(state.selection.week) || state.selection.week < 1 || state.selection.week > 8 ||
      !Number.isInteger(state.selection.day) || state.selection.day < 1 || state.selection.day > 6)) fail();
  const ids = new Set();
  const setIds = new Set();
  for (const session of state.sessions) {
    if (!object(session) || typeof session.id !== 'string' || !session.id || ids.has(session.id) ||
        !Number.isInteger(session.week) || session.week < 1 || session.week > 8 ||
        !Number.isInteger(session.day) || session.day < 1 || session.day > 6 ||
        typeof session.date !== 'string' || !['active', 'finished'].includes(session.status) ||
        !Array.isArray(session.sets) || !object(session.decisions)) fail();
    if(session.skipped !== undefined && !object(session.skipped)) fail();
    if(session.elapsedSeconds !== undefined && !nonnegative(session.elapsedSeconds)) fail();
    if(session.durationMinutes !== undefined && !nonnegative(session.durationMinutes)) fail();
    if(session.timerStartedAt != null && !Number.isFinite(Date.parse(session.timerStartedAt))) fail();
    for (const [key,value] of Object.entries(session.skipped || {})) if (!key.startsWith('w'+session.week+'d'+session.day+'e') || value !== 'Machine unavailable') fail();
    if (session.deferred !== undefined && (!Array.isArray(session.deferred) || session.deferred.some(id=>typeof id !== 'string' || !id.startsWith('w'+session.week+'d'+session.day+'e')))) fail();
    ids.add(session.id);
    for (const set of session.sets) {
      if (!object(set) || typeof set.id !== 'string' || !set.id || setIds.has(set.id) ||
          typeof set.exerciseId !== 'string' || !/^w\d+d\d+e\d+$/.test(set.exerciseId) ||
          !Number.isInteger(set.reps) || set.reps < 0 || !optionalNumber(set.weight) ||
          !(set.rir === null || nonnegative(set.rir) && set.rir <= 10) ||
          set.notes !== undefined && typeof set.notes !== 'string') fail();
      if (!set.exerciseId.startsWith(`w${session.week}d${session.day}e`)) fail();
      if (set.rpeSource === 'derived' && (set.rir === null || set.rpe !== 10 - set.rir)) fail();
      if (set.rpeSource === 'missing' && set.rpe !== null) fail();
      if (set.bodyweight === true && set.weight !== null) fail();
      validateCardio(set);
      setIds.add(set.id);
    }
    if (session.increments !== undefined &&
        (!object(session.increments) || Object.values(session.increments).some(n => !nonnegative(n)))) fail();
    for (const decision of Object.values(session.decisions)) {
      if (!object(decision) || !['hold', 'review', 'propose-increase'].includes(decision.action) ||
          !optionalNumber(decision.proposedWeight) || typeof decision.reason !== 'string') fail();
    }
  }
  if (state.activeId !== null && !ids.has(state.activeId)) fail();
  if (state.sessions.some(s => s.status === 'active' && s.id !== state.activeId)) fail();
  for (const target of Object.values(state.targets)) {
    if (!object(target) || !optionalNumber(target.weight) ||
        target.targetReps !== undefined && (!Number.isInteger(target.targetReps) || target.targetReps < 0) ||
        target.minReps !== undefined && (!Number.isInteger(target.minReps) || target.minReps < 0)) fail();
  }
  return state;
}
export function read(storage) {
  const raw = storage.getItem(KEY);
  return raw ? validate(JSON.parse(raw)) : empty();
}
export function save(storage, state) {
  storage.setItem(KEY, JSON.stringify(validate(state)));
}
export function restore(text) {
  return validate(JSON.parse(text));
}
export function start(state, week, day, id, date) {
  if (state.activeId) throw Error('Close the current workout first');
  if (state.sessions.some(s => s.id === id)) throw Error('Workout ID already exists');
  return {...state, activeId: id, sessions: [...state.sessions, {
    id, week, day, date, status: 'active', sets: [], decisions: {}, increments: {},
  }]};
}
export function targetFor(state, ex) {
  const approved = state.targets[ex.id];
  // The program range stays authoritative. v1 minReps was a suggested rep goal.
  return {...ex, weight: approved ? approved.weight : ex.weight,
    targetReps: approved?.targetReps ?? approved?.minReps ?? ex.minReps};
}
export function setIncrement(state, exercise, increment) {
  if (!nonnegative(increment)) throw Error('Enter a nonnegative equipment increment');
  const session = state.sessions.find(s => s.id === state.activeId);
  if (session?.status !== 'active') throw Error('Start a workout first');
  return {...state, sessions: state.sessions.map(s => s.id === session.id
    ? {...s, increments: {...s.increments, [exercise.id]: increment}} : s)};
}
export function record(state, exercise, set) {
  if (isBodyweight(exercise)) set = {...set, weight:null, bodyweight:true};
  const session = state.sessions.find(s => s.id === state.activeId);
  if (session?.status !== 'active') throw Error('Start a workout first');
  if (exercise.week !== session.week || exercise.day !== session.day) throw Error('Exercise belongs to another workout');
  if (session.sets.some(s => s.id === set.id)) return state;
  if (state.sessions.some(s => s.sets.some(row => row.id === set.id))) throw Error('Set ID already belongs to another workout');
  if (session.sets.filter(s => s.exerciseId === exercise.id).length >= exercise.sets) throw Error('All prescribed sets are logged');
  if (!Number.isInteger(set.reps) || set.reps < 0 || !optionalNumber(set.weight) ||
      !(set.rir === null || nonnegative(set.rir) && set.rir <= 10)) throw Error('Enter valid reps, load and actual RIR');
  validateCardio(set);
  return {...state, sessions: state.sessions.map(s => s.id === session.id ? {...s, sets: [...s.sets, {
    ...set, exerciseId: exercise.id, unit: set.kind === 'cardio' || set.bodyweight ? '' : 'lb', loadSemantics: set.bodyweight ? 'Bodyweight' : exercise.weightText,
    rpe: set.rir === null ? null : 10 - set.rir, rpeSource: set.rir === null ? 'missing' : 'derived',
  }]} : s)};
}
export function finish(state, exercises, increments) {
  const session = state.sessions.find(s => s.id === state.activeId);
  if (!session) throw Error('No active workout');
  if (session.status === 'finished') return state;
  const decisions = {};
  const equipment = {...session.increments, ...increments};
  for (const ex of exercises) {
    const actual = session.sets.filter(s => s.exerciseId === ex.id);
    if (actual.length !== ex.sets) throw Error('Complete every prescribed set before finishing');
    const decision = evaluate({...targetFor(state, ex), increment: equipment[ex.id] || null}, actual);
    const buildReps = decision.action === 'hold' && decision.reason === 'Continue building reps at current load';
    decisions[ex.id] = {...decision, version: RULE_VERSION,
      targetReps: buildReps ? Math.min(ex.maxReps, Math.min(...actual.map(s => s.reps)) + 1) : ex.minReps,
      actualLoads: [...new Set(actual.map(s => s.weight))],
    };
  }
  return {...state, sessions: state.sessions.map(s => s.id === session.id
    ? {...s, status: 'finished', decisions, increments: equipment} : s)};
}
export function approve(state, exercises, reviews = {}) {
  const session = state.sessions.find(s => s.id === state.activeId);
  if (session?.status !== 'finished') throw Error('Finish the workout first');
  const targets = {...state.targets};
  const approvedDecisions = {...session.decisions};
  for (const ex of exercises) {
    const decision = session.decisions[ex.id];
    if (!decision) throw Error('Missing exercise decision');
    const manual = reviews[ex.id];
    if (decision.action === 'review' && !manual) continue;
    const weight = manual ? manual.weight : decision.proposedWeight;
    const targetReps = manual ? manual.targetReps : decision.targetReps ?? ex.minReps;
    if (!nonnegative(weight) || !Number.isInteger(targetReps) || targetReps < ex.minReps || targetReps > ex.maxReps) {
      throw Error('Approved load and reps must be valid and within the program rep range');
    }
    const reason = manual ? `Manually reviewed: ${decision.reason}` : decision.reason;
    targets[ex.id] = {weight, targetReps, approvedAt: new Date().toISOString(), reason,
      version: decision.version, sourceSessionId: session.id};
    approvedDecisions[ex.id] = {...decision, approved: true, approvedWeight: weight, approvedReps: targetReps, manual: !!manual};
  }
  return {...state, targets, activeId: null, selection: {week: session.week, day: session.day},
    sessions: state.sessions.map(s => s.id === session.id ? {...s, decisions: approvedDecisions} : s)};
}

// Finishing is the user's only action. Ambiguous performance holds a known load;
// missing loads stay unknown. Actual records are never rewritten.
export function completeWorkout(state, exercises) {
  if (!state.activeId) return state;
  const finished = finish(state, exercises);
  const session = finished.sessions.find(s => s.id === finished.activeId);
  const targets = {...finished.targets};
  const decisions = {};
  for (const ex of exercises) {
    const decision = session.decisions[ex.id];
    const actual = session.sets.filter(s => s.exerciseId === ex.id);
    const knownLoads = actual.map(s => s.weight).filter(nonnegative);
    const previous = targetFor(state, ex);
    const needsHold = decision.action === 'review';
    const weight = needsHold ? (Number.isFinite(decision.proposedWeight) ? decision.proposedWeight : knownLoads.length ? knownLoads.at(-1) : previous.weight)
      : decision.proposedWeight;
    const goal = needsHold ? Math.max(ex.minReps, Math.min(ex.maxReps, previous.targetReps))
      : decision.targetReps ?? ex.minReps;
    const reason = needsHold
      ? knownLoads.length ? decision.reason
        : 'Keep the previous target; no load was recorded.'
      : decision.reason;
    targets[ex.id] = {weight, targetReps: goal, reason,
      version: 'automatic-progression-v3', sourceSessionId: session.id,
      approvedAt: new Date().toISOString(), automatic: true};
    decisions[ex.id] = {...decision, action: needsHold ? 'hold' : decision.action,
      originalAction: decision.action, proposedWeight: weight, targetReps: goal, reason,
      version: 'automatic-progression-v3', approved: true, automatic: true};
  }
  return {...finished, targets, activeId: null, selection: {week: session.week, day: session.day},
    sessions: finished.sessions.map(s => s.id === session.id ? {...s, decisions} : s)};
}
