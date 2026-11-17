'use strict';
const STRONG_MODULE_VERSION='2.0.2';
// Remaining quantities are public information. Never inspect pile or its order.
function remainingKnowledge(){
 const counts=new Map(tiles.map(t=>[t.id,t.totalCount??t.deckCount+(t.startingCount||0)]));
 for(const v of board.values())counts.set(v.id,Math.max(0,(counts.get(v.id)||0)-1));
 for(const id of discard)counts.set(id,Math.max(0,(counts.get(id)||0)-1));
 if(phase==='tile'&&selected)counts.set(selected.id,Math.max(0,(counts.get(selected.id)||0)-1));
 return counts;
}
function drawAtLeastOne(total,matches,draws){
 if(matches<=0||draws<=0||total<=0)return 0;if(draws>total-matches)return 1;
 let miss=1;for(let i=0;i<draws;i++)miss*=(total-matches-i)/(total-i);return 1-miss;
}
function remainingContext(counts=remainingKnowledge()){
 return {counts,total:[...counts.values()].reduce((s,n)=>s+n,0),support:new Map()};
}
function supportForCell(x,y,context){
 if(x<0||y<0||x>=SIZE||y>=SIZE||board.has(k(x,y)))return [];
 const requirements=DIR.map((_,d)=>{const v=board.get(nk(x,y,d));return v?edge(db.get(v.id),v.rot,OP[d]):null}),signature=requirements.map(v=>v||'?').join('/');
 if(context.support.has(signature))return context.support.get(signature);
 const support=[];
 for(const tile of tiles){const count=context.counts.get(tile.id)||0;if(!count)continue;
  if([0,1,2,3].some(r=>requirements.every((needed,d)=>!needed||edge(tile,r,d)===needed)))support.push({id:tile.id,count});
 }
 context.support.set(signature,support);return support;
}
function frontierCells(comp,type){
 const cells=new Set();for(const node of comp){const [x,y]=node.pos.split(',').map(Number);for(const side of ports(node.tile,type,node.n)){const d=DIR.indexOf(rdir(side,node.v.rot)),pos=nk(x,y,d);if(!board.has(pos))cells.add(pos)}}return [...cells];
}
// Necessary feasibility test: distinct holes require distinct remaining physical tiles.
function canFillAll(supports){
 const slots=new Map();let count=0;
 for(const support of supports)for(const {id,count:n} of support)if(!slots.has(id)){slots.set(id,Array.from({length:n},()=>count++))}
 if(count<supports.length)return false;
 const assigned=new Map(),ordered=supports.slice().sort((a,b)=>a.reduce((s,v)=>s+v.count,0)-b.reduce((s,v)=>s+v.count,0));
 const visit=(i,seen)=>{for(const {id} of ordered[i])for(const slot of slots.get(id)){if(seen.has(slot))continue;seen.add(slot);if(!assigned.has(slot)||visit(assigned.get(slot),seen)){assigned.set(slot,i);return true}}return false};
 for(let i=0;i<ordered.length;i++)if(!visit(i,new Set()))return false;return true;
}
function completionEstimate(comp,type,context){
 const frontier=frontierCells(comp,type);if(!frontier.length)return {complete:true,probability:1,probabilities:[1,1],blocked:false};
 const supports=frontier.map(p=>supportForCell(...p.split(',').map(Number),context));
 if(supports.some(s=>!s.length)||!canFillAll(supports))return {complete:false,probability:0,probabilities:[0,0],blocked:true};
 // Approximation: enough matching draws on this player's future turns, per opening.
 const probabilities=[1,1];for(const support of supports){const matches=support.reduce((s,v)=>s+v.count,0);for(let p=0;p<2;p++)probabilities[p]*=drawAtLeastOne(context.total,matches,p===active?Math.floor(context.total/2):Math.ceil(context.total/2))}
 return {complete:false,probability:probabilities[active],probabilities,blocked:false};
}
function analyzeStrongPosition(context){
 const features=[],cities=[],cityByNode=new Map();
 for(const type of ['city','road','field']){
  const nodes=makeGraph(type),seen=new Set();for(const [id] of nodes){if(seen.has(id))continue;
   const comp=component(nodes,id);comp.forEach(n=>seen.add(nodeId(n.pos,type,n.n)));
   const positions=[...new Set(comp.map(n=>n.pos))];const f={type,comp};
   if(type!=='field'){
    const estimate=completionEstimate(comp,type,context);Object.assign(f,estimate);
    f.base=positions.length+(type==='city'?positions.reduce((s,p)=>s+(db.get(board.get(p).id).shieldCountPerPhysicalTile||0),0):0);
    if(type==='city'){f.key=id;cities.push(f);comp.forEach(n=>cityByNode.set(nodeId(n.pos,type,n.n),f))}
   }
   features.push(f);
  }
 }
 for(const f of features.filter(f=>f.type==='field')){
  const touched=new Set();for(const n of f.comp)for(const index of n.tile.fieldRegions[n.n].adjacentCities){const city=cityByNode.get(nodeId(n.pos,'city',index));if(city)touched.add(city)}
  f.base=[...touched].reduce((s,c)=>s+3*(c.complete?1:c.probability*.75),0);
 }
 for(const [pos,v] of board){if(!db.get(v.id).monastery)continue;const [x,y]=pos.split(',').map(Number);let occupied=0,possible=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy){if(board.has(k(x+dx,y+dy)))occupied++;else if(supportForCell(x+dx,y+dy,context).length)possible++}
  features.push({type:'monastery',v,complete:occupied===8,base:1+occupied,possible});
 }
 return {features,total:context.total};
}
function strongPositionValue(analysis,player=1){
 const values=score.slice(),available=stock.slice(),early=Math.min(1,analysis.total/24);
 for(const f of analysis.features){
  if(f.type==='monastery'){
   if(f.v.meeple?.type!=='monastery')continue;const p=f.v.meeple.player;
   if(f.complete){values[p]+=9;available[p]++}else values[p]+=f.base+f.possible*Math.min(.8,analysis.total/(analysis.total+12));continue;
  }
  const owners=f.comp.filter(n=>n.v.meeple?.type===f.type&&n.v.meeple.n===n.n),qty=[0,0];for(const n of owners)qty[n.v.meeple.player]++;
  const max=Math.max(...qty);if(!max)continue;
  for(let p=0;p<2;p++){
   const probability=f.probabilities?.[p]??f.probability,value=f.type==='field'?f.base:f.complete?f.base*(f.type==='city'?2:1):f.base*(f.type==='city'?1+probability:1)+probability*1.5;
   if(qty[p]===max)values[p]+=value;
   if(f.complete&&f.type!=='field')available[p]+=qty[p];
   else if(f.type!=='field')values[p]-=qty[p]*(f.blocked?2.5:1-probability)*early;
   else values[p]-=qty[p]*1.8*early;
  }
 }
 const stockValue=[0,4,7,9,10.5,11.5,12,12.3];
 for(let p=0;p<2;p++)values[p]+=stockValue[Math.max(0,Math.min(7,available[p]))]*early;
 return values[player]-values[1-player];
}
function strongTargets(pos){return [null,...targetState(pos).filter(t=>t.enabled)]}
function bestStrongTarget(pos,analysis,preference=null){
 const v=board.get(pos),player=active;let best=null,value=-Infinity;
 for(const target of strongTargets(pos)){
  const bonus=preference?preference(target):0;
  if(target){v.meeple={player,type:target.type,n:target.n};stock[player]--}
  try{const current=strongPositionValue(analysis,player)+bonus;if(current>value){value=current;best=target}}
  finally{if(target){v.meeple=null;stock[player]++}}
 }
 return {target:best,value};
}
function chooseStrongPlacement(){
 const context=remainingContext(),options=optionsFor(selected);let best=null,value=-Infinity;
 for(const move of options){
  const pos=k(move.x,move.y);board.set(pos,{id:selected.id,rot:move.r,meeple:null});
  try{const analysis=analyzeStrongPosition(context),choice=bestStrongTarget(pos,analysis);if(choice.value>value){value=choice.value;best=move}}
  finally{board.delete(pos)}
 }
 return best;
}
function chooseStrongTarget(pos){return bestStrongTarget(pos,analyzeStrongPosition(remainingContext())).target}
