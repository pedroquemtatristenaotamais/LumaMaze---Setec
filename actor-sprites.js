// Shared Canvas actors for the world and collection preview. All time is seconds.
// Colors come from the original renderer; equipment changes shape, never rarity hue.
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const TAU = Math.PI * 2;
function rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function polygon(ctx, points, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
  ctx.closePath(); ctx.fill();
}

function drawEquipment(ctx, equipment) {
  const { head, body, charm } = equipment;
  if (body) {
    if (body === 'cloak') polygon(ctx, [[-.2,-.04],[-.28,.5],[.04,.39],[.25,.5],[.17,-.04]], '#483c30');
    else {
      rect(ctx,-.2,-.02,.4,.33, body === 'vest' ? '#73502d' : '#675039');
      rect(ctx,-.17,0,.34,.045,'#d7c69b'); rect(ctx,-.14,.1,.28,.035,'#b89a69');
      if (body === 'royalArmor') {
        rect(ctx,-.27,-.05,.18,.12,'#d7c69b');rect(ctx,.09,-.05,.18,.12,'#d7c69b');
        polygon(ctx,[[0,.02],[.09,.11],[0,.22],[-.09,.11]],'#e3ba76');
      }
    }
  }
  if (charm === 'satchel' || charm === 'standard') {
    rect(ctx,-.26,.11,.15,.25,'#73502d');rect(ctx,-.25,.12,.13,.055,'#d7c69b');
    if (charm === 'standard') {
      rect(ctx,-.26,-.48,.035,.68,'#b89a69');
      polygon(ctx,[[-.225,-.47],[-.04,-.42],[-.225,-.24]],'#9b3429');
    }
  } else if (charm) {
    rect(ctx,-.075,.04,.15,.025,'#b89a69');
    polygon(ctx,[[0,.06],[.065,.13],[0,.21],[-.065,.13]],charm === 'ember' ? '#ffac54' : '#e3ba76');
  }
  // The original hat remains the unequipped traveler silhouette.
  if (head === 'hood') {
    polygon(ctx,[[-.2,-.17],[-.17,-.46],[.14,-.46],[.21,-.17],[.12,-.12],[.1,-.32],[-.1,-.32],[-.11,-.12]],'#483c30');
  } else if (head === 'crown') {
    polygon(ctx,[[-.19,-.35],[-.21,-.54],[-.1,-.45],[0,-.58],[.1,-.45],[.21,-.54],[.19,-.35]],'#e3ba76');
    rect(ctx,-.17,-.37,.34,.055,'#d7c69b');
  } else if (head === 'boneMask') {
    rect(ctx,-.15,-.34,.3,.19,'#d9c8aa');
    rect(ctx,-.11,-.3,.065,.05,'#211912');rect(ctx,.045,-.3,.065,.05,'#211912');
    rect(ctx,-.06,-.2,.12,.03,'#483c30');
  } else if (head) {
    rect(ctx,-.18,-.47,.36,.2,'#675039');rect(ctx,-.21,-.33,.42,.065,'#d7c69b');
    rect(ctx,-.025,-.32,.05,.17,'#b89a69');
  }
}

/** Draw a traveler in screen pixels; returns screen-space muzzle/torch anchors.
 * The muzzle remains x/y + aim * .48 tiles (also while recoiling/reloading).
 * weapon accepts a weapon id or {id}. equipment values are catalog style ids.
 */
