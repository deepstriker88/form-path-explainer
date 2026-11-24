import test from 'node:test';import assert from 'node:assert/strict';
import {validateForm,validateJson} from '../src/index.js';
const schema={type:'object',required:['email'],properties:{email:{type:'string',format:'email'},age:{type:'number'},items:{type:'array',items:{type:'boolean'}}}};
test('valid nested form',()=>assert.equal(validateForm({email:'a@b.com',age:4,items:[true]},schema).valid,true));
test('explain paths',()=>{const r=validateForm({email:'bad',age:'four',items:[false,1]},schema);assert.equal(r.valid,false);assert.deepEqual(r.errors.map(x=>x.path),['$.email','$.age','$.items[1]']);});
test('required and malformed',()=>{assert.equal(validateForm({},schema).errors[0].code,'REQUIRED');assert.throws(()=>validateJson('{',JSON.stringify(schema)),SyntaxError);});
test('limits and unsafe keys',()=>{assert.equal(validateForm(JSON.parse('{"__proto__":1}'),{type:'object'}).errors[0].code,'UNSAFE_KEY');assert.equal(validateForm(Array(101).fill(1),{type:'array'}).errors[0].code,'TOO_MANY_ITEMS');assert.throws(()=>validateJson('x'.repeat(1048577),'{}'),RangeError);});

test('reject malformed rules rather than silently accept',()=>{assert.equal(validateForm({}, {type:'object',required:42}).errors[0].code,'INVALID_REQUIRED');assert.equal(validateForm({x:'a'},{type:'object',properties:{x:{type:'string',format:'unknown'}}}).errors[0].code,'UNSUPPORTED_FORMAT');assert.equal(validateForm({}, {type:'object',properties:42}).errors[0].code,'INVALID_PROPERTIES');});

test("error cap on nested arrays",()=>{const s={type:"array",items:{type:"array",items:{type:"string"}}};const v=Array.from({length:100},()=>Array(100).fill(1));const r=validateForm(v,s);assert.equal(r.valid,false);assert.equal(r.errors.length,100);});

test('hostname labels reject empty, edge hyphens and overlong labels',()=>{const s={type:'string',format:'hostname'};for(const h of ['a..b','-a.com','a-.com','a'.repeat(64)+'.com'])assert.equal(validateForm(h,s).errors[0].code,'INVALID_HOSTNAME');assert.equal(validateForm('sub.example.com',s).valid,true);});
test('explicit invalid array item schema must not be ignored',()=>{const r=validateForm([1],{type:'array',items:false});assert.equal(r.valid,false);assert.equal(r.errors[0].code,'INVALID_SCHEMA');});

test('invalid string limits are rejected',()=>{for(const rule of [{minLength:-1},{maxLength:1.5},{minLength:3,maxLength:2}])assert.equal(validateForm('a',{type:'string',...rule}).errors[0].code,'INVALID_LENGTH_RULE');});
test('unsafe schema property rejected even when absent',()=>{const props=JSON.parse('{"__proto__":{"type":"string"}}');assert.equal(validateForm({}, {type:'object',properties:props}).errors[0].code,'UNSAFE_SCHEMA_KEY');});

test('email domain must have valid DNS labels and bounded local part',()=>{const s={type:'string',format:'email'};for(const e of ['a@-.com','a@a..com','a@a-.com','a'.repeat(65)+'@example.com','a@localhost','a@@example.com'])assert.equal(validateForm(e,s).errors[0].code,'INVALID_EMAIL',e);assert.equal(validateForm('alice+tag@example.com',s).valid,true);});

test('invalid empty-array item schemas and unsafe keys are never skipped',()=>{assert.equal(validateForm([],{type:'array',items:false}).errors[0].code,'INVALID_SCHEMA');const props=JSON.parse('{"__proto__":{"type":"string"}}');assert.equal(validateForm(null,{type:'object',properties:props}).errors[0].code,'UNSAFE_SCHEMA_KEY');});
test('email local part rejects leading trailing and repeated dots',()=>{const s={type:'string',format:'email'};for(const e of ['.a@example.com','a.@example.com','a..b@example.com'])assert.equal(validateForm(e,s).errors[0].code,'INVALID_EMAIL');});

test('cyclic input terminates with structured error',()=>{const a={};a.self=a;const s={type:'object',properties:{self:{type:'object',properties:{self:{type:'object'}}}}};assert.equal(validateForm(a,s).errors[0].code,'CYCLIC_VALUE');});
test('shared sibling reference is not a cycle',()=>{const child={x:1};const s={type:'object',properties:{a:{type:'object'},b:{type:'object'}}};assert.equal(validateForm({a:child,b:child},s).valid,true);});
test('bounded schema fields and duplicate required',()=>{const props=Object.fromEntries(Array.from({length:101},(_,i)=>['k'+i,{type:'string'}]));assert.equal(validateForm({},{type:'object',properties:props}).errors[0].code,'TOO_MANY_SCHEMA_FIELDS');assert.equal(validateForm({},{type:'object',required:['a','a']}).errors[0].code,'DUPLICATE_REQUIRED');});

