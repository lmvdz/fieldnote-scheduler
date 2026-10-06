export function database(env){if(!env.DB)throw Error('Storage is temporarily unavailable. Your form is still on screen.');const db=env.DB;return {one:(sql,...args)=>db.prepare(sql).bind(...args).first(),all:async(sql,...args)=>(await db.prepare(sql).bind(...args).all()).results,run:(sql,...args)=>db.prepare(sql).bind(...args).run(),batch:queries=>db.batch(queries.map(([sql,...args])=>db.prepare(sql).bind(...args)))};}
export async function load(db,id){const row=await db.one('SELECT state,revision FROM sessions WHERE id=?',id);if(!row)return null;return JSON.parse(row.state);}
export async function save(db,id,before,after){const result=await db.run('UPDATE sessions SET state=?,revision=?,updated=? WHERE id=? AND revision=?',JSON.stringify(after),after.version,Date.now(),id,before.version);if(result.meta.changes!==1)throw Error('This request changed in another tab. Refresh and review the latest version.');return after;}
export async function reserve(db,id,slot){const now=Date.now();await db.run("INSERT INTO slots(slot,session,state,expires) VALUES(?,?,'held',?) ON CONFLICT(slot) DO UPDATE SET session=excluded.session,state='held',expires=excluded.expires WHERE slots.expires<? OR (slots.session=excluded.session AND slots.state='held')",slot,id,now+15*60*1000,now);const row=await db.one('SELECT * FROM slots WHERE slot=?',slot);if(row?.session!==id||row.state!=='held')throw Error('That slot was just taken. Choose another time and approve again.');}
export async function approveAndReserve(db,id,before,after){
 const now=Date.now(),expires=now+15*60*1000;
 // Reservation and revision change share one transaction. A stale contender cannot
 // acquire or release the successful approval's hold.
 const current="EXISTS (SELECT 1 FROM sessions WHERE id=? AND revision=?)";
 const result=await db.batch([
 ["INSERT INTO slots(slot,session,state,expires) SELECT ?,?,'held',? WHERE "+current+" ON CONFLICT(slot) DO UPDATE SET session=excluded.session,state='held',expires=excluded.expires WHERE (slots.expires<? OR (slots.session=excluded.session AND slots.state='held')) AND "+current,after.slot,id,expires,id,before.version,now,id,before.version],
 ["UPDATE sessions SET state=?,revision=?,updated=? WHERE id=? AND revision=? AND EXISTS (SELECT 1 FROM slots WHERE slot=? AND session=? AND state='held' AND expires>?)",JSON.stringify(after),after.version,now,id,before.version,after.slot,id,now]
 ]);
 if(result[1].meta.changes!==1){const slot=await db.one('SELECT * FROM slots WHERE slot=?',after.slot);if(slot?.session!==id)throw Error('That slot was just taken. Choose another time and approve again.');throw Error('This request changed in another tab. Refresh and review the latest version.');}
 return load(db,id);
}
export async function release(db,id){await db.run("DELETE FROM slots WHERE session=? AND state='held'",id);}
export async function saveAndRelease(db,id,before,after,{cancelOrder=false,cancelBooked=false}={}){
 const encoded=JSON.stringify(after),gate="EXISTS (SELECT 1 FROM sessions WHERE id=? AND revision=? AND state=?)";
 const queries=[
 ['UPDATE sessions SET state=?,revision=?,updated=? WHERE id=? AND revision=?',encoded,after.version,Date.now(),id,before.version],
 ["DELETE FROM slots WHERE session=? AND (state='held' OR (?=1 AND slot=?)) AND "+gate,id,cancelBooked?1:0,before.slot||'',id,after.version,encoded]
 ];
 if(cancelOrder&&before.order)queries.push(["UPDATE orders SET status='cancelled' WHERE id=? AND session=? AND "+gate,before.order.id,id,id,after.version,encoded]);
 const result=await db.batch(queries);
 if(result[0].meta.changes!==1)throw Error('This request changed in another tab. Refresh and review the latest version.');
 return after;
}
export async function beginCapture(db,id,before){
 const now=Date.now(),after={...before,version:before.version+1,stage:'capturing'},encoded=JSON.stringify(after);
 // Claim the still-valid hold and extend it in the same transaction as the state change.
 // A competing session that took an expired slot prevents all provider side effects.
 const result=await db.batch([
 ["UPDATE sessions SET state=?,revision=?,updated=? WHERE id=? AND revision=? AND EXISTS (SELECT 1 FROM slots WHERE slot=? AND session=? AND state='held' AND expires>?)",encoded,after.version,now,id,before.version,before.slot,id,now],
 ["UPDATE slots SET expires=? WHERE slot=? AND session=? AND state='held' AND EXISTS (SELECT 1 FROM sessions WHERE id=? AND revision=? AND state=?)",8640000000000000,before.slot,id,id,after.version,encoded]
 ]);
 if(result[0].meta.changes!==1||result[1].meta.changes!==1)throw Error('Your slot hold expired or this request changed. Refresh and reconcile before continuing.');
 return after;
}
