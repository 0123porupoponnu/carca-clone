'use strict';
const STRONG_MODULE_VERSION='2.0.2'; // Compatible with the v2.0.2 index.html boot check; tactical hotfix
// Only use public remaining quantities. Never inspect the hidden draw pile.
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
/* Tactical defense v2.0.3.
   Defense: ensure an actual remaining tile can still finish a player's openings.
   Weak defense: retain finishing tiles, while making *hostile* tile placements rarer.
   Attack: reduce opponent completion chances without sacrificing our own viability.
   We evaluate ALL legal orientations against ALL immediate neighboring edges, but
   only aggregate PUBLIC tile counts (not the private deck order). */
function tacticalHole(comp,type,pos,context){
 const [x,y]=pos.split(',').map(Number),requirements=[],featureSides=new Set();
 for(let d=0;d<4;d++){
  const adjacent=board.get(nk(x,y,d));
  requirements[d]=adjacent?edge(db.get(adjacent.id),adjacent.rot,OP[d]):null;
 }
 // Which sides of the hole actually connect to this particular feature?
 for(const node of comp){
  const [nx,ny]=node.pos.split(',').map(Number);
  for(const side of ports(node.tile,type,node.n)){
   const d=DIR.indexOf(rdir(side,node.v.rot));
   if(nx+DX[d]===x&&ny+DY[d]===y)featureSides.add(OP[d]);
  }
 }
 if(!featureSides.size)return null;
 let closing=0,hostile=0,continuing=0,total=0;
 for(const {id,count} of supportForCell(x,y,context)){
  const tile=db.get(id);if(!tile)continue;
  // A physical tile is one draw, regardless of how many rotations are legal.
  let bestOut=Infinity,worstOut=-1;
  for(let r=0;r<4;r++){
   if(!requirements.every((req,d)=>!req||edge(tile,r,d)===req))continue;
   const connected=new Set();
   for(let i=0;i<getComponents(tile,type).length;i++){
    const rotated=ports(tile,type,i).map(side=>DIR.indexOf(rdir(side,r)));
    if(rotated.some(d=>featureSides.has(d)))for(const d of rotated)connected.add(d);
   }
   if(!connected.size)continue;
   let exits=0;for(const d of connected)if(!board.has(nk(x,y,d)))exits++;
   bestOut=Math.min(bestOut,exits);worstOut=Math.max(worstOut,exits);
  }
  if(worstOut<0)continue;
  total+=count;
  // A tile can be rotated beneficially or maliciously. Both possibilities matter.
  if(bestOut===0)closing+=count;
  if(worstOut>=2)hostile+=count;
  if(bestOut===1)continuing+=count;
 }
 if(!total)return {total:0,safe:0,hostile:0,continuing:0};
 return {total,safe:closing/total,hostile:hostile/total,continuing:continuing/total};
}
function strongTacticalValue(analysis,context,player=1){
 let value=0,examined=0;
 for(const f of analysis.features){
  if((f.type!=='city'&&f.type!=='road')||f.complete)continue;
  const ownership=[0,0];for(const n of f.comp){const m=n.v.meeple;if(m?.type===f.type&&m.n===n.n)ownership[m.player]++}
  if(ownership[0]===ownership[1])continue; // Shared or unowned features have no clear defensive side.
  const owner=ownership[1]>ownership[0]?1:0;
  const holes=frontierCells(f.comp,f.type);
  if(!holes.length)continue;
  let risk=0,safety=0,valid=0;
  for(const pos of holes.slice(0,6)){
   const t=tacticalHole(f.comp,f.type,pos,context);
   if(!t)continue;
   valid++;
   // Hostile options are especially dangerous, whereas genuine finishers protect us.
   risk+=t.total?t.hostile:1;
   safety+=t.safe;
  }
  if(!valid)continue;
  const blocked=f.blocked?1:0;
  const tactics=(-2.0*risk/valid+1.5*safety/valid-2.5*blocked)*Math.min(1.4,0.75+holes.length*.12);
  value+=(owner===player?1:-1)*tactics;
  if(++examined>=14)break; // Keep the CPU responsive on mobile.
 }
 return value;
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
  try{
   const analysis=analyzeStrongPosition(context),choice=bestStrongTarget(pos,analysis);
   const tactics=strongTacticalValue(analysis,context,active);
   const combined=choice.value+tactics;
   if(combined>value){value=combined;best=move}
  }finally{board.delete(pos)}
 }
 return best;
}
function chooseStrongTarget(pos){return bestStrongTarget(pos,analyzeStrongPosition(remainingContext())).target}
// The learned CPU also needs these tactics. Its 14-dimensional imitation model,
// stored training JSON and existing move preferences remain unchanged.
function defensiveLearnedPlacement(){
 const model=currentLearningModel();if(!model)return chooseStrongPlacement();
 const context=remainingContext(),options=optionsFor(selected),player=active;
 let best=null,value=-Infinity;
 for(const move of options){
  const preference=learningPreference(model.placement,placementVector(selected,move,player),PLACEMENT_DIM),pos=k(move.x,move.y);
  board.set(pos,{id:selected.id,rot:move.r,meeple:null});
  try{
   const analysis=analyzeStrongPosition(context),choice=bestStrongTarget(pos,analysis,learnedMeeplePreference(model,pos,player));
   const combined=choice.value+preference+strongTacticalValue(analysis,context,player);
   if(combined>value){value=combined;best=move}
  }finally{board.delete(pos)}
 }
 return best;
}
// learning.js is loaded after strong.js in v2.0.2, so install the adapter after
// parsing. The app's own cpuTurn() keeps calling learnedPlacement() as before.
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',()=>{
 if(typeof learnedPlacement==='function'&&typeof currentLearningModel==='function'){
  learnedPlacement=defensiveLearnedPlacement;
 }
});
