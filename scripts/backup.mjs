import {backup} from '../lib/backup.mjs';import {db} from '../lib/db.mjs';
try{console.log(await backup());}finally{await db().end();}
