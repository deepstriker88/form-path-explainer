import {createValidator} from './index.js';

// Bounded, dependency-free JSON Lines validation for Node.js and Web Streams.
// Each yielded record contains only index, line number, validity and errors.
export async function* validateJsonlStream(chunks, schema, options = {}) {
  const {maxRecords = 10000, maxLineBytes = 1048576, skipBlank = true} = options;
  if (!Number.isSafeInteger(maxRecords) || maxRecords < 1 || maxRecords > 100000)
    throw new RangeError('invalid maxRecords');
  if (!Number.isSafeInteger(maxLineBytes) || maxLineBytes < 1 || maxLineBytes > 1048576)
    throw new RangeError('invalid maxLineBytes');
  if (!chunks || typeof chunks[Symbol.asyncIterator] !== 'function')
    throw new TypeError('chunks must be an async iterable');
  const validate = createValidator(schema);
  const decoder = new TextDecoder('utf-8', {fatal:true, ignoreBOM:false});
  const encoder = new TextEncoder();
  let pending = '', lineNumber = 0, count = 0, bytes = 0;
  const parseLine = (raw, line) => {
    const content = raw.endsWith('\r') ? raw.slice(0,-1) : raw;
    if (encoder.encode(content).byteLength > maxLineBytes) throw new RangeError('line exceeds maxLineBytes');
    if (!content.trim() && skipBlank) return null;
    if (++count > maxRecords) throw new RangeError('record count exceeds maxRecords');
    let result;
    try { result = validate(JSON.parse(content)); }
    catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      result = {valid:false, errors:[{path:'$',pointer:'',code:'INVALID_JSON'}]};
    }
    return {index:count-1,line, ...result};
  };
  // Decode all chunks through one strict UTF-8 decoder, including mixed string/byte inputs.
  // Scan by segments rather than concatenating one character at a time.
  const append = (segment) => {
    if (!segment) return;
    bytes += encoder.encode(segment).byteLength;
    if (bytes > maxLineBytes + 1) throw new RangeError('line exceeds maxLineBytes');
    pending += segment;
  };
  const scan = function* (text) {
    let start = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== '\n') continue;
      append(text.slice(start, i));
      lineNumber++;
      const record = parseLine(pending, lineNumber);
      if (record) yield record;
      pending = ''; bytes = 0;
      start = i + 1;
    }
    append(text.slice(start));
  };
  for await (const chunk of chunks) {
    if (!(typeof chunk === 'string' || chunk instanceof Uint8Array))
      throw new TypeError('chunk must be a string or Uint8Array');
    const input = typeof chunk === 'string' ? encoder.encode(chunk) : chunk;
    yield* scan(decoder.decode(input, {stream:true}));
  }
  yield* scan(decoder.decode());
  if (pending.length) {
    lineNumber++;
    const record = parseLine(pending, lineNumber);
    if (record) yield record;
  }
}
