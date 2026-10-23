// Optional benchmark tool; no browser automation dependency is shipped at runtime.
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE || 'puppeteer');
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const generatorURL = process.argv[4] ? pathToFileURL(resolve(process.argv[4], 'maze-generator.js')).href : new URL('../maze-generator.js', import.meta.url).href;
const { makeMaze, widenMaze } = await import(generatorURL);
import {writeFile} from 'node:fs/promises';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_BIN || undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const scenarios=[{name:'normal-stage3',width:47,height:33,stage:3},{name:'hard-stage8',width:77,height:51,stage:8}];
const originalRandom=Math.random;
for(const scenario of scenarios){let seed=30419;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};const wide=widenMaze(makeMaze(scenario.width,scenario.height,scenario.stage));Math.random=originalRandom;scenario.maze=Array.from({length:wide.length+12},()=>Array(wide[0].length+12).fill(1));wide.forEach((row,y)=>row.forEach((cell,x)=>scenario.maze[y+6][x+6]=cell));}
const port=Number(process.argv[2]||8081),mode=process.argv[3]||'baseline';
const results=[];
for(const scenario of scenarios){const page=await browser.newPage();await page.setViewport({width:1440,height:900,deviceScaleFactor:1});await page.setRequestInterception(true);page.on('request',req=>req.url().endsWith('/game.js')?req.respond({status:200,contentType:'application/javascript',body:''}):req.continue());await page.goto(`http://127.0.0.1:${port}`,{waitUntil:'networkidle0'});
const result=await page.evaluate(async ({maze,stage,name,mode})=>{document.body.innerHTML='';const {createRenderer}=await import('./renderer.js');const canvas=document.createElement('canvas');document.body.append(canvas);const rows=maze.length,cols=maze[0].length;const start={x:8.5,y:8.5,angle:.4,moving:false};let room=start;outer:for(let y=8;y<rows-8;y++)for(let x=8;x<cols-8;x++)if(maze[y][x]===3){room={x:x+.5,y:y+.5,angle:.4,moving:false};break outer;}
const state={maze,rows,cols,player:{...room},exit:{x:cols-9,y:rows-9},coins:[],weaponPickups:[],lootPickups:[],secretDoors:[],enemies:[],bullets:[],hostileBullets:[],particles:[],floatingTexts:[],pickupToast:'',pickupToastUntil:0,hitFlash:0,hasKey:false,objectiveText:'Encontre a chave',showMap:false,brightness:.5,reducedMotion:false,graphicsQuality:mode.includes('low')?'low':'high'};
const wrap={getBoundingClientRect:()=>({width:1440,height:900})};const r=createRenderer({canvas,canvasWrap:wrap,getState:()=>state});r.resizeCanvas();
const sample=async(pressure)=>{state.bullets=pressure?Array.from({length:24},(_,i)=>({x:room.x+Math.cos(i)*2,y:room.y+Math.sin(i)*2,vx:5,vy:0,damage:25,color:'#ffd88a'})):[];const timings=[];for(let i=0;i<110;i++){await new Promise(requestAnimationFrame);const t=performance.now();r.draw(10000+i*16.667);const duration=performance.now()-t;if(i>=15)timings.push(duration);}const sorted=timings.slice().sort((a,b)=>a-b);return {median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],mean:timings.reduce((a,b)=>a+b,0)/timings.length};};
const idle=await sample(false),projectiles=await sample(true);return {name,mode,viewport:'1440x900 DPR1',cells:`${cols}x${rows}`,idle,projectiles,metrics:r.getMetrics?.()||null};},{...scenario,mode});results.push(result);console.log(JSON.stringify(result));await page.screenshot({path:`/tmp/ultima-${mode}-${scenario.name}.png`});await page.close();}
await browser.close();await writeFile(`/tmp/ultima-benchmark-${mode}.json`,JSON.stringify(results,null,2));
