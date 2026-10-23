import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer } from '../renderer.js';

// Record actual Canvas commands, validating numeric geometry like Canvas itself.
function recordingContext() {
  const calls = [], stack = [];
  let matrix=[1,0,0,1,0,0];
  const target = { calls, fillStyle: '', globalAlpha: 1, lineWidth: 1,
    save() { stack.push({ fillStyle: this.fillStyle, globalAlpha: this.globalAlpha, matrix:[...matrix] }); },
    restore() { assert.ok(stack.length, 'balanced Canvas state'); const state=stack.pop();matrix=state.matrix;delete state.matrix;Object.assign(this,state); },
    measureText(text) { return { width: String(text).length * 7 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; }
  };
  return new Proxy(target, { get(obj, key) {
    if (key in obj) return obj[key];
    return (...args) => {
      for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${String(key)} contains finite geometry`);
      let transformed;
      if(key==='moveTo'||key==='lineTo') transformed={x:matrix[0]*args[0]+matrix[2]*args[1]+matrix[4],y:matrix[1]*args[0]+matrix[3]*args[1]+matrix[5]};
      calls.push({ op: key, args, color: obj.fillStyle, alpha: obj.globalAlpha, ...(transformed?{transformed}:{}) });
      const [a,b,c,d,e,f]=matrix;
      if(key==='translate') matrix=[a,b,c,d,a*args[0]+c*args[1]+e,b*args[0]+d*args[1]+f];
      if(key==='scale') matrix=[a*args[0],b*args[0],c*args[1],d*args[1],e,f];
      if(key==='rotate') {const cos=Math.cos(args[0]),sin=Math.sin(args[0]);matrix=[a*cos+c*sin,b*cos+d*sin,c*cos-a*sin,d*cos-b*sin,e,f];}
    };
  }});
}

const sprites = await import('../actor-sprites.js').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
const traveler = { x: 150, y: 150, tile: 64, time: 1.2, angle: 0, moving: false, weapon: 'pistol', fireAnim: 0, reloadTimer: 0, reloadDuration: 1, equipment: {}, reducedMotion: false };

test('held pistol, shotgun and AK produce distinct silhouettes with the same muzzle alignment', () => {
  assert.equal(typeof sprites.drawTraveler, 'function');
  const silhouettes = [];
  for (const weapon of ['pistol', 'shotgun', 'ak']) {
    const ctx = recordingContext();
    const anchors = sprites.drawTraveler(ctx, { ...traveler, weapon });
    assert.deepEqual(anchors.muzzle, { x: 180.72, y: 150 });
    assert.ok(anchors.torch.y < 150, 'torch sits across from the weapon hand');
    silhouettes.push(JSON.stringify(ctx.calls.filter(c => c.op === 'fillRect')));
  }
  assert.equal(new Set(silhouettes).size, 3);
});

test('firing adds a muzzle flash at the actual projectile origin and reload shows progress', () => {
  assert.equal(typeof sprites.drawTraveler, 'function');
  const idle = recordingContext(), fired = recordingContext(), reload = recordingContext();
  sprites.drawTraveler(idle, traveler);
  sprites.drawTraveler(fired, { ...traveler, fireAnim: .14 });
  sprites.drawTraveler(reload, { ...traveler, weapon: 'ak', reloadTimer: .5, reloadDuration: 1 });
  assert.ok(fired.calls.some(c => c.op === 'translate' && c.args[0] === 180.72 && c.args[1] === 150));
  assert.ok(fired.calls.length > idle.calls.length, 'flash/casing/smoke are emitted');
  assert.ok(reload.calls.some(c => c.op === 'fillText' && /50%/.test(c.args[0])));
});

test('torch-only traveler has an empty weapon hand before the first gun pickup', () => {
  const unarmed=recordingContext(),armed=recordingContext();
  sprites.drawTraveler(unarmed,{...traveler,weapon:null,fireAnim:.14,reloadTimer:.5});
  sprites.drawTraveler(armed,traveler);
  assert.ok(unarmed.calls.length<armed.calls.length,'unarmed must omit gun geometry and stale firing effects');
  assert.ok(!unarmed.calls.some(c=>c.op==='fillText'&&/%/.test(c.args[0])));
});

test('equipment changes the traveler silhouette and reduced motion keeps firing/reload legible', () => {
  assert.equal(typeof sprites.drawTraveler, 'function');
  const plain = recordingContext(), equipped = recordingContext(), reduced = recordingContext();
  sprites.drawTraveler(plain, traveler);
  sprites.drawTraveler(equipped, { ...traveler, equipment: { head: 'crown', body: 'armor', charm: 'satchel' } });
  assert.notDeepEqual(equipped.calls, plain.calls);
  sprites.drawTraveler(reduced, { ...traveler, moving: true, angle: Math.PI / 2, fireAnim: .1, reloadTimer: .5, reducedMotion: true });
  assert.ok(reduced.calls.some(c => c.op === 'fillText' && /50%/.test(c.args[0])));
  assert.ok(!reduced.calls.some(c => c.op === 'rotate' && Math.abs(c.args[0]) > Math.PI * 2));
});

test('screen-left torch stays clear of the face while the gun aims in all four directions', () => {
  const cases=[[0,180.72,150],[Math.PI,119.28,150],[-Math.PI/2,150,119.28],[Math.PI/2,150,180.72]];
  for(const [angle,muzzleX,muzzleY] of cases) {
    const ctx=recordingContext();
    const anchors=sprites.drawTraveler(ctx,{...traveler,angle,equipment:{head:'crown'},reducedMotion:true});
    assert.ok(Math.abs(anchors.muzzle.x-muzzleX)<.001&&Math.abs(anchors.muzzle.y-muzzleY)<.001,'gun muzzle continues following aim');
    assert.deepEqual(anchors.torch,{x:128.24,y:132.72},'torch stays in the screen-left free hand');
    const flame=ctx.calls.filter(c=>c.color==='#ffac54'&&c.transformed);
    assert.ok(flame.length>0);
    assert.ok(flame.every(c=>c.transformed.x<135.92),'actual flame path clears the left edge of the widest headwear');
  }
});

test('zombie families and landmark bosses have different Canvas silhouettes', () => {
  assert.equal(typeof sprites.drawEnemySprite, 'function');
  const silhouettes = [];
  for (const type of ['zombie', 'feral', 'spitter', 'guardian', 'plagueBoss', 'cryptLord']) {
    const ctx = recordingContext();
    sprites.drawEnemySprite(ctx, { x: 100, y: 100, tile: 64, time: 1, enemy: { type, alive: true, angle: 0, stepPhase: 0, hp: 100, maxHp: 100, boss: /guardian|Boss|Lord/.test(type), bossPhase: 2 } });
    silhouettes.push(JSON.stringify(ctx.calls));
  }
  assert.equal(new Set(silhouettes).size, 6);
});

test('dead actors keep a fading species-specific death drawing until their timer expires', () => {
  assert.equal(typeof sprites.drawEnemyRemains, 'function');
  const silhouettes = [];
  for (const type of ['skeleton', 'zombie', 'wraith']) {
    const ctx = recordingContext(), enemy = { type, zombie: type === 'zombie', alive: false, deathLife: .3, deathMax: .6, angle: .5, hitAngle: .5 };
    assert.equal(sprites.drawEnemyRemains(ctx, { x: 100, y: 100, tile: 64, time: 1, enemy }), true);
    assert.ok(ctx.calls.some(c => c.alpha > 0 && c.alpha < 1), 'death must fade visibly');
    silhouettes.push(JSON.stringify(ctx.calls));
    const expired = recordingContext();
    sprites.drawEnemyRemains(expired, { x: 100, y: 100, tile: 64, enemy: { ...enemy, deathLife: 0 } });
    assert.equal(expired.calls.length, 0);
  }
  assert.equal(new Set(silhouettes).size, 3);
});

function rendererFixture(extra = {}) {
  const ctx = recordingContext();
  const makeCanvas = () => ({ width: 0, height: 0, getContext: () => recordingContext() });
  globalThis.document = { createElement: makeCanvas };
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.Image = class { complete = false; };
  const state = {
    maze: Array.from({length:9},(_,y)=>Array.from({length:9},(_,x)=>x===0||y===0||x===8||y===8?1:0)),
    cols:9,rows:9,player:{x:4.5,y:4.5,angle:0,moving:false},exit:{x:7,y:7},
    coins:[],weaponPickups:[],lootPickups:[],secretDoors:[],enemies:[],bullets:[],hostileBullets:[],particles:[],
    currentWeapon:'pistol',reducedMotion:true,graphicsQuality:'low',...extra
  };
  const renderer=createRenderer({canvas:{getContext:()=>ctx},canvasWrap:{getBoundingClientRect:()=>({width:640,height:480})},getState:()=>state});
  renderer.resizeCanvas();renderer.draw(1000);ctx.calls.length=0;
  return {ctx,state,renderer};
}

test('world renderer keeps corpses drawing after collision death', () => {
  const {ctx,state,renderer}=rendererFixture({enemies:[{type:'zombie',zombie:true,x:4,y:4,alive:false,deathLife:.3,deathMax:.6,hitAngle:0}]});
  renderer.draw(1000);const corpseCount=ctx.calls.length;
  state.enemies=[];ctx.calls.length=0;renderer.draw(1000);
  assert.ok(corpseCount>ctx.calls.length,'alive=false must still draw an unexpired death');
});

test('world renderer shows boss identity, vault symbols, altar wave progress and nearest interaction', () => {
  const {ctx,renderer}=rendererFixture({
    enemies:[{type:'plagueBoss',boss:true,bossPhase:2,name:'Colosso da Peste',x:5,y:4,alive:true,hp:80,maxHp:100,angle:0,stepPhase:0}],
    secretDoors:[{id:1,x:3,y:3,locked:true,symbol:'◆',opened:false}],
    lootPickups:[{type:'vaultKey',symbol:'◆',x:3,y:4,phase:0},{type:'altar',x:4,y:3,phase:0}],
    challenge:{active:true,completed:false,wave:2,totalWaves:3,remaining:7,x:4,y:3},interactionHint:'E · abrir tesouro'
  });
  renderer.draw(1000);
  const labels=ctx.calls.filter(c=>c.op==='fillText').map(c=>String(c.args[0]));
  assert.ok(labels.some(label=>label.includes('Colosso da Peste')));
  assert.ok(labels.filter(label=>label.includes('◆')).length>=2,'matching symbols on key and door');
  assert.ok(labels.some(label=>label.includes('2/3')&&label.includes('7')));
  assert.ok(labels.some(label=>label.includes('E · abrir tesouro')));
});

test('ranged shoot telegraph uses the locked shot direction', () => {
  const {ctx,renderer}=rendererFixture({enemies:[{type:'wraith',x:4,y:4,alive:true,angle:0,attackAim:1.25,attackMode:'shoot',attackAnim:.4,attackMax:.5}]});
  renderer.draw(1000);
  assert.ok(ctx.calls.some(c=>c.op==='rotate'&&c.args[0]===1.25));
  assert.ok(ctx.calls.some(c=>c.op==='arc'&&c.args[3]===-.1&&c.args[4]===.1));
});

test('torch embers emerge from the free-hand torch as the traveler changes aim', () => {
  // At this viewport the tile is 35px and player center is (320,240).
  // At t=1000ms ember age is .55, drift is sin(2.75)*4.9, and rise is 19.11px.
  for (const [angle,want] of [[0,[310,211]],[Math.PI/2,[310,211]],[Math.PI,[310,211]],[-Math.PI/2,[310,211]]]) {
    const {ctx,renderer}=rendererFixture({reducedMotion:false,player:{x:4.5,y:4.5,angle,moving:false}});
    renderer.draw(1000);
    const ember=ctx.calls.find(c=>c.op==='fillRect'&&c.color==='#fff0a4');
    assert.ok(ember,'player flame emits its first ember');
    assert.deepEqual(ember.args.slice(0,2),want);
  }
});

test('ranged telegraphs cover actual fan widths and the next crypt lord shot', () => {
  const cases=[
    {type:'spitter',projectilePattern:'fan',want:.22},
    {type:'guardian',boss:true,bossPhase:1,projectilePattern:'fan',want:.22},
    {type:'plagueBoss',boss:true,bossPhase:2,projectilePattern:'fan',want:.36},
    {type:'cryptLord',boss:true,bossPhase:2,projectilePattern:'spectral',shotNumber:0,want:.36},
    {type:'cryptLord',boss:true,bossPhase:2,projectilePattern:'spectral',shotNumber:1,want:.17}
  ];
  for(const {want,...details} of cases) {
    const {ctx,renderer}=rendererFixture({enemies:[{...details,x:4,y:4,alive:true,angle:0,stepPhase:0,attackAim:.8,attackMode:'shoot',attackAnim:.4,attackMax:.5,hp:100,maxHp:100}]});
    renderer.draw(1000);
    assert.ok(ctx.calls.some(c=>c.op==='arc'&&c.args[3]===-want&&c.args[4]===want),`${details.type} preview must cover ±${want}`);
  }
});

test('synthetic altar uses challenge world center and completion distance uses the same point', () => {
  const {ctx,state,renderer}=rendererFixture({challenge:{active:false,completed:false,wave:0,totalWaves:3,remaining:0,x:4.5,y:3.5}});
  renderer.draw(1000);
  const labelIndex=ctx.calls.findIndex(c=>c.op==='fillText'&&c.args[0]==='E · ALTAR');
  assert.ok(labelIndex>=0);
  const transform=ctx.calls.slice(0,labelIndex).findLast(c=>c.op==='translate');
  assert.deepEqual(transform.args,[320,205],'world-center altar is drawn at its interaction point');
  state.challenge={...state.challenge,completed:true,x:6.69,y:4.5};ctx.calls.length=0;renderer.draw(1000);
  assert.ok(ctx.calls.some(c=>c.op==='fillText'&&c.args[0]==='DESAFIO CONCLUÍDO'),'2.19-tile distance is inside the completion label range');
});
