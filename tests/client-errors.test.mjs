import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../web/source.html',import.meta.url),'utf8');
const start=source.indexOf('/* Attribution uses the throw site');assert(start>=0);
const end=source.indexOf('window.addEventListener("DOMContentLoaded"',start);assert(end>start);
const context={window:{}};vm.createContext(context);vm.runInContext(source.slice(start,end),context);const {isExtension}=context.window.StudentClientErrors;
test('extension attribution uses first throw site and never hides app or unknown M_ID errors',()=>{
 assert(isExtension({filename:'chrome-extension://id/executors/200.js'}));
 assert(isExtension({reason:{stack:"TypeError: M_ID\n    at Y (chrome-extension://id/executors/200.js:1:761)\n    at https://student.test/assets/app-1.js:4:2"}}));
 assert(isExtension({reason:{stack:'TypeError\n Y@safari-web-extension://id/exec.js:1:2'}}));
 assert(!isExtension({filename:'https://student.test/assets/app-1.js',error:{stack:'Error\n at chrome-extension://id/file.js:1:2'}}));
 assert(!isExtension({reason:{stack:'TypeError: M_ID\n at f (https://student.test/assets/app-1.js:1:2)\n at chrome-extension://id/file.js:3:4'}}));
 assert(!isExtension({reason:{message:"Cannot read properties of undefined (reading 'M_ID')"}}));
});