export function drawTraveler(ctx, options = {}) {
  const x = finite(options.x), y = finite(options.y), tile = Math.max(1, finite(options.tile, 48));
  const time = finite(options.time), angle = finite(options.angle), reduced = !!options.reducedMotion;
  const weapon = typeof options.weapon === 'object' ? options.weapon?.id : options.weapon;
  const fire = clamp(finite(options.fireAnim) / .14);
  const reloading = finite(options.reloadTimer) > 0;
  const reload = reloading ? clamp(1 - options.reloadTimer / Math.max(.01, finite(options.reloadDuration, 1))) : 0;
  const bob = reduced ? 0 : Math.sin(time * (options.moving ? 18 : 3.8)) * (options.moving ? .025 : .008);
  const stride = reduced || !options.moving ? 0 : Math.sin(time * 18) * .045;
  const muzzle = { x: x + Math.cos(angle) * tile * .48, y: y + Math.sin(angle) * tile * .48 };
  const torch = { x:x-tile*.34, y:y-tile*.27 };

  ctx.save(); ctx.translate(x, y); ctx.scale(tile, tile);
  ctx.fillStyle='rgba(0,0,0,.72)';ctx.beginPath();ctx.ellipse(0,.26,.27,.10,0,0,TAU);ctx.fill();
  ctx.translate(0,bob);
  rect(ctx,-.17,.04,.34,.36,'#211912');rect(ctx,-.2,.09,.4,.24,'#35271b');
  rect(ctx,-.15,.35+stride,.11,.17,'#15110d');rect(ctx,.04,.35-stride,.11,.17,'#15110d');
  rect(ctx,-.17,.47+stride,.14,.05,'#483c30');rect(ctx,.04,.47-stride,.14,.05,'#483c30');
  rect(ctx,-.115,-.26,.23,.26,'#73502d');rect(ctx,-.15,-.34,.3,.12,'#37271b');
  rect(ctx,-.11,-.43,.22,.14,'#80603b');rect(ctx,-.18,-.36,.36,.055,'#171511');
  rect(ctx,-.075,-.25,.035,.035,'#dcb77b');rect(ctx,.06,-.25,.035,.035,'#dcb77b');
  rect(ctx,-.15,.27,.3,.05,'#7b4727');rect(ctx,-.025,.27,.05,.055,'#d7c69b');
  drawEquipment(ctx, options.equipment || {});
  ctx.restore();

  // The torso faces the screen. Its free hand and torch stay to screen left,
  // leaving the face/headwear clear while the gun follows the aim independently.
  ctx.save();ctx.translate(x,y);ctx.scale(tile,tile);
  rect(ctx,-.34,.095,.22,.075,'#35271b');rect(ctx,-.37,-.27,.065,.5,'#7b4727');
  rect(ctx,-.39,.08,.1,.085,'#dcb77b');rect(ctx,-.395,-.3,.11,.045,'#c39457');
  const flicker = reduced ? 0 : Math.sin(time*24)*.018;
  polygon(ctx,[[-.39,-.3],[-.425,-.39],[-.37,-.45-flicker],[-.35,-.55],[-.31,-.42],[-.265,-.38],[-.29,-.3]],'#ffac54');
  polygon(ctx,[[-.37,-.3],[-.375,-.38],[-.33,-.46],[-.30,-.33]],'#ffe6a0');
  ctx.restore();

  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(tile,tile);

  if (!['pistol','shotgun','ak'].includes(weapon)) {
    rect(ctx,-.14,.11,.22,.075,'#35271b');rect(ctx,.055,.11,.08,.075,'#dcb77b');
    ctx.restore();return { muzzle, torch };
  }

  const recoil = reduced ? 0 : fire * .045;
  const dip = reduced ? 0 : reloading ? Math.sin(reload*Math.PI)*.09 : 0;
  ctx.save();ctx.translate(-recoil,dip);
  rect(ctx,-.04,.065,.24,.09,'#35271b');
  if (!reloading) rect(ctx,.14,.055,.105,.095,'#dcb77b');
  if (weapon === 'shotgun') {
    rect(ctx,-.18,-.025,.2,.12,'#73502d');rect(ctx,-.19,.025,.10,.105,'#7b4727');
    rect(ctx,-.02,-.045,.47,.11,'#675039');rect(ctx,.08,.05,.19,.065,'#7b4727');
    rect(ctx,.27,-.05,.21,.035,'#d7c69b');rect(ctx,.27,.01,.21,.025,'#b89a69');
  } else if (weapon === 'ak') {
    polygon(ctx,[[-.2,-.05],[-.04,-.02],[-.04,.1],[-.2,.15]],'#73502d');
    rect(ctx,-.025,-.06,.3,.13,'#675039');rect(ctx,.24,-.045,.24,.065,'#d7c69b');
    rect(ctx,.25,.025,.12,.055,'#7b4727');rect(ctx,.07,.07,.06,.14,'#483c30');
    polygon(ctx,[[.16,.06],[.23,.055],[.26,.22],[.19,.25],[.17,.15]],'#b89a69');
    rect(ctx,.25,-.11,.045,.06,'#483c30');
  } else {
    rect(ctx,.12,-.055,.36,.10,'#675039');rect(ctx,.16,-.075,.27,.04,'#d7c69b');
    polygon(ctx,[[.16,.04],[.26,.04],[.22,.21],[.13,.18]],'#7b4727');
    rect(ctx,.20,-.105,.035,.045,'#483c30');rect(ctx,.43,-.08,.025,.04,'#d7c69b');
    if (!reloading) rect(ctx,.12,.085,.10,.09,'#dcb77b');
  }
  // Barrel cap stays at the projectile origin as the receiver recoils behind it.
  rect(ctx,.45+recoil,-.04-dip,.03,.08,'#211912');
  if (reloading) {
    const reach = reduced ? 0 : Math.sin(reload * Math.PI) * .08;
    rect(ctx,.08+reach,.12,.09,.09,'#dcb77b');
    if (weapon === 'shotgun') {
      rect(ctx,.10+reach,.1,.07,.045,'#e3ba76');rect(ctx,.14+reach,.1,.025,.045,'#9b3429');
    } else {
      const gap = reduced ? .11 : .11 + Math.sin(reload*Math.PI)*.14;
      rect(ctx,.15,gap,.075,.13, reload < .5 ? '#483c30' : '#b89a69');
    }
  }
  ctx.restore();ctx.restore();

  if (fire > 0) {
    ctx.save();ctx.translate(muzzle.x,muzzle.y);ctx.rotate(angle);ctx.scale(tile,tile);
    if (fire > .38) {
      polygon(ctx,[[0,-.035],[.12,-.085],[.08,-.025],[.23,0],[.09,.04],[.12,.09],[0,.035]],'#ffac54');
      polygon(ctx,[[0,-.025],[.13,0],[0,.025]],'#ffe6a0');
    }
    if (!reduced) {
      ctx.globalAlpha = fire*.48;
      rect(ctx,.05+(1-fire)*.18,-.09-(1-fire)*.12,.09,.06,'#ccb998');
      ctx.globalAlpha = fire;
      ctx.save();ctx.translate(-.23,-.09-(1-fire)*.2);ctx.rotate((1-fire)*3);
      rect(ctx,0,0,.055,.025,'#d7c69b');ctx.restore();
    }
    ctx.restore();
  }
  if (reloading) {
    ctx.save();ctx.translate(x,y+tile*.68);
    rect(ctx,-tile*.31,0,tile*.62,Math.max(3,tile*.055),'#211912');
    rect(ctx,-tile*.3,1,tile*.6*reload,Math.max(1,tile*.055-2),'#e3ba76');
    ctx.font=`bold ${Math.max(9,tile*.14)}px monospace`;ctx.textAlign='center';ctx.fillStyle='#ddc49a';
    ctx.fillText(`${Math.round(reload*100)}%`,0,tile*.22);ctx.restore();
  }
  return { muzzle, torch };
}