test('global error cap holds when last string violates length and format',()=>{const s={type:'array',items:{type:'string',maxLength:1,format:'email'}};const r=validateForm(Array(100).fill('bad'),s);assert.equal(r.errors.length,100);});

test('unsafe input keys respect global error cap',()=>{const v=JSON.parse('{'+Array.from({length:100},(_,i)=>'"k'+i+'":0').join(',')+'}');const s={type:'object',required:Array.from({length:100},(_,i)=>'missing'+i)};const r=validateForm(v,s);assert.equal(r.errors.length,100);});
test('required keys must be nonempty strings',()=>{for(const required of [[''],[42],[null]])assert.equal(validateForm({},{type:'object',required}).errors[0].code,'INVALID_REQUIRED_KEY');});
test('email local rejects invalid punctuation and accepts plus addressing',()=>{const s={type:'string',format:'email'};for(const e of ['a,b@example.com','a(b)@example.com','a:b@example.com'])assert.equal(validateForm(e,s).errors[0].code,'INVALID_EMAIL',e);assert.equal(validateForm('a+b@example.com',s).valid,true);});


test('accessor input is rejected without invoking getter', () => {
 let calls=0;const input={};Object.defineProperty(input,'name',{enumerable:true,get(){calls++;throw Error('should not execute')}});
 const result=validateForm(input,{type:'object',properties:{name:{type:'string'}}});
 assert.equal(calls,0);assert.equal(result.valid,false);assert.equal(result.errors[0].code,'ACCESSOR_PROPERTY');
});

test('array getter is rejected without execution',()=>{let calls=0;const a=[1];Object.defineProperty(a,'0',{get(){calls++;throw Error('executed')}});const r=validateForm(a,{type:'array',items:{type:'number'}});assert.equal(calls,0);assert.equal(r.errors[0].code,'ACCESSOR_PROPERTY');});
test('sparse array elements validate as undefined',()=>{const r=validateForm(new Array(1),{type:'array',items:{type:'number'}});assert.equal(r.errors[0].code,'TYPE_MISMATCH');});

test('unmapped object getter is rejected without execution',()=>{let calls=0;const input={};Object.defineProperty(input,'secret',{enumerable:true,get(){calls++;throw Error('executed')}});const r=validateForm(input,{type:'object'});assert.equal(calls,0);assert.equal(r.errors[0].code,'ACCESSOR_PROPERTY');});
test('early-return ancestors cleanup preserves sibling validation',()=>{const shared=Object.fromEntries(Array.from({length:101},(_,i)=>['k'+i,i]));const s={type:'object',properties:{a:{type:'object'},b:{type:'object'}}};const r=validateForm({a:shared,b:shared},s);assert.deepEqual(r.errors.map(x=>x.code),['TOO_MANY_FIELDS','TOO_MANY_FIELDS']);});

test('schema getter is rejected without execution',()=>{let calls=0;const s={type:'object',properties:{}};Object.defineProperty(s.properties,'secret',{enumerable:true,get(){calls++;throw Error('executed')}});const r=validateForm({},s);assert.equal(calls,0);assert.equal(r.errors[0].code,'SCHEMA_ACCESSOR');});
test('schema rule accessor is rejected without execution',()=>{let calls=0;const s={type:'string'};Object.defineProperty(s,'minLength',{enumerable:true,get(){calls++;throw Error('executed')}});const r=validateForm('x',s);assert.equal(calls,0);assert.equal(r.errors[0].code,'SCHEMA_ACCESSOR');});
test('cyclic schema is rejected',()=>{const s={type:'array'};s.items=s;assert.equal(validateForm([],s).errors[0].code,'CYCLIC_SCHEMA');});
test('shared sibling schemas remain valid',()=>{const child={type:'string'};const s={type:'object',properties:{a:child,b:child}};assert.equal(validateForm({a:'x',b:'y'},s).valid,true);});

test('required array getter cannot execute',()=>{let calls=0;const required=['x'];Object.defineProperty(required,'0',{get(){calls++;throw Error('executed')}});const r=validateForm({}, {type:'object',required});assert.equal(calls,0);assert.equal(r.errors[0].code,'SCHEMA_ACCESSOR');});

test('sparse required schema entries are rejected rather than silently skipped',()=>{const required=new Array(1);const r=validateForm({}, {type:'object',required});assert.equal(r.valid,false);assert.equal(r.errors[0].code,'SCHEMA_ACCESSOR');});

