import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameHarness } from './helpers/game-harness.js';

test('a defeated enemy awards loot and score once while its death animation remains',async()=>{
  const game=await createGameHarness();
  const result=game.run(`
    running=true; const victim=createEnemy('skeleton',10.5,10.5,1,()=>.5); enemies=[victim];
    victim.hp=0; defeatEnemy(victim); const first=scoreState.score; defeatEnemy(victim);
    ({alive:victim.alive,death:victim.deathLife,kills,first,score:scoreState.score});
  `);
  assert.equal(result.alive,false);assert.ok(result.death>0);assert.equal(result.kills,1);
  assert.ok(result.first>0);assert.equal(result.score,result.first);
});

test('opening collection blocks shooting and reloading and preserves an existing pause',async()=>{
  const game=await createGameHarness();
  const result=game.run(`
    running=true;paused=true;currentWeapon='pistol';weaponInventory.add('pistol');ammo.pistol={mag:5,reserve:10};
    toggleCollection();shoot();reload();const blocked={mag:ammo.pistol.mag,reload:reloadTimer,open:collectionOpen};
    toggleCollection();({...blocked,paused,openAfter:collectionOpen});
  `);
  assert.equal(result.open,true);assert.equal(result.mag,5);assert.equal(result.reload,0);
  assert.equal(result.openAfter,false);assert.equal(result.paused,true);
});

test('collection unlocks survive death and restarting a campaign',async()=>{
  const game=await createGameHarness();
  assert.equal(game.run(`
    unlockEquipment(collection,'head-legendary');persistCollection();running=true;gameOver();newGame(true);
    collection.unlocked.includes('head-legendary');
  `),true);
});

test('finishing and retrying restores campaign score, inventory and stage while keeping the collection',async()=>{
  const game=await createGameHarness();
  const result=game.run(`
    newGame(true);currentWeapon='pistol';weaponInventory.add('pistol');ammo.pistol={mag:6,reserve:60};awardPoints(600);
    unlockEquipment(collection,'body-rare');equipItem(collection,'body-rare');persistCollection();
    hasKey=true;finishLevel();const checkpointScore=scoreState.score;nextLevel();awardPoints(300);gameOver();retryStage();
    ({stage,score:scoreState.score,checkpointScore,weapon:currentWeapon,mag:ammo.pistol.mag,owns:weaponInventory.has('pistol'),item:collection.equipped.body,paused,running});
  `);
  assert.equal(result.stage,2);assert.equal(result.score,result.checkpointScore);assert.equal(result.weapon,'pistol');
  assert.equal(result.mag,6);assert.ok(result.owns);assert.equal(result.item,'body-rare');assert.equal(result.running,true);assert.equal(result.paused,false);
});

test('hostile projectiles travel at player-shot speeds and are stopped by walls',async()=>{
  const game=await createGameHarness();
  const result=game.run(`
    maze=['1111111111','1000000001','1111111111'].map(row=>[...row].map(Number));rows=3;cols=10;
    secretDoors=[];player={x:7.5,y:1.5};navigation=null;hostileBullets=[];
    const archer=createEnemy('archer',1.5,1.5,3,()=>.5);archer.attackAnim=.01;archer.attackMode='shoot';archer.attackAim=0;
    enemies=[archer];updateEnemies(.02,5000);const speed=Math.hypot(hostileBullets[0].vx,hostileBullets[0].vy);
    maze[1][3]=1;updateHostileBullets(.2);({speed,shots:hostileBullets.length});
  `);
  assert.ok(result.speed>=20&&result.speed<=24);assert.equal(result.shots,0);
});