/** Species-specific death effects continue after alive becomes false. */
export function drawEnemyRemains(ctx, { enemy, x, y, tile, reducedMotion = false }) {
  if (enemy.alive) return false;
  if (!(enemy.deathLife > 0)) return true;
  const remaining = clamp(enemy.deathLife / Math.max(.01, enemy.deathMax || .6));
  const progress = 1-remaining, t = tile*(enemy.scale || 1), angle = finite(enemy.hitAngle, finite(enemy.angle));
  const spectral = enemy.type === 'wraith' || enemy.type === 'cryptLord';
  const zombie = enemy.zombie || ['zombie','feral','spitter','plagueBoss'].includes(enemy.type);
  ctx.save();ctx.translate(x,y);ctx.globalAlpha=remaining;
  const drift = reducedMotion ? 0 : progress*t*.16;
  ctx.translate(Math.cos(angle)*drift,Math.sin(angle)*drift);
  if (spectral) {
    for (let i=0;i<5;i++) {
      const spread = reducedMotion ? .06 : progress*.19;
      rect(ctx,(i-2)*t*spread,-t*.3+progress*t*.2+i%2*t*.09,t*.07,t*(.28-progress*.18),'#dcc28d');
    }
  } else if (zombie) {
    ctx.scale(1, reducedMotion ? .55 : 1-progress*.65);
    rect(ctx,-t*.24,-t*.14,t*.48,t*.38,'#664637');
    rect(ctx,-t*.15,-t*.33+progress*t*.23,t*.3,t*.22,'#73583f');
    rect(ctx,-t*.32,t*.15,t*.25,t*.08,'#483c30');rect(ctx,t*.1,t*.13,t*.25,t*.09,'#73502d');
    rect(ctx,-t*.20,t*.24,t*(.4+progress*.13),t*.04,'#5a201a');
  } else {
    for (let i=0;i<7;i++) {
      const a=i*2.4, distance=t*(.08+(reducedMotion ? .06 : progress*.28));
      ctx.save();ctx.translate(Math.cos(a)*distance, t*.12+Math.sin(a)*distance*.5);
      if (!reducedMotion) ctx.rotate(progress*(i%2 ? 1 : -1));
      rect(ctx,-t*.075,-t*.025,t*.15,t*.05,'#d9c8aa');ctx.restore();
    }
    rect(ctx,-t*.1,-t*.12+progress*t*.22,t*.2,t*.15,'#d9c8aa');
  }
  ctx.restore();return true;
}

