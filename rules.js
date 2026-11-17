'use strict';
function rdir(d,r){return DIR[(DIR.indexOf(d)+r)%4]}
function edge(t,r,i){return t.edges[DIR[(i-r+4)%4]]}
function nk(x,y,i){return k(x+DX[i],y+DY[i])}
function canPlace(x,y,t,r){if(x<0||y<0||x>=SIZE||y>=SIZE||board.has(k(x,y)))return false;let adjacent=false;for(let i=0;i<4;i++){const v=board.get(nk(x,y,i));if(!v)continue;adjacent=true;if(edge(t,r,i)!==edge(db.get(v.id),v.rot,OP[i]))return false}return adjacent}
function getComponents(tile,type){return type==='city'?tile.cities:type==='road'?tile.roads:tile.fieldRegions}
function ports(tile,type,n){const comp=getComponents(tile,type)[n];return type==='field'?comp.ports.flatMap(p=>p.endsWith('_field')?[p.replace('_field','_cw_start'),p.replace('_field','_cw_end')]:[p]):comp.edges}
function rotatedPort(p,r){if(!p)return p;const [side,...rest]=p.split('_');return rdir(side,r)+(rest.length?'_'+rest.join('_'):'')}
function linkPort(port){if(port.endsWith('cw_start'))return port.replace('cw_start','cw_end');if(port.endsWith('cw_end'))return port.replace('cw_end','cw_start');return port}
function nodeId(pos,type,index){return pos+'|'+type+'|'+index}
function makeGraph(type){const nodes=new Map();for(const [pos,v] of board){const tile=db.get(v.id),cs=getComponents(tile,type);for(let n=0;n<cs.length;n++)nodes.set(nodeId(pos,type,n),{pos,v,tile,n,links:new Set()})}
for(const [id,node] of nodes){const [x,y]=node.pos.split(',').map(Number);for(const port of ports(node.tile,type,node.n)){const rp=type==='field'?rotatedPort(port,node.v.rot):rdir(port,node.v.rot);const side=type==='field'?rp.split('_')[0]:rp;const i=DIR.indexOf(side);if(i<0)continue;const neighborPos=nk(x,y,i),other=board.get(neighborPos);if(!other)continue;const otherTile=db.get(other.id),otherComps=getComponents(otherTile,type);const oppositeSide=DIR[OP[i]];const expected=type==='field'?linkPort(oppositeSide+rp.slice(side.length)):oppositeSide;for(let j=0;j<otherComps.length;j++){const matches=ports(otherTile,type,j).some(p=>(type==='field'?rotatedPort(p,other.rot):rdir(p,other.rot))===expected);if(matches){const otherId=nodeId(neighborPos,type,j);if(nodes.has(otherId)){node.links.add(otherId);nodes.get(otherId).links.add(id)}}}}}
return nodes}
function component(nodes,start){const seen=new Set([start]),todo=[start];while(todo.length){const n=nodes.get(todo.pop());if(!n)continue;for(const t of n.links)if(!seen.has(t)){seen.add(t);todo.push(t)}}return [...seen].map(id=>nodes.get(id)).filter(Boolean)}
function featureComplete(comp,type){for(const node of comp){const [x,y]=node.pos.split(',').map(Number);for(const p of ports(node.tile,type,node.n)){const i=DIR.indexOf(rdir(p,node.v.rot));if(!board.has(nk(x,y,i)))return false}}return true}
// A field is a set of half-edge ports. The old UI used only the first port,
// so distinct fields on the same road tile could receive identical markers.
// This computes the anchor from *all* ports on that connected field.
function fieldPortPoint(p){
  const points={
    top_field:[50,8],right_field:[92,50],bottom_field:[50,92],left_field:[8,50],
    top_cw_start:[29,7],top_cw_end:[71,7],
    right_cw_start:[93,29],right_cw_end:[93,71],
    bottom_cw_start:[71,93],bottom_cw_end:[29,93],
    left_cw_start:[7,71],left_cw_end:[7,29]
  };
  return points[p]||[50,50];
}
function fieldAnchor(t,n){
  if(t.fieldRegions[n]?.anchor)return t.fieldRegions[n].anchor;
  const fields=t.fieldRegions||[];
  const ps=fields[n]?.ports||[];
  if(!ps.length)return [50,50];
  // Midpoint/centroid of every boundary segment of this field.
  let pts=ps.map(fieldPortPoint);
  let x=pts.reduce((a,p)=>a+p[0],0)/pts.length;
  let y=pts.reduce((a,p)=>a+p[1],0)/pts.length;
  // Move slightly into the tile, not on its hard outer border.
  x=50+(x-50)*0.85;y=50+(y-50)*0.85;
  // A single field that covers a full circle around a road ending at a
  // monastery should not put the marker over the monastery artwork.
  if(fields.length===1&&Math.hypot(x-50,y-50)<8){x=75;y=28}
  return [Math.max(14,Math.min(86,x)),Math.max(14,Math.min(86,y))];
}
function rotatePoint(x,y,r){let xx=x-50,yy=y-50;for(let i=0;i<r;i++){const old=xx;xx=-yy;yy=old}return [50+xx,50+yy]}
function getTargets(pos){
  const v=board.get(pos),t=db.get(v.id),res=[];
  for(const type of ['city','road','monastery','field']){
    if(type==='monastery'){
      if(t.monastery)res.push({type,n:0,label:'修道院',px:50,py:50});
      continue;
    }
    const cs=getComponents(t,type);
    for(let n=0;n<cs.length;n++){
      const q=cs[n];
      let xy;
      if(type==='field')xy=rotatePoint(...fieldAnchor(t,n),v.rot);
      else{
        const e=q.edges||[];
        const idx=e.length?DIR.indexOf(rdir(e[0],v.rot)):0;
        xy=([[50,19],[80,50],[50,80],[20,50]])[idx<0?0:idx];
      }
      res.push({type,n,label:({city:'都市',road:'道',field:'草原'})[type]+(cs.length>1?` ${n+1}`:''),px:xy[0],py:xy[1]});
    }
  }
  return res;
}
function reachableOccupied(pos,type,n){if(type==='monastery')return false;const nodes=makeGraph(type);const start=nodeId(pos,type,n);return component(nodes,start).some(node=>node.v.meeple&&node.v.meeple.type===type&&node.v.meeple.n===node.n)}
function eligible(pos){if(stock[active]<=0)return [];return getTargets(pos).filter(t=>t.type==='monastery'||!reachableOccupied(pos,t.type,t.n))}
function targetKey(t){return `${t.type}:${t.n}`}
function targetState(pos){const all=getTargets(pos).map((t,i)=>({...t,key:targetKey(t),index:i+1,enabled:stock[active]>0&&(t.type==='monastery'||!reachableOccupied(pos,t.type,t.n))}));return all}
function offsetFor(index){const arr=[[0,0],[10,-10],[-10,10],[10,10],[-10,-10],[0,12],[12,0],[-12,0],[0,-12]];return arr[index%arr.length]}
function chooseTarget(t){selectedTargetKey=targetKey(t);selectedFeatureType=t.type;render()}
function chooseFeature(type){selectedFeatureType=type;selectedTargetKey=null;render()}
function scoring(){const entries=[];for(const type of ['city','road']){const nodes=makeGraph(type),done=new Set();for(const [id] of nodes){if(done.has(id))continue;const comp=component(nodes,id);comp.forEach(n=>done.add(nodeId(n.pos,type,n.n)));if(!featureComplete(comp,type))continue;const owners=comp.filter(n=>n.v.meeple&&n.v.meeple.type===type&&n.v.meeple.n===n.n);if(!owners.length)continue;const tilesIn=new Set(comp.map(n=>n.pos));let points=tilesIn.size;if(type==='city')points=2*(points+[...new Set(comp.map(n=>n.pos))].reduce((sum,p)=>sum+(db.get(board.get(p).id).shieldCountPerPhysicalTile||0),0));let qty=[0,0];for(const n of owners)qty[n.v.meeple.player]++;let max=Math.max(...qty);for(let p=0;p<2;p++)if(qty[p]===max)score[p]+=points;for(const n of owners){stock[n.v.meeple.player]++;n.v.meeple=null}entries.push(`${type==='city'?'都市':'道路'}完成：${points}点（${qty.map((q,p)=>q===max?(p===0?'青':'橙'):null).filter(Boolean).join('・')}）`)}}
for(const [pos,v] of board){if(!v.meeple||v.meeple.type!=='monastery')continue;const [x,y]=pos.split(',').map(Number);let adjacent=0;for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++)if((xx||yy)&&board.has(k(x+xx,y+yy)))adjacent++;if(adjacent===8){score[v.meeple.player]+=9;stock[v.meeple.player]++;v.meeple=null;entries.push('修道院完成：9点')}}return entries}
// Each city component is identified by the lexicographically smallest node id;
// completed cities are counted once even when they touch the same field more than once.
function cityFeatures(){const nodes=makeGraph('city'),done=new Set(),results=[],byNode=new Map();
for(const [id] of nodes){if(done.has(id))continue;const members=component(nodes,id);const ids=members.map(n=>nodeId(n.pos,'city',n.n));ids.forEach(i=>done.add(i));
const key=ids.slice().sort()[0], info={key,members,complete:featureComplete(members,'city')};results.push(info);ids.forEach(i=>byNode.set(i,info))}return {results,byNode}}
function fieldTouchesCity(fieldNode,cityNode){return fieldNode.pos===cityNode.pos && fieldNode.tile.fieldRegions[fieldNode.n].adjacentCities.includes(cityNode.n)}
function finalScoring(){const extra=[0,0],detail=[];
for(const type of ['city','road']){const nodes=makeGraph(type),visited=new Set();
for(const [id] of nodes){if(visited.has(id))continue;const comp=component(nodes,id);comp.forEach(n=>visited.add(nodeId(n.pos,type,n.n)));
if(featureComplete(comp,type))continue;
const owners=comp.filter(n=>n.v.meeple?.type===type&&n.v.meeple.n===n.n);if(!owners.length)continue;
const allPositions=[...new Set(comp.map(n=>n.pos))];let value=allPositions.length;
if(type==='city')value+=allPositions.reduce((sum,pos)=>sum+(db.get(board.get(pos).id).shieldCountPerPhysicalTile||0),0);
const qty=[0,0];owners.forEach(n=>qty[n.v.meeple.player]++);const most=Math.max(...qty);
for(let p=0;p<2;p++)if(qty[p]===most)extra[p]+=value;
detail.push({feature:type==='city'?'未完成都市':'未完成道路',points:value,blue:qty[0]===most?value:0,orange:qty[1]===most?value:0})}}
for(const [pos,v] of board){if(v.meeple?.type!=='monastery')continue;const [x,y]=pos.split(',').map(Number);let adjacent=0;
for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++)if((xx||yy)&&board.has(k(x+xx,y+yy)))adjacent++;
const value=adjacent+1;extra[v.meeple.player]+=value;
detail.push({feature:'未完成修道院',points:value,blue:v.meeple.player===0?value:0,orange:v.meeple.player===1?value:0})}
const fields=makeGraph('field'),cities=makeGraph('city'),{results:cityList}=cityFeatures();
const cityByPos=new Map();for(const city of cityList){if(!city.complete)continue;for(const n of city.members){if(!cityByPos.has(n.pos))cityByPos.set(n.pos,[]);cityByPos.get(n.pos).push({city,node:n})}}
const seen=new Set();for(const [id] of fields){if(seen.has(id))continue;const comp=component(fields,id);comp.forEach(n=>seen.add(nodeId(n.pos,'field',n.n)));
const owners=comp.filter(n=>n.v.meeple?.type==='field'&&n.v.meeple.n===n.n);if(!owners.length)continue;
const touched=new Set();for(const fieldNode of comp){for(const {city,node} of cityByPos.get(fieldNode.pos)||[]){if(fieldTouchesCity(fieldNode,node))touched.add(city.key)}}
const value=3*touched.size,qty=[0,0];owners.forEach(n=>qty[n.v.meeple.player]++);const most=Math.max(...qty);
for(let p=0;p<2;p++)if(qty[p]===most)extra[p]+=value;
detail.push({feature:`草原（完成都市${touched.size}個）`,points:value,blue:qty[0]===most?value:0,orange:qty[1]===most?value:0})}
return {extra,detail,totals:[score[0]+extra[0],score[1]+extra[1]]}}
// Presentation totals only; never changes the scoring result or board.
function finalScoreSummary(result){
 const rows=['未完成都市','未完成道路','未完成修道院','草原'].map(feature=>({feature,blue:0,orange:0}));
 for(const item of result.detail){const row=rows.find(r=>item.feature===r.feature||(r.feature==='草原'&&item.feature.startsWith('草原')));if(row){row.blue+=item.blue;row.orange+=item.orange}}
 return [{feature:'対局中の得点',blue:result.totals[0]-result.extra[0],orange:result.totals[1]-result.extra[1]},...rows,{feature:'合計',blue:result.totals[0],orange:result.totals[1]}];
}
