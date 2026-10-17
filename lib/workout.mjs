import {evaluate} from './progression-core.mjs';
export const KEY='awt-v1';
export function empty(){return {version:1,sessions:[],targets:{},activeId:null};}
export function read(storage){const raw=storage.getItem(KEY);if(!raw)return empty();const s=JSON.parse(raw);if(s.version!==1||!Array.isArray(s.sessions)||!s.targets)throw Error('Unrecognized backup; existing data preserved');return s;}
export function save(storage,state){storage.setItem(KEY,JSON.stringify(state));}
export function start(state,week,day,id,date){return {...state,activeId:id,sessions:[...state.sessions,{id,week,day,date,status:'active',sets:[],decisions:{}}]};}
export function targetFor(state,ex){return {...ex,...state.targets[ex.id]};}
export function record(state,exercise,set){
 const session=state.sessions.find(s=>s.id===state.activeId);if(!session||session.status!=='active')throw Error('Start a workout first');
 if(session.sets.some(s=>s.id===set.id))return state;
 if(session.sets.filter(s=>s.exerciseId===exercise.id).length>=exercise.sets)throw Error('All prescribed sets are logged');
 if(!Number.isInteger(set.reps)||set.reps<0||!Number.isFinite(set.rir)||set.rir<0||set.rir>10||set.weight!==null&&(!Number.isFinite(set.weight)||set.weight<0))throw Error('Enter valid reps, load and actual RIR');
 return {...state,sessions:state.sessions.map(s=>s.id===session.id?{...s,sets:[...s.sets,{...set,exerciseId:exercise.id}]}:s)};
}
export function finish(state,exercises,increments){
 const session=state.sessions.find(s=>s.id===state.activeId);if(!session)throw Error('No active workout');if(session.status==='finished')return state;
 const decisions={};
 for(const ex of exercises){const actual=session.sets.filter(s=>s.exerciseId===ex.id);if(actual.length!==ex.sets)throw Error('Complete every prescribed set before finishing');decisions[ex.id]={...evaluate({...targetFor(state,ex),increment:increments[ex.id]||null},actual),version:'double-progression-v1'};}
 return {...state,sessions:state.sessions.map(s=>s.id===session.id?{...s,status:'finished',decisions}:s)};
}
export function approve(state,exercises){
 const session=state.sessions.find(s=>s.id===state.activeId);if(session?.status!=='finished')throw Error('Finish the workout first');
 const targets={...state.targets};for(const ex of exercises){const d=session.decisions[ex.id];if(d.action==='review')continue;targets[ex.id]={weight:d.proposedWeight,minReps:d.action!=='hold'||d.reason!=='Continue building reps at current load'?ex.minReps:Math.min(ex.maxReps,Math.min(...session.sets.filter(s=>s.exerciseId===ex.id).map(s=>s.reps))+1),maxReps:ex.maxReps,approvedAt:new Date().toISOString(),reason:d.reason};}
 return {...state,targets,activeId:null};
}