/** New families and the three landmark bosses. Legacy skeletons use renderer. */
export function drawEnemySprite(ctx, { enemy, x, y, tile, time = 0, reducedMotion = false }) {
  if (drawEnemyRemains(ctx,{enemy,x,y,tile,reducedMotion})) return;
  const type = enemy.type, boss = !!enemy.boss, t = tile*(enemy.scale || 1);
  const flash = enemy.flash > 0, attacking = enemy.attackAnim > 0;
  const attack = attacking ? Math.sin(clamp(1-enemy.attackAnim/Math.max(.01,enemy.attackMax || .6))*Math.PI) : 0;
  const stride = reducedMotion ? 0 : Math.sin(finite(enemy.stepPhase))*t*.045;
  const hit = reducedMotion || !flash ? 0 : Math.min(.08,enemy.flash)*t*.45;
  const hitAngle = finite(enemy.hitAngle), dx = Math.cos(finite(enemy.angle)), dy = Math.sin(finite(enemy.angle));
  ctx.save();ctx.translate(x+Math.cos(hitAngle)*hit,y+Math.sin(hitAngle)*hit);ctx.scale(t,t);
  ctx.fillStyle='rgba(0,0,0,.7)';ctx.beginPath();ctx.ellipse(0,.27,boss?.42:.27,.1,0,0,TAU);ctx.fill();
  if (boss) {
    ctx.save();ctx.globalAlpha=.4;ctx.strokeStyle=enemy.bossPhase > 1 ? '#ffac54' : '#9b3429';ctx.lineWidth=.025;
    ctx.beginPath();ctx.ellipse(0,.21,.48,.22,0,0,TAU);ctx.stroke();ctx.restore();
  }
  const bone = flash ? '#fff0d6' : '#d9c8aa';
  const skin = flash ? '#fff0d6' : type === 'spitter' || type === 'plagueBoss' ? '#9b8154' : '#73583f';
  if (type === 'guardian' || type === 'cryptLord') {
    if (type === 'cryptLord') polygon(ctx,[[-.31,-.2],[-.43,.41],[-.15,.29],[0,.48],[.15,.29],[.43,.41],[.31,-.2]],'#483c30');
    rect(ctx,-.12,.1,.07,.23+stride/t,bone);rect(ctx,.05,.1,.07,.23-stride/t,bone);
    rect(ctx,-.045,-.15,.09,.39,bone);
    for(let i=0;i<4;i++) rect(ctx,-.22+i*.013,-.1+i*.075,.44-i*.026,.035,bone);
    rect(ctx,-.3,-.16,.17,.11,'#675039');rect(ctx,.13,-.16,.17,.11,'#675039');
    polygon(ctx,[[-.34,-.16],[-.29,-.34],[-.21,-.15]],bone);
    polygon(ctx,[[.20,-.15],[.29,-.34],[.34,-.16]],bone);
    rect(ctx,-.15,-.4,.3,.23,bone);rect(ctx,-.1,-.46,.2,.07,bone);
    rect(ctx,-.11,-.34,.07,.06,'#211912');rect(ctx,.04,-.34,.07,.06,'#211912');
    if(type === 'cryptLord') {
      polygon(ctx,[[-.18,-.43],[-.21,-.65],[-.09,-.54],[0,-.7],[.09,-.54],[.21,-.65],[.18,-.43]],'#e3ba76');
      rect(ctx,.36,-.41,.035,.86,'#b89a69');
      polygon(ctx,[[.37,-.6],[.47,-.46],[.37,-.33],[.27,-.46]],'#e6b964');
    } else {
      rect(ctx,.27,-.02,.055,.49,'#73502d');
      polygon(ctx,[[.29,-.2],[.5,-.1],[.5,.09],[.29,.15]],'#d7c69b');
    }
  } else {
    const feral = type === 'feral', plague = type === 'plagueBoss';
    const width = plague ? .64 : feral ? .32 : type === 'spitter' ? .48 : .41;
    rect(ctx,-.17,.18,.12,.23+stride/t,'#302d25');rect(ctx,.05,.18,.12,.23-stride/t,'#302d25');
    polygon(ctx,[[-width/2,-.19],[-width/2-.035,.23],[width/2,.28],[width/2,-.12]],plague ? '#664637' : '#483c30');
    rect(ctx,-width*.39,-.08,width*.78,.15,skin);
    rect(ctx,-.075,.04,.11,.07,'#5a201a');rect(ctx,.08,.14,.09,.07,'#73502d');
    if (type === 'spitter' || plague) {
      ctx.fillStyle=skin;ctx.beginPath();ctx.ellipse(.04,.08,plague?.25:.18,plague?.24:.17,0,0,TAU);ctx.fill();
      for(let i=0;i<(plague?6:3);i++) rect(ctx,-.17+(i%3)*.12,-.02+Math.floor(i/3)*.15,.055,.055,'#c39457');
    }
    const headX=feral?.12:plague?-.06:.015;
    rect(ctx,headX-.14,-.38,.28,.23,skin);rect(ctx,headX-.16,-.4,.29,.065,'#37271b');
    rect(ctx,headX-.1,-.31,.06,.04,'#211912');rect(ctx,headX+.045,-.3,.055,.04,'#d04430');
    rect(ctx,headX-.07,-.22,.18,feral?.065:.045,'#211912');
    rect(ctx,headX-.055,-.215,.11,.022,'#d9c8aa');
    if(feral) {
      polygon(ctx,[[-.14,-.35],[-.2,-.48],[-.07,-.4],[0,-.49],[.04,-.35]],'#37271b');
      rect(ctx,-.22,.27,.22,.045,'#73502d');rect(ctx,.09,.27,.22,.045,'#73502d');
    }
    if(plague) {
      rect(ctx,-.4,-.17,.21,.19,'#675039');rect(ctx,.19,-.17,.21,.19,'#675039');
      rect(ctx,-.26,-.49,.05,.13,'#b89a69');rect(ctx,.12,-.44,.06,.11,'#b89a69');
    }
  }
  const reach = .16+(reducedMotion ? .10 : attack*.23);
  ctx.strokeStyle=type === 'guardian' || type === 'cryptLord' ? bone : skin;ctx.lineWidth=.065;
  ctx.beginPath();ctx.moveTo(-.2,-.09);ctx.lineTo(-.24+dx*reach,-.03+dy*reach);
  ctx.moveTo(.2,-.09);ctx.lineTo(.24+dx*reach,-.03+dy*reach);ctx.stroke();
  // Attack hand/claws retain a readable silhouette at all scales.
  rect(ctx,.22+dx*reach,-.055+dy*reach,.07,.075,type==='feral'?'#d9c8aa':skin);
  if (flash) {
    ctx.save();ctx.rotate(hitAngle);rect(ctx,-.32,-.07,.11,.025,'#fff0d6');rect(ctx,-.35,.04,.12,.025,'#e3ba76');ctx.restore();
  }
  if(boss && enemy.bossPhase > 1) {
    rect(ctx,-.08,-.31,.04,.04,'#ffac54');rect(ctx,.045,-.31,.04,.04,'#ffac54');
    rect(ctx,-.12,-.03,.025,.15,'#9b3429');rect(ctx,.1,.02,.025,.17,'#9b3429');
  }
  ctx.restore();
}
