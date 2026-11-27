import test from 'node:test';
import assert from 'node:assert/strict';
import {latestHistory,normalizeHistoryRecord,normalizeHistoryDate} from '../lib/session-details.mjs';
test('history dates normalize without crashing render',()=>{
 assert.equal(normalizeHistoryRecord({date:46269}).date,'2026-09-04');
 assert.equal(latestHistory([{date:46269},{date:'2026-11-26'},{date:'bad'},null]).date,'2026-11-26');
 assert.equal(latestHistory([{date:null},{}]),undefined);
});

test('history accepts supported date formats and rejects impossible dates',()=>{
 for(const value of [46269,46269.5,'2026-09-04','9/4/2026','2026-09-04T12:30:00Z']) assert.equal(normalizeHistoryDate(value),'2026-09-04');
 for(const value of [null,{},true,Infinity,0,'2026-02-30','2/30/2026','bad']) assert.equal(normalizeHistoryDate(value),null);
});
