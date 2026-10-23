import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import * as config from '../../config.js';
import * as maze from '../../maze-generator.js';
import * as enemies from '../../enemy-types.js';
import * as combat from '../../combat-difficulty.js';
import * as pathfinding from '../../pathfinding.js';
import * as saves from '../../save-system.js';

// The actual game runs unchanged apart from replacing external browser surfaces.
// Evaluation access is injected into the test copy, never into shipped code.
class Element {
  constructor(id = '', ownerDocument = null) {
    this.ownerDocument=ownerDocument;this.parentElement=null;
    this.id=id; this.children=[]; this.listeners={}; this.dataset={}; this.style={};
    this.value=id==='difficultySelect'||id==='combatDifficultySelect'?'normal':'.5';
    this.textContent=''; this.innerHTML=''; this.disabled=false; this.checked=false;
    this.classes=new Set(['hidden']);
    this.classList={contains:x=>this.classes.has(x),add:(...x)=>x.forEach(v=>this.classes.add(v)),remove:(...x)=>x.forEach(v=>this.classes.delete(v)),toggle:(x,on)=>{const yes=on??!this.classes.has(x);yes?this.classes.add(x):this.classes.delete(x);return yes;}};
  }
  addEventListener(name, fn){(this.listeners[name]??=[]).push(fn);}
  setAttribute(name,value){this[name]=value;}
  removeAttribute(name){delete this[name];}
  focus(){if(!this.disabled){this.focused=true;if(this.ownerDocument)this.ownerDocument.activeElement=this;}}
  contains(element){return element===this||this.children.some(child=>child.contains(element));}
  append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}
  appendChild(child){this.append(child);return child;}
  replaceChildren(...children){if(this.children.some(child=>child.contains(this.ownerDocument?.activeElement)))this.ownerDocument.activeElement=this.ownerDocument.body;for(const child of this.children)child.parentElement=null;this.children=[];this.append(...children);}
  querySelector(){return new Element();}
  querySelectorAll(){return [];}
  insertAdjacentElement(){}
  getContext(){return new Proxy({}, {get:(_,name)=>name==='measureText'?()=>({width:10}):()=>{}});}
  getClientRects(){return [1];}
}

export async function createGameHarness() {
  const source=await readFile(new URL('../../game.js',import.meta.url),'utf8');
  const progression=await import('../../progression.js').catch(()=>({}));
  const elements=new Map();
  const getElement=id=>{if(!elements.has(id))elements.set(id,new Element(id,document));return elements.get(id);};
  const data=new Map();
  const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
  let saved=null;
  const document={getElementById:getElement,querySelector:()=>getElement('appShell'),querySelectorAll:()=>[],createElement:()=>new Element('',document),addEventListener(){},body:new Element('body'),hidden:false};
  document.body.ownerDocument=document;document.activeElement=document.body;
  const context=vm.createContext({
    ...config,...maze,...enemies,...combat,...pathfinding,...saves,...progression,
    console,structuredClone,document,localStorage:storage,performance:{now:()=>5000},Math:Object.assign(Object.create(Math),{random:maze.createSeededRandom(77)}),
    window:{addEventListener(){},devicePixelRatio:1},requestAnimationFrame(){},setTimeout(){},
    getComputedStyle:()=>({visibility:'visible'}),
    drawTraveler(){},createHUD:()=>({updateHealth(){},updateAmmo(){}}),
    createAudioPlayer:()=>({tone(){},setVolume(){},setThreat(){}}),
    createTitleScene:()=>({setActive(){},setReducedMotion(){}}),
    createRenderer:()=>({resizeCanvas(){},draw(){},getMetrics:()=>({quality:'high',renderMs:0}),pointerWorld:()=>({worldX:10,worldY:10,active:true})}),
    loadCampaignSave:()=>saved,saveCampaign:value=>{saved=structuredClone(value);return true;},clearCampaignSave:()=>{saved=null;},
    loadSettings:()=>({sound:false,brightness:.5,reducedMotion:false}),saveSettings(){},
  });
  context.makeMaze=(width,height,stage,random)=>maze.makeMaze(width,height,stage,random??context.Math.random);
  const script=source.replace(/^import .*;\r?\n/gm,'').replace(/\}\)\(\);\s*$/,'globalThis.__runGame = code => eval(code);\n})();');
  vm.runInContext(script,context);
  return {run:code=>context.__runGame(code),elements,storage,checkpoint:()=>saved};
}
