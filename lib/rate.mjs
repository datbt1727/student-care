import {db} from './db.mjs';
import {fail} from './security.mjs';
// A fixed window: blocked attempts increase the counter but never move its expiry.
export async function rate(bucket,max,seconds){
 const r=await db().query("INSERT INTO sc_rate(bucket,n,until_at) VALUES($1,1,now()+$2*interval '1 second') ON CONFLICT(bucket) DO UPDATE SET n=CASE WHEN sc_rate.until_at<=now() THEN 1 ELSE LEAST(sc_rate.n::bigint+1,2147483647)::integer END,until_at=CASE WHEN sc_rate.until_at<=now() THEN now()+$2*interval '1 second' ELSE sc_rate.until_at END RETURNING n,GREATEST(1,CEIL(EXTRACT(EPOCH FROM (until_at-now()))))::integer AS retry_after",[bucket,seconds]);
 if(r.rows[0].n>max){const retryAfter=Number(r.rows[0].retry_after)||seconds;throw Object.assign(fail('Tạm giới hạn số lần thử. Vui lòng chờ '+Math.ceil(retryAfter/60)+' phút rồi thử lại.',429),{retryAfter})}
}