test('optional vault keys and exit remain reachable while every annex is closed',async()=>{
  const game=await createGameHarness();
  for(const size of ['easy','normal','hard'])for(const level of [1,2,3,4,5,6,7,8])for(const seed of [7,77]){
    const result=game.run(`
      Math.random=createSeededRandom(${seed});difficulty='${size}';stage=${level};createLevel();
      const seen=new Set(),queue=[[Math.floor(player.x),Math.floor(player.y)]];
      for(let i=0;i<queue.length;i++){const [x,y]=queue[i],key=x+','+y;if(seen.has(key)||!walkableCell(x,y))continue;seen.add(key);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])queue.push([x+dx,y+dy]);}
      ({keys:lootPickups.filter(i=>i.type==='vaultKey').map(i=>seen.has(i.x+','+i.y)),exit:seen.has(exit.x+','+exit.y),doors:secretDoors.filter(d=>d.locked).length,altar:!!challenge,altarReachable:challenge&&seen.has(Math.floor(challenge.x)+','+Math.floor(challenge.y)),bosses:enemies.filter(e=>e.boss).length});
    `);
    assert.ok(result.exit);assert.ok(result.keys.length>0);assert.ok(result.keys.every(Boolean));
    assert.equal(result.keys.length,result.doors);assert.ok(result.altar&&result.altarReachable);
    assert.ok(result.doors<=3,'optional vault generation must stay within three locked annexes');
    assert.equal(result.bosses,[3,6,8].includes(level)?1:0);
  }
});

test('walking away from an active altar cannot skip its remaining waves',async()=>{
  const game=await createGameHarness();
  const result=game.run(`
    newGame(true);challenge.active=true;challenge.wave=1;enemies=[];
    player.x=challenge.x+30;player.y=challenge.y+30;updateChallenge();
    ({wave:challenge.wave,completed:challenge.completed,score:scoreState.score});
  `);
  assert.equal(result.wave,1);assert.equal(result.completed,false);assert.equal(result.score,0);
});

test('boss fury changes attacks and capped reinforcements spawn on valid distant floors',async()=>{
  const game=await createGameHarness();
  const result=game.run(`
    newGame(true);stage=6;const boss=createEnemy('plagueBoss',player.x+5,player.y,6,()=>.5);boss.hp=boss.maxHp*.4;boss.summonAt=1;
    enemies=[boss];const cooldown=boss.shotCooldown;updateEnemies(.02,20000);
    const summons=enemies.filter(e=>e!==boss);const valid=summons.every(e=>walkableCell(Math.floor(e.x),Math.floor(e.y))&&dist(e.x,e.y,player.x,player.y)>3.5);
    const phase=boss.bossPhase,rate=boss.shotCooldown;
    enemies=Array.from({length:160},()=>createEnemy('zombie',player.x+4,player.y,6));const full=spawnReinforcements(boss,20);
    ({phase,rate,cooldown,valid,summons:summons.length,full,count:enemies.length});
  `);
  assert.equal(result.phase,2);assert.ok(result.rate<result.cooldown);assert.ok(result.valid);
  assert.ok(result.summons>0&&result.summons<=4);assert.equal(result.full,0);assert.equal(result.count,160);
});

test('final boss death guarantees the exit key and at least epic equipment',async()=>{
  const game=await createGameHarness();
  const result=game.run(`
    newGame(true);stage=8;const boss=createEnemy('cryptLord',player.x+4,player.y,8,()=>.5);boss.dropKey=true;enemies=[boss];defeatEnemy(boss);
    ({key:lootPickups.some(item=>item.type==='key'&&!item.taken),rarity:ITEM_CATALOG.find(i=>collection.unlocked.includes(i.id)).rarity});
  `);
  assert.ok(result.key);assert.ok(['epic','legendary'].includes(result.rarity));
});

test('challenge waves respect the live cap and only give the completion reward once',async()=>{
  const game=await createGameHarness();
  const result=game.run(`
    newGame(true);player.x=challenge.x;player.y=challenge.y;tryInteract();
    let max=0;for(let n=0;n<8;n++){enemies.forEach(e=>{if(e.challengeId)e.alive=false;});updateChallenge();max=Math.max(max,enemies.filter(e=>e.alive).length);}
    const first=scoreState.score;updateChallenge();({active:challenge.active,completed:challenge.completed,first,score:scoreState.score,max});
  `);
  assert.equal(result.completed,true);assert.equal(result.active,false);assert.ok(result.first>=500);
  assert.equal(result.first,result.score);assert.ok(result.max<=160);
});
