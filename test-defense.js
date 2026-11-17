const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(__dirname+'/strong.js','utf8');
const make=(extra={})=>{
 const env={
  DIR:['top','right','bottom','left'],DX:[0,1,0,-1],DY:[-1,0,1,0],OP:[2,3,0,1],SIZE:201,
  k:(x,y)=>x+','+y,nk:(x,y,d)=>[x,y-1,x+1,y,x,y+1,x-1,y][0]||'',
  board:new Map(),tiles:[],db:new Map(),discard:[],phase:'meeple',selected:null,
  active:1,stock:[7,7],score:[0,0],
  edge:(tile,r,d)=>tile.edges[(d-r+4)%4],
  rdir:(side,r)=>['top','right','bottom','left'][( ['top','right','bottom','left'].indexOf(side)+r)%4],
  ports:(tile,type,n)=>tile[type+'s'][n],
  getComponents:(tile,type)=>tile[type+'s'],
  ...extra
 };
 env.nk=(x,y,d)=>env.k(x+env.DX[d],y+env.DY[d]);
 vm.createContext(env);vm.runInContext(src,env);
 return env;
};
const base={id:'base',edges:['field','field','city','field'],citys:[['bottom']],roads:[]};
const close={id:'close',edges:['city','field','field','field'],citys:[['top']],roads:[]};
const spread={id:'spread',edges:['city','city','city','field'],citys:[['top','right','bottom']],roads:[]};
const ctx=make();for(const t of [base,close,spread]){ctx.tiles.push(t);ctx.db.set(t.id,t)}
ctx.board.set('100,100',{id:'base',rot:0,meeple:{type:'city',player:1,n:0}});
const comp=[{pos:'100,100',tile:base,v:ctx.board.get('100,100'),n:0}];
const countContext={counts:new Map([['close',3],['spread',1]]),total:4,support:new Map()};
const result=ctx.tacticalHole(comp,'city','100,101',countContext);
assert(result.total===4,'remaining tiles counted');
assert(result.safe===.75,'close tile safety');
assert(result.hostile===.25,'spread tile danger');
const noneContext={counts:new Map([['close',3]]),total:3,support:new Map()};
const protectedResult=ctx.tacticalHole(comp,'city','100,101',noneContext);
assert(protectedResult.hostile===0,'no hostile tile means protected');
assert(protectedResult.safe===1,'all remaining tiles can finish');
const estimated={features:[{type:'city',comp,complete:false,blocked:false}],total:4};
ctx.frontierCells=()=>['100,101'];
const own=ctx.strongTacticalValue(estimated,countContext,1);
const enemy=ctx.strongTacticalValue(estimated,countContext,0);
assert(own>0 && enemy<0,'defensive benefit for the owner, negative for opponent');
console.log('PASS: legal tile shape, safe/harmful split, remaining counts, ownership tactical scoring');
