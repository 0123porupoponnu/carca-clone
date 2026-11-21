'use strict';
const LEARNING_MODULE_VERSION='2.0.6';
const LEARNING_VERSION=1,PLACEMENT_DIM=14,MEEPLE_DIM=14,MIN_LEARNING_SAMPLES=8;
function validRanker(rank,dim){return rank&&rank.samples>=MIN_LEARNING_SAMPLES&&Array.isArray(rank.weights)&&rank.weights.length===dim&&rank.weights.every(Number.isFinite)}
function usableLearningModel(model){return model?.version===LEARNING_VERSION&&(validRanker(model.placement,PLACEMENT_DIM)||validRanker(model.meeple,MEEPLE_DIM))}
function currentLearningModel(){const p=Object.hasOwn(training.profiles,cpuProfile)?training.profiles[cpuProfile]:null;return usableLearningModel(p?.model)?p.model:null}
function rankValue(weights,vector){return vector.reduce((s,v,i)=>s+v*weights[i],0)}
function placementVector(tile,move,player=active){
 const pos=k(move.x,move.y);if(board.has(pos))throw Error('学習候補の配置先が重複しています');
 const vector=Array(PLACEMENT_DIM).fill(0);board.set(pos,{id:tile.id,rot:move.r,meeple:null});
 try{
  for(let d=0;d<4;d++){const v=board.get(nk(move.x,move.y,d));if(v){vector[0]+=.25;if(v.meeple?.player===player)vector[12]+=.25}}
  for(const type of ['city','road']){
   const nodes=makeGraph(type),seen=new Set(),base=type==='city'?1:6;
   for(let n=0;n<getComponents(tile,type).length;n++){
    const start=nodeId(pos,type,n);if(seen.has(start))continue;
    const comp=component(nodes,start);comp.forEach(v=>seen.add(nodeId(v.pos,type,v.n)));
    const positions=[...new Set(comp.map(v=>v.pos))],owners=[0,0];
    for(const v of comp)if(v.v.meeple?.type===type&&v.v.meeple.n===v.n)owners[v.v.meeple.player]++;
    const ours=owners[player],theirs=owners[1-player];
    if(ours)vector[base]+=positions.length/8;if(theirs)vector[base+1]+=positions.length/8;
    const points=positions.length+(type==='city'?positions.reduce((s,p)=>s+(db.get(board.get(p).id).shieldCountPerPhysicalTile||0),0):0);
    if(featureComplete(comp,type)){
     if(ours&&ours>=theirs)vector[base+2]+=points/10;
     if(theirs&&theirs>=ours)vector[base+3]+=points/10;
    }
    if(!ours&&!theirs)vector[base+4]+=positions.length/8;
   }
  }
  if(tile.monastery)for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)if((x||y)&&board.has(k(move.x+x,move.y+y)))vector[11]+=.125;
  const positions=[...board.keys()].map(p=>p.split(',').map(Number));
  const cx=positions.reduce((s,p)=>s+p[0],0)/positions.length,cy=positions.reduce((s,p)=>s+p[1],0)/positions.length;
  vector[13]=Math.min(2,Math.hypot(move.x-cx,move.y-cy)/10);
  return vector.map(v=>Math.max(-2,Math.min(2,v)));
 }finally{board.delete(pos)}
}
function meepleVector(pos,target,player=active){
 const type=target?.type||'none',types=['none','city','road','monastery','field'],v=Array(MEEPLE_DIM).fill(0);v[types.indexOf(type)]=1;
 if(!target)return v;
 if(type==='monastery'){
  const [x,y]=pos.split(',').map(Number);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&board.has(k(x+dx,y+dy)))v[7]+=.125;
  v[6]=v[7]===1?1:0;
 }else{
  const nodes=makeGraph(type),comp=component(nodes,nodeId(pos,type,target.n));v[5]=Math.min(8,new Set(comp.map(n=>n.pos)).size)/8;
  if(type==='field'){
   const cities=cityFeatures().results.filter(c=>c.complete),touched=new Set();
   for(const n of comp)for(const c of cities)if(c.members.some(cn=>fieldTouchesCity(n,cn)))touched.add(c.key);
   v[8]=Math.min(6,touched.size)/6;
  }else v[6]=featureComplete(comp,type)?1:0;
  if(type==='city')v[13]=Math.min(3,[...new Set(comp.map(n=>n.pos))].reduce((s,p)=>s+(db.get(board.get(p).id).shieldCountPerPhysicalTile||0),0))/3;
 }
 v[9]=stock[player]/7;v[10]=round/71;v[11]=type==='field'?round/71:0;v[12]=stock[player]<=2?1:0;return v;
}
function decisionKey(move){return `${move.x},${move.y},${move.r}`}
function capturePlacementDecision(tile,chosen){
 const all=optionsFor(tile),chosenKey=decisionKey(chosen),others=all.filter(o=>decisionKey(o)!==chosenKey),stride=Math.max(1,Math.ceil(others.length/11));
 const candidates=[chosen,...others.filter((o,i)=>i%stride===0).slice(0,11)];
 return {chosen:placementVector(tile,chosen),alternatives:candidates.slice(1).map(o=>placementVector(tile,o))};
}
function captureMeepleDecision(pos,chosen){
 const all=[null,...targetState(pos).filter(t=>t.enabled)],key=t=>t?`${t.type}:${t.n}`:'none';
 return {chosen:meepleVector(pos,chosen),alternatives:all.filter(t=>key(t)!==key(chosen)).map(t=>meepleVector(pos,t))};
}
function validDecision(sample,dim){return sample&&Array.isArray(sample.chosen)&&sample.chosen.length===dim&&sample.chosen.every(x=>Number.isFinite(x)&&Math.abs(x)<=2)&&Array.isArray(sample.alternatives)&&sample.alternatives.length>0&&sample.alternatives.length<=32&&sample.alternatives.every(v=>Array.isArray(v)&&v.length===dim&&v.every(x=>Number.isFinite(x)&&Math.abs(x)<=2))}
function learningExamples(profile,kind){const dim=kind==='placement'?PLACEMENT_DIM:MEEPLE_DIM;return profile.moves.filter(m=>m.decision?.version===LEARNING_VERSION&&m.source==='human'&&typeof m.gameId==='string'&&validDecision(m.decision[kind],dim)).map(m=>({gameId:m.gameId,...m.decision[kind]}))}
function fitRanker(examples,dim){
 const weights=Array(dim).fill(0);
 for(let epoch=0;epoch<24;epoch++)for(const sample of examples)for(const alternative of sample.alternatives){
  const delta=sample.chosen.map((v,i)=>v-alternative[i]),margin=rankValue(weights,delta),gradient=1/(1+Math.exp(Math.max(-20,Math.min(20,margin))));
  for(let i=0;i<dim;i++)weights[i]+= .07*(gradient*delta[i]/sample.alternatives.length-.004*weights[i]);
 }
 return {weights,samples:examples.length};
}
function rankerMetrics(ranker,examples){let correct=0;for(const s of examples){const best=rankValue(ranker.weights,s.chosen);if(s.alternatives.every(v=>best>rankValue(ranker.weights,v)+1e-8))correct++}return {correct,total:examples.length}}
function trainLearningProfile(profile){
 const placement=learningExamples(profile,'placement'),meeple=learningExamples(profile,'meeple');
 if(placement.length<MIN_LEARNING_SAMPLES&&meeple.length<MIN_LEARNING_SAMPLES)throw Error('局面付きの記録がまだ足りません。自分の操作を8手以上保存してください。');
 const games=[...new Set([...placement,...meeple].map(s=>s.gameId))].sort(),holdout=games.length>=3?games.at(-1):null;
 const model={version:LEARNING_VERSION,createdAt:new Date().toISOString(),recordCount:profile.moves.length,gameCount:games.length,metrics:{scope:holdout?'holdout':'training'}};
 for(const [kind,examples,dim] of [['placement',placement,PLACEMENT_DIM],['meeple',meeple,MEEPLE_DIM]]){
  const train=holdout?examples.filter(s=>s.gameId!==holdout):examples,test=holdout?examples.filter(s=>s.gameId===holdout):examples;
  if(train.length<MIN_LEARNING_SAMPLES)continue;
  model[kind]=fitRanker(train,dim);model.metrics[kind]=rankerMetrics(model[kind],test);
 }
 if(!usableLearningModel(model))throw Error('学習に使える対局が不足しています。もう1対局分を保存してください。');
 return model;
}
// Learning is a bounded preference among moves with similar strategic value.
// Sparse imitation data must never overrule a clear scoring opportunity.
function learningPreference(ranker,vector,dim){return validRanker(ranker,dim) ? .35*Math.tanh(rankValue(ranker.weights,vector)):0}
function learnedMeeplePreference(model,pos,player){return target=>learningPreference(model?.meeple,meepleVector(pos,target,player),MEEPLE_DIM)}
function learnedPlacement(){
 const model=currentLearningModel();if(!model)return chooseStrongPlacement();
 const context=remainingContext(),options=optionsFor(selected),player=active;let best=null,value=-Infinity;
 for(const move of options){
  const preference=learningPreference(model.placement,placementVector(selected,move,player),PLACEMENT_DIM),pos=k(move.x,move.y);
  board.set(pos,{id:selected.id,rot:move.r,meeple:null});
  try{
   const analysis=analyzeStrongPosition(context),choice=bestStrongTarget(pos,analysis,learnedMeeplePreference(model,pos,player));
   if(choice.value+preference>value){value=choice.value+preference;best=move}
  }finally{board.delete(pos)}
 }
 return best;
}
function learnedTarget(pos){
 const model=currentLearningModel();
 return bestStrongTarget(pos,analyzeStrongPosition(remainingContext()),learnedMeeplePreference(model,pos,active)).target;
}
