import test from 'node:test';
import assert from 'node:assert/strict';
import {latestHistory,normalizeHistoryRecord} from '../lib/session-details.mjs';
test('history dates normalize without crashing render',()=>{
 assert.equal(normalizeHistoryRecord({date:46269}).date,'2026-09-04');
 assert.equal(latestHistory([{date:46269},{date:'2026-11-26'},{date:'bad'},null]).date,'2026-11-26');
 assert.equal(latestHistory([{date:null},{}]),undefined);
});
