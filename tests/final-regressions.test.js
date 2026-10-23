import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameHarness } from './helpers/game-harness.js';
import { createRenderer } from '../renderer.js';

test('seed 77 ritual enemies have short walkable routes and actually pursue the altar', async () => {
  const game = await createGameHarness();
  const result = game.run(`
    newGame(true);player.x=challenge.x;player.y=challenge.y;
    // Deliberately retain the old player field until after spawning: the spawn
    // search must be fresh even when the shared AI navigation cache is stale.
    tryInteract();navigation.rebuild(player.x,player.y);navigationDirty=false;
    const wave=enemies.filter(e=>e.challengeId===challenge.id);
    const initial=wave.map(e=>navigation.distanceAt(e.x,e.y));
    const legal=wave.every(e=>walkableCell(Math.floor(e.x),Math.floor(e.y))&&dist(e.x,e.y,player.x,player.y)>3.5&&dist(e.x,e.y,challenge.x,challenge.y)<8&&weaponPickups.every(w=>dist(Math.floor(e.x),Math.floor(e.y),w.x,w.y)>2.6));
    // Keep the complete initial wave alive: real movement/attacks must bring it into the encounter.
    enemies=wave;let stayedReachable=true,allChasing=true;
    for(let n=0;n<1500;n++){
      damageCooldown=999;updateEnemies(.02,5000+n*20);
      stayedReachable&&=wave.every(e=>navigation.distanceAt(e.x,e.y)>=0&&navigation.distanceAt(e.x,e.y)<=10&&dist(e.x,e.y,player.x,player.y)<13);
      allChasing&&=wave.every(e=>e.chase);
    }
    ({initial,legal,stayedReachable,allChasing,alive:wave.every(e=>e.alive),final:wave.map(e=>navigation.distanceAt(e.x,e.y))});
  `);
  assert.ok(result.initial.length > 0);
  assert.ok(result.initial.every(d => d >= 4 && d <= 10), `initial route lengths: ${result.initial}`);
  assert.ok(result.legal);assert.ok(result.alive);assert.ok(result.stayedReachable);assert.ok(result.allChasing);
  assert.ok(result.final.every(d => d <= 4), `enemies must arrive within attack range: ${result.final}`);
});

test('ritual return, cap and no-floor guidance survives the normal hint refresh', async () => {
  const game = await createGameHarness();
  const result = game.run(`
    newGame(true);challenge.active=true;player.x=challenge.x+30;player.y=challenge.y;
    updateChallenge();updateInteractionHint();const away=interactionHint;
    player.x=challenge.x;player.y=challenge.y;
    enemies=Array.from({length:160},()=>createEnemy('zombie',player.x+4,player.y,1));
    updateChallenge();updateInteractionHint();const capped=interactionHint;
    enemies=[];maze=Array.from({length:rows},()=>Array(cols).fill(1));
    maze[Math.floor(player.y)][Math.floor(player.x)]=0;
    updateChallenge();updateInteractionHint();({away,capped,noFloor:interactionHint,wave:challenge.wave});
  `);
  assert.match(result.away,/APROXIME/);assert.match(result.capped,/ELIMINE/);
  assert.match(result.noFloor,/MOVA|ESPAÇO|ESPACO/);assert.equal(result.wave,0);
});

test('equipping and unequipping preserve the same collection item focus before returning to canvas', async () => {
  const game=await createGameHarness();
  const result=game.run(`
    newGame(true);unlockEquipment(collection,'head-common');toggleCollection(true);
    const index=ITEM_CATALOG.findIndex(item=>item.id==='head-common');
    let button=collectionItems.children[index];button.focus();button.listeners.click[0]();
    const equipped=collection.equipped.head,focusedAfterEquip=document.activeElement===collectionItems.children[index];
    button=collectionItems.children[index];button.listeners.click[0]();
    const focusedAfterUnequip=document.activeElement===collectionItems.children[index],unequipped=collection.equipped.head;
    toggleCollection(false);({equipped,unequipped,focusedAfterEquip,focusedAfterUnequip,canvasFocused:document.activeElement===canvas});
  `);
  assert.equal(result.equipped,'head-common');assert.equal(result.unequipped,null);
  assert.ok(result.focusedAfterEquip);assert.ok(result.focusedAfterUnequip);assert.ok(result.canvasFocused);
});

function canvasContext() {
  const calls=[],stack=[];
  return new Proxy({calls,fillStyle:'',strokeStyle:'',globalAlpha:1,
    save(){stack.push({fillStyle:this.fillStyle,strokeStyle:this.strokeStyle,globalAlpha:this.globalAlpha});},
    restore(){Object.assign(this,stack.pop());},
    measureText:text=>({width:String(text).length*7}),
    createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})
  },{get(target,key){return key in target?target[key]:(...args)=>calls.push({op:key,args,color:target.fillStyle,alpha:target.globalAlpha});}});
}

