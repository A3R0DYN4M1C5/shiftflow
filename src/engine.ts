export interface Break { id:string; start:string; duration:number; productivity:number }
export interface Config { date:string; start:string; end:string; goal:number; uph:number; headcount:number; normal:number; safety:number; breaks:Break[] }
export interface Interval { id:string; start:number; end:number; effective:number; capacity:number; target:number; cumulative:number; breaks:string[]; staffing:number }
export const minutes=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3));
export const duration=(c:Config)=>(minutes(c.end)-minutes(c.start)+1440)%1440;
export const offset=(s:string,c:Config)=>(minutes(s)-minutes(c.start)+1440)%1440;
export function validate(c:Config):Record<string,string> {
 const e:Record<string,string>={};
 for(const k of ['goal','headcount'] as const) if(!Number.isSafeInteger(c[k])||c[k]<=0)e[k]='Enter a positive whole number.';
 if(!Number.isFinite(c.uph)||c.uph<=0)e.uph='UPH must be greater than zero.';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(c.date)||!Number.isFinite(Date.parse(c.date)))e.date='Choose a valid shift date.';
 for(const k of ['start','end'] as const)if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(c[k]))e[k]='Choose a valid time.';
 if(!Number.isFinite(c.safety)||c.safety<=0||c.safety>24)e.safety='Safety limit must be greater than 0 and at most 24 hours.';
 if(!e.start&&!e.end&&(!duration(c)||duration(c)>c.safety*60))e.end=`Shift must be longer than zero and no more than ${c.safety} hours.`;
 if(!Number.isFinite(c.normal)||c.normal<0||c.normal>100)e.normal='Productivity must be between 0 and 100%.';
 const sorted=[...c.breaks].sort((a,b)=>offset(a.start,c)-offset(b.start,c));
 sorted.forEach((b,i)=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.start)||!Number.isInteger(b.duration)||b.duration<=0||offset(b.start,c)+b.duration>duration(c)||!Number.isFinite(b.productivity)||b.productivity<0||b.productivity>100)e[b.id]='Break must fit inside the shift, have a positive whole-minute duration and 0–100% productivity.';if(i&&offset(sorted[i-1].start,c)+sorted[i-1].duration>offset(b.start,c))e[b.id]='Breaks overlap. Adjust the start time or duration.';});return e;
}
export function plan(c:Config) {
 if(Object.keys(validate(c)).length)throw Error('Invalid shift configuration');
 const rows:Interval[]=[];
 for(let start=0;start<duration(c);start+=60){const end=Math.min(start+60,duration(c));let effective=(end-start)*c.normal/6000;const breaks:string[]=[];
 for(const b of c.breaks){const overlap=Math.max(0,Math.min(end,offset(b.start,c)+b.duration)-Math.max(start,offset(b.start,c)));if(overlap){effective+=overlap*(b.productivity-c.normal)/6000;breaks.push(`${overlap}m · ${b.productivity}%`);}}
 effective=Math.max(0,effective);rows.push({id:`${c.date}:${c.start}:${start}`,start,end,effective,capacity:c.headcount*c.uph*effective,target:0,cumulative:0,breaks,staffing:0});}
 const capacity=rows.reduce((s,r)=>s+r.capacity,0), effective=rows.reduce((s,r)=>s+r.effective,0);
 const integerCapacity=rows.reduce((s,r)=>s+Math.floor(r.capacity+1e-9),0),allocated=Math.min(c.goal,integerCapacity);
 const exact=rows.map(r=>capacity?allocated*r.capacity/capacity:0);
 rows.forEach((r,i)=>r.target=Math.min(Math.floor(exact[i]),Math.floor(r.capacity+1e-9)));
 let left=allocated-rows.reduce((s,r)=>s+r.target,0);
 const order=rows.map((_,i)=>i).sort((a,b)=>(exact[b]%1-exact[a]%1)||a-b);
 while(left>0){let changed=false;for(const i of order)if(left&&rows[i].target<Math.floor(rows[i].capacity+1e-9)){rows[i].target++;left--;changed=true;}if(!changed)break;}
 let cumulative=0;rows.forEach(r=>{r.cumulative=cumulative+=r.target;r.staffing=r.effective?Math.ceil(r.target/(c.uph*r.effective)-1e-10):0;});
 return {rows,capacity,integerCapacity,effective,allocated,shortfall:c.goal-allocated,feasible:allocated===c.goal,required:effective?Math.ceil(c.goal/(c.uph*effective)-1e-10):Infinity,extraLabor:Math.max(0,(c.goal-capacity)/c.uph)};
}
export type Actuals=Record<string,number>;
export function track(c:Config,p:ReturnType<typeof plan>,a:Actuals){
 const valid=(r:Interval)=>Number.isSafeInteger(a[r.id])&&a[r.id]>=0;
 let prefix=0;while(prefix<p.rows.length&&valid(p.rows[prefix]))prefix++;
 const done=p.rows.filter(valid),remaining=p.rows.filter(r=>!valid(r));
 const actual=done.reduce((s,r)=>s+a[r.id],0),matched=p.rows.slice(0,prefix).reduce((s,r)=>s+a[r.id],0),matchedPlan=prefix?p.rows[prefix-1].cumulative:0;
 const remainingCapacity=remaining.reduce((s,r)=>s+r.capacity,0),remainingHours=remaining.reduce((s,r)=>s+r.effective,0),remainingVolume=Math.max(0,c.goal-actual);
 const completedTargets=done.reduce((s,r)=>s+r.target,0);
 return {actual,prefix,matched,matchedPlan,variance:matched-matchedPlan,gap:done.length>prefix,remainingCapacity,remainingHours,remainingVolume,recoverable:actual+remainingCapacity>=c.goal,required:remainingVolume===0?0:remainingHours?Math.ceil(remainingVolume/(c.uph*remainingHours)):Infinity,rate:remainingVolume===0?0:remainingHours?remainingVolume/remainingHours:Infinity,forecast:completedTargets>0?actual+actual/completedTargets*remaining.reduce((s,r)=>s+r.target,0):null,complete:remaining.length===0};
}
export const sample:Config={date:new Date().toLocaleDateString('en-CA'),start:'07:00',end:'15:30',goal:24000,uph:180,headcount:20,normal:100,safety:16,breaks:[{id:'b1',start:'09:15',duration:15,productivity:0},{id:'b2',start:'11:30',duration:30,productivity:0},{id:'b3',start:'14:00',duration:15,productivity:0}]};
export function time(c:Config,m:number,format='24'){const t=(minutes(c.start)+m)%1440,h=Math.floor(t/60),mm=String(t%60).padStart(2,'0');return format==='12'?`${h%12||12}:${mm} ${h<12?'AM':'PM'}`:`${String(h).padStart(2,'0')}:${mm}`;}
