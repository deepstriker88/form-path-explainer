import test from 'node:test';
import assert from 'node:assert/strict';
import {strictJson,locateJsonPointers} from '../src/strict-json.js';
test('target-only locations preserve original CRLF, escaped keys, arrays and UTF-16 offsets',()=>{
 const text=' {\r\n "a/b": [{"~x": "한😀글"}, {"z":0}],\r "empty":{}\n}';
 const targets=['','/a~1b/0/~0x','/a~1b/1/z','/empty','/missing'];
 const locations=locateJsonPointers(text,targets);
 assert.deepEqual(locations.get(''),{line:1,column:2,offset:1});
 assert.equal(locations.get('/a~1b/0/~0x').offset,text.indexOf('"한😀글"'));
 assert.equal(locations.get('/a~1b/1/z').offset,text.indexOf('0}'));
 assert.equal(locations.get('/empty').line,3);
 assert.equal(locations.has('/missing'),false);
 assert.deepEqual(strictJson(text),JSON.parse(text));
});
test('reject invalid or ambiguous JSON and invalid pointer inputs',()=>{
 for(const text of ['{"a":1,"\\u0061":2}','{"a":}','[1,]','{"a":1e999}'])assert.throws(()=>locateJsonPointers(text,['/a']));
 for(const pointers of [['bad'],['/~2'],Array(101).fill('')])assert.throws(()=>locateJsonPointers('{"a":1}',pointers));
});
test('max depth and node budget remain enforced in location scan',()=>{
 assert.throws(()=>locateJsonPointers('[[0]]',['/0/0'],{maxDepth:1}),RangeError);
 assert.throws(()=>locateJsonPointers('[1,2]',['/1'],{maxNodes:2}),RangeError);
});