test('nonenumerable schema accessor never executes',()=>{let calls=0;const s={type:'string'};Object.defineProperty(s,'format',{get(){calls++;throw Error('executed')}});const r=validateForm('x',s);assert.equal(calls,0);assert.equal(r.errors[0].code,'SCHEMA_ACCESSOR');});
test('inherited schema getter never executes',()=>{let calls=0;const proto={};Object.defineProperty(proto,'format',{get(){calls++;throw Error('executed')}});const s=Object.assign(Object.create(proto),{type:'string'});const r=validateForm('x',s);assert.equal(calls,0);assert.equal(r.errors[0].code,'INVALID_SCHEMA');});
test('nonenumerable property schema accessor never executes',()=>{let calls=0;const props={};Object.defineProperty(props,'x',{get(){calls++;throw Error('executed')}});const r=validateForm({x:'x'},{type:'object',properties:props});assert.equal(calls,0);assert.equal(r.errors[0].code,'SCHEMA_ACCESSOR');});


test('number range constraints enforce boundaries',()=>{const s={type:'number',minimum:0,maximum:10};assert.equal(validateForm(0,s).valid,true);assert.equal(validateForm(10,s).valid,true);assert.equal(validateForm(-1,s).errors[0].code,'BELOW_MINIMUM');assert.equal(validateForm(11,s).errors[0].code,'ABOVE_MAXIMUM');});
test('invalid number rules fail closed',()=>{for(const rule of [{minimum:NaN},{maximum:Infinity},{minimum:2,maximum:1},{minimum:'1'}])assert.equal(validateForm(1,{type:'number',...rule}).errors[0].code,'INVALID_NUMBER_RULE');});
test('array cardinality rules enforce boundaries',()=>{const s={type:'array',minItems:1,maxItems:2,items:{type:'number'}};assert.equal(validateForm([1],s).valid,true);assert.equal(validateForm([1,2],s).valid,true);assert.equal(validateForm([],s).errors[0].code,'TOO_FEW_ITEMS');assert.equal(validateForm([1,2,3],s).errors[0].code,'TOO_MANY_ITEMS_RULE');});
test('invalid array cardinality fails closed',()=>{for(const rule of [{minItems:-1},{maxItems:1.5},{minItems:3,maxItems:2}])assert.equal(validateForm([],{type:'array',...rule}).errors[0].code,'INVALID_ITEMS_RULE');});
test('enum enforces exact primitive membership',()=>{const s={type:'string',enum:['red','blue']};assert.equal(validateForm('red',s).valid,true);assert.equal(validateForm('green',s).errors[0].code,'NOT_IN_ENUM');assert.equal(validateForm(1,{type:'number',enum:[1,2]}).valid,true);assert.equal(validateForm(true,{type:'boolean',enum:[false]}).errors[0].code,'NOT_IN_ENUM');});
test('malformed enum fails closed',()=>{for(const entries of [[],[{}],[NaN],Array(101).fill('x')])assert.equal(validateForm('x',{type:'string',enum:entries}).errors[0].code,'INVALID_ENUM');});

test('enum getter and sparse slots are never evaluated',()=>{let calls=0;const entries=['ok'];Object.defineProperty(entries,'0',{get(){calls++;throw Error('executed')}});assert.equal(validateForm('ok',{type:'string',enum:entries}).errors[0].code,'SCHEMA_ACCESSOR');assert.equal(calls,0);assert.equal(validateForm('ok',{type:'string',enum:new Array(1)}).errors[0].code,'SCHEMA_ACCESSOR');});

test('integer rejects fractional and unsafe values',()=>{const s={type:'integer',minimum:0,maximum:10};assert.equal(validateForm(5,s).valid,true);for(const x of [5.1,Number.MAX_SAFE_INTEGER+1,NaN])assert.equal(validateForm(x,s).errors[0].code,'TYPE_MISMATCH');assert.equal(validateForm(-1,s).errors[0].code,'BELOW_MINIMUM');});
test('closed objects reject unknown fields with paths',()=>{const s={type:'object',additionalProperties:false,properties:{name:{type:'string'}}};assert.equal(validateForm({name:'x'},s).valid,true);assert.deepEqual(validateForm({name:'x',extra:1},s).errors.map(e=>[e.path,e.code]),[['$.extra','ADDITIONAL_PROPERTY']]);});
test('open objects allow extra fields by default',()=>assert.equal(validateForm({extra:1},{type:'object'}).valid,true));
test('additionalProperties only accepts booleans',()=>{for(const x of [0,null,'false',{}])assert.equal(validateForm({}, {type:'object',additionalProperties:x}).errors[0].code,'INVALID_ADDITIONAL_PROPERTIES');});
