#!/usr/bin/env node
import {openSync,fstatSync,readSync,closeSync,constants} from 'node:fs';
import {compareFormFixtures} from '../src/regression.js';
function read(path){
 const fd=openSync(path,constants.O_RDONLY|(constants.O_NONBLOCK??0));
 try{
  const limit=1048576,s=fstatSync(fd);
  if(!s.isFile()||s.size>limit)throw Error('file limit');
  const b=Buffer.alloc(limit+1);let n=0;
  while(n<b.length){const r=readSync(fd,b,n,b.length-n,null);if(!r)break;n+=r;}
  if(n>limit)throw Error('file limit');
  return new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(0,n));
 }finally{closeSync(fd);}
}
try{
 const args=process.argv.slice(2);
 if(args.length===1&&['-h','--help'].includes(args[0])){
  process.stdout.write('Usage: form-path-regression BEFORE.json AFTER.json FIXTURES.json\nExit 0: no changed acceptance; 1: changed acceptance; 2: invalid or indeterminate input.\n');
 }else{
  if(args.length!==3||args.some(x=>x.startsWith('-')))throw Error('invalid arguments');
  const report=compareFormFixtures(read(args[2]),read(args[0]),read(args[1]));
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  process.exitCode=!report.comparable?2:report.hasNewRejections||report.hasNewAcceptances?1:0;
 }
}catch{process.stderr.write('Form regression: invalid input, unreadable file, or policy limit exceeded\n');process.exitCode=2;}
