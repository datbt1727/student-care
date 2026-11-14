// Per-instance bounded concurrency. Never logs task arguments or stores them after completion.
export function createWorkQueue({concurrency=2,maxWaiting=12,timeoutMs=8000}={}){
 let active=0;const waiting=[];
 const busy=()=>Object.assign(new Error('Đang có nhiều yêu cầu xác thực. Vui lòng thử lại sau ít giây.'),{status:429,retryAfter:5});
 const start=item=>{clearTimeout(item.timer);active++;Promise.resolve().then(item.fn).then(item.resolve,item.reject).finally(()=>{active--;const next=waiting.shift();if(next)start(next);});};
 return fn=>new Promise((resolve,reject)=>{const item={fn,resolve,reject};if(active<concurrency){start(item);return;}if(waiting.length>=maxWaiting){reject(busy());return;}item.timer=setTimeout(()=>{const i=waiting.indexOf(item);if(i>=0){waiting.splice(i,1);reject(busy());}},timeoutMs);waiting.push(item);});
}