test('reduced motion bounds combat spray while retaining damage, attack and reload cues', () => {
  const ctx=canvasContext();
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>canvasContext()})};
  globalThis.window={devicePixelRatio:1};globalThis.Image=class {complete=false;};
  const marker='rgb(249, 33, 77)';
  const state={maze:Array.from({length:9},(_,y)=>Array.from({length:9},(_,x)=>x===0||y===0||x===8||y===8?1:0)),cols:9,rows:9,
    player:{x:4.5,y:4.5,angle:0,moving:false},exit:{x:7,y:7},coins:[],weaponPickups:[],lootPickups:[],secretDoors:[],bullets:[],hostileBullets:[],
    particles:Array.from({length:220},()=>({x:4.5,y:4.5,life:1,maxLife:1,color:marker,size:.05})),
    enemies:[{type:'zombie',zombie:true,x:4,y:4,alive:true,angle:0,attackAim:.8,attackMode:'shoot',attackAnim:.4,attackMax:.5}],
    floatingTexts:[{x:4,y:4,text:'37',life:1,maxLife:1}],hitFlash:.2,currentWeapon:'pistol',fireAnim:.1,reloadTimer:.5,reloadDuration:1,reducedMotion:false,graphicsQuality:'high'};
  const renderer=createRenderer({canvas:{getContext:()=>ctx},canvasWrap:{getBoundingClientRect:()=>({width:640,height:480})},getState:()=>state});
  renderer.resizeCanvas();renderer.draw(1000);
  const draw=()=>{ctx.calls.length=0;renderer.draw(1000);return ctx.calls.filter(c=>c.op==='fillRect'&&c.color===marker).length;};
  assert.equal(draw(),180);state.graphicsQuality='low';assert.equal(draw(),70);
  state.reducedMotion=true;const reduced=draw();
  assert.ok(reduced>0&&reduced<=12,`reduced combat spray drawn: ${reduced}`);
  assert.ok(ctx.calls.some(c=>c.op==='fillText'&&c.args[0]==='37'),'damage numbers remain');
  assert.ok(ctx.calls.some(c=>c.op==='fillText'&&/50%/.test(c.args[0])),'reload progress remains');
  assert.ok(ctx.calls.some(c=>c.op==='arc'&&c.color==='#d35737'),'enemy attack cone remains');
  assert.ok(ctx.calls.some(c=>c.op==='fillRect'&&String(c.color).startsWith('rgba(180,20,10,')),'player damage flash remains');
});

test('actual frame stops bullets and ritual rewards after a lethal enemy attack', async () => {
  const game=await createGameHarness();
  const result=game.run(`
    newGame(true);maze=Array.from({length:9},(_,y)=>Array.from({length:9},(_,x)=>x===0||y===0||x===8||y===8?1:0));cols=rows=9;
    player={x:4.5,y:4.5,angle:0};exit={x:7,y:7};coins=[];lootPickups=[];weaponPickups=[];secretDoors=[];
    navigation=createDistanceField(cols,rows,walkableCell);navigationDirty=true;
    const attacker=createEnemy('zombie',4.8,4.5,1,()=>.5);attacker.hp=1;attacker.damage=100;
    attacker.attackAnim=.001;attacker.attackMode='melee';attacker.attackHit=false;attacker.attackAim=Math.PI;
    enemies=[attacker];health=1;damageCooldown=0;scoreState.score=0;
    bullets=[{x:4.8,y:4.5,vx:0,vy:0,remainingRange:10,bounces:0,maxBounces:1,damage:100,color:'#fff'}];
    hostileBullets=[{x:2.5,y:2.5,vx:1,vy:0,life:1,damage:2}];
    challenge={id:'last-wave',x:4.5,y:4.5,active:true,completed:false,wave:3,totalWaves:3,remaining:0};
    titleScreen.classList.add('is-hidden');startOverlay.classList.add('hidden');lastFrame=5000;frame(5020);
    ({dead,running,kills,score:scoreState.score,death:$('deathScore').textContent,alive:attacker.alive,
      shots:bullets.length,hostileX:hostileBullets[0].x,completed:challenge.completed});
  `);
  assert.ok(result.dead);assert.equal(result.running,false);assert.equal(result.kills,0);
  assert.equal(result.score,0);assert.match(result.death,/^0 PONTOS/);assert.ok(result.alive);
  assert.equal(result.shots,1);assert.equal(result.hostileX,2.5);assert.equal(result.completed,false);
});

test('actual frame cannot complete the last ritual wave after a lethal hostile shot', async () => {
  const game=await createGameHarness();
  const result=game.run(`
    newGame(true);player.x=challenge.x;player.y=challenge.y;health=1;damageCooldown=0;
    challenge.active=true;challenge.wave=3;enemies=[];bullets=[];coins=[];lootPickups=[];weaponPickups=[];
    hostileBullets=[{x:player.x,y:player.y,vx:0,vy:0,life:1,damage:100}];scoreState.score=0;
    titleScreen.classList.add('is-hidden');startOverlay.classList.add('hidden');lastFrame=5000;frame(5020);
    ({dead,score:scoreState.score,completed:challenge.completed,death:$('deathScore').textContent});
  `);
  assert.ok(result.dead);assert.equal(result.score,0);assert.equal(result.completed,false);assert.match(result.death,/^0 PONTOS/);
});
