import {describe,it,expect} from 'vitest';
import {sample,plan,track,validate,duration,type Config} from './engine';
const config=(changes:Partial<Config>={}):Config=>({...sample,breaks:[],...changes});
describe('capacity and scheduling',()=>{
 it('computes normal and partial hours',()=>{const p=plan(config());expect(p.capacity).toBe(30600);expect(p.rows.at(-1)?.capacity).toBe(1800);});
 it('handles breaks and reduced productivity precisely',()=>{const p=plan(config({start:'07:00',end:'09:00',breaks:[{id:'a',start:'07:50',duration:30,productivity:50}]}));expect(p.effective).toBeCloseTo(1.75);expect(p.rows[0].effective).toBeCloseTo(55/60);expect(p.rows[1].effective).toBeCloseTo(50/60);});
 it('supports overnight breaks',()=>{const c=config({start:'22:30',end:'06:00',breaks:[{id:'a',start:'23:50',duration:30,productivity:0}]});expect(duration(c)).toBe(450);expect(plan(c).effective).toBe(7);});
 it('rejects overlapping and out-of-bounds breaks',()=>{expect(validate(config({breaks:[{id:'a',start:'08:00',duration:30,productivity:0},{id:'b',start:'08:15',duration:30,productivity:0}]})).b).toBeTruthy();expect(validate(config({breaks:[{id:'a',start:'15:20',duration:30,productivity:0}]})).a).toBeTruthy();});
 it('rejects zero durations, invalid inputs and safety excess',()=>{expect(validate(config({start:'07:00',end:'07:00'})).end).toBeTruthy();expect(validate(config({uph:0,headcount:-1,goal:0,normal:101,safety:1}))).toHaveProperty('uph');});
 it('uses explicit wall-clock semantics across DST dates',()=>{for(const date of ['2026-03-08','2026-11-01'])expect(plan(config({date,start:'00:00',end:'04:00'})).effective).toBe(4);});
});
describe('allocation and feasibility',()=>{
 it('preserves goals and interval limits deterministically',()=>{for(let goal=1;goal<40000;goal+=137){const c=config({goal,breaks:sample.breaks}),p=plan(c);expect(p.rows.reduce((s,r)=>s+r.target,0)).toBe(p.allocated);expect(p.allocated).toBe(Math.min(goal,p.integerCapacity));for(const r of p.rows)expect(r.target).toBeLessThanOrEqual(r.capacity+1e-9);expect(plan(c).rows).toEqual(p.rows);}});
 it('handles exact capacity and infeasible staffing',()=>{expect(plan(config({goal:30600})).feasible).toBe(true);const p=plan(config({goal:40000}));expect(p.required).toBeGreaterThan(20);expect(p.shortfall).toBe(9400);});
 it('discloses integer capacity shortfall',()=>{const p=plan(config({start:'07:00',end:'09:00',uph:.6,headcount:1,goal:1}));expect(p.capacity).toBe(1.2);expect(p.shortfall).toBe(1);});
 it('handles no productive capacity',()=>{const p=plan(config({normal:0}));expect(p.allocated).toBe(0);expect(p.required).toBe(Infinity);});
});
describe('tracking and forecasts',()=>{
 const c=config(),p=plan(c),ids=p.rows.map(r=>r.id);
 it('distinguishes missing from zero',()=>{expect(track(c,p,{}).forecast).toBeNull();expect(track(c,p,{[ids[0]]:0}).prefix).toBe(1);});
 it('compares matching periods and warns for gaps',()=>{const t=track(c,p,{[ids[0]]:p.rows[0].target+100,[ids[2]]:500});expect(t.variance).toBe(100);expect(t.gap).toBe(true);expect(t.prefix).toBe(1);});
 it('updates corrections and allows above-goal forecasts',()=>{expect(track(c,p,{[ids[0]]:p.rows[0].target*2}).forecast).toBeCloseTo(c.goal*2);expect(track(c,p,{[ids[0]]:0}).variance).toBe(-p.rows[0].target);expect(track(c,p,{[ids[0]]:p.rows[0].target}).variance).toBe(0);});
 it('handles completion, failed recovery and zero remaining time',()=>{const a=Object.fromEntries(p.rows.map(r=>[r.id,0]));expect(track(c,p,a).recoverable).toBe(false);expect(track(c,p,a).required).toBe(Infinity);const b=Object.fromEntries(p.rows.map(r=>[r.id,r.target]));expect(track(c,p,b).complete).toBe(true);expect(track(c,p,b).required).toBe(0);expect(track(c,p,b).forecast).toBe(c.goal);});
});
