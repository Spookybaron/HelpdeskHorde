/* Intro trailer for Helpdesk Horde: plays on its own canvas over the game, then hands back. */
(function(){
const CLIPMAP={t30:['teacher',30],t32:['teacher',32],t1:['teacher',1],t0:['teacher',0],t42:['teacher',42],t45:['teacher',45],s19:['suit',19],g1:['gran',1],b0:['boss',0]};
const cv=document.createElement('canvas'),ctx=cv.getContext('2d');
cv.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:50;display:none;touch-action:none';
document.body.appendChild(cv);
let W=0,H=0,DPR=1,F=1;
const FOV=58*Math.PI/180,NEAR=.35,TOTAL=36;
function resize(){
  DPR=Math.min(2,window.devicePixelRatio||1);W=window.innerWidth||640;H=window.innerHeight||360;
  cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);F=(H/2)/Math.tan(FOV/2);
}
window.addEventListener('resize',resize);resize();
const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,k)=>a+(b-a)*k,ease=k=>{k=clamp(k,0,1);return k*k*(3-2*k);};
const v3l=(a,b,k)=>[lerp(a[0],b[0],k),lerp(a[1],b[1],k),lerp(a[2],b[2],k)];

/* ---------- seeded randomness so every play is the same film ---------- */
let seed=1;
function rnd(){seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}
const rr=(a,b)=>a+rnd()*(b-a),pick=a=>a[Math.floor(rnd()*a.length)];

/* ---------- sprites ---------- */
const SPR={};
function spr(ch){
  let s=SPR[ch];
  if(!s){s=document.createElement('canvas');s.width=s.height=160;const c=s.getContext('2d');
    c.font='112px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(ch,80,88);SPR[ch]=s;}
  return s;
}

/* ---------- camera and projection ---------- */
const cam={pos:[0,20,0],r:[1,0,0],u:[0,0,1],f:[0,-1,0]};
function setCam(pos,tgt,upK){
  let f=[tgt[0]-pos[0],tgt[1]-pos[1],tgt[2]-pos[2]],l=Math.hypot(f[0],f[1],f[2])||1;f=[f[0]/l,f[1]/l,f[2]/l];
  let h=[0,upK,1-upK];l=Math.hypot(h[1],h[2])||1;h=[0,h[1]/l,h[2]/l];
  let r=[f[1]*h[2]-f[2]*h[1],f[2]*h[0]-f[0]*h[2],f[0]*h[1]-f[1]*h[0]];l=Math.hypot(r[0],r[1],r[2])||1;r=[r[0]/l,r[1]/l,r[2]/l];
  const u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
  cam.pos=pos;cam.f=f;cam.r=r;cam.u=u;
}
function toCam(p){const d=[p[0]-cam.pos[0],p[1]-cam.pos[1],p[2]-cam.pos[2]];
  return [d[0]*cam.r[0]+d[1]*cam.r[1]+d[2]*cam.r[2],d[0]*cam.u[0]+d[1]*cam.u[1]+d[2]*cam.u[2],d[0]*cam.f[0]+d[1]*cam.f[1]+d[2]*cam.f[2]];}
function proj(p){const c=toCam(p);if(c[2]<NEAR)return null;const s=F/c[2];return {x:W/2+c[0]*s,y:H/2-c[1]*s,s,z:c[2]};}
function line3(a,b){
  let A=toCam(a),B=toCam(b);
  if(A[2]<NEAR&&B[2]<NEAR)return;
  if(A[2]<NEAR){const k=(NEAR-A[2])/(B[2]-A[2]);A=[lerp(A[0],B[0],k),lerp(A[1],B[1],k),NEAR];}
  if(B[2]<NEAR){const k=(NEAR-B[2])/(A[2]-B[2]);B=[lerp(B[0],A[0],k),lerp(B[1],A[1],k),NEAR];}
  ctx.moveTo(W/2+A[0]*F/A[2],H/2-A[1]*F/A[2]);ctx.lineTo(W/2+B[0]*F/B[2],H/2-B[1]*F/B[2]);
}

/* ---------- the scene simulation ---------- */
const PEOPLE=['👩‍🏫','👩‍🏫','👨‍🏫','👩‍🏫','👨‍🏫','👩‍🏫','👨‍💼','👵','👩‍🏫','🧔'];
const DEVICES=['💻','🖨️','📽️','📱','💻'];
const SHOUT=['HELP!','IT\'S BROKEN!','URGENT!','HELP! HELP!','I DIDN\'T TOUCH IT!','IS THE WI-FI DOWN?','IT ATE MY REGISTER!','QUICK ONE!'];
const DONE=['Closed','Resolved','Won\'t fix','User error','Escalated','Sent a link'];
const DT=1/60;
let sim,live=false;
function resetSim(){
  seed=20261111;
  sim={t:0,en:[],em:[],fx:[],spawn:0,thr:0,lastThrow:-9,hero:null,bubT:0,pings:[]};
}
function spawnRate(t){return t<7.5?0:t<11?lerp(1.5,4,(t-7.5)/3.5):t<13.2?5:Math.min(13,7+(t-13.2)*.6);}
function stepSim(){
  const t=sim.t+=DT;
  // arrivals
  sim.spawn+=spawnRate(t)*DT;
  while(sim.spawn>=1&&sim.en.length<170){
    sim.spawn--;
    const a=rnd()<.72?rr(-1.5,1.5):rr(0,6.283),R=rr(20,27);
    let sx=Math.sin(a)*R,sz=Math.cos(a)*R;
    if(t<11){ // still top-down: walk in from just beyond the edges of the screen
      if(rnd()<.6){sx=rr(-16,16);sz=(rnd()<.65?1:-1)*rr(11.5,13);}else{sx=(rnd()<.5?1:-1)*rr(19,21);sz=rr(-9,9);}
    }
    sim.en.push({x:sx,z:sz,sp:(t<13?2.1:3.1+(t-13)*.28)*rr(.8,1.2),ring:rr(1.5,3.2),
      ch:pick(PEOPLE),dev:pick(DEVICES),ph:rr(0,6),h:1.9,bub:0,line:'',aim:false,dead:false,hero:false});
  }
  if(!sim.hero&&t>=15.2){sim.hero={x:0,z:18,sp:5.1,ring:2.6,ch:'👩‍🏫',dev:'💻',ph:0,h:3.1,bub:9,line:"THE WHITEBOARD'S GONE BLANK!",aim:false,dead:false,hero:true};sim.en.push(sim.hero);}
  for(const e of sim.en){
    const d=Math.hypot(e.x,e.z)||1;
    if(d>e.ring){const s=e.sp*DT;e.x-=e.x/d*s;e.z-=e.z/d*s;}
    e.ph+=DT*(9+e.sp);e.bub-=DT;
  }
  // frantic emailing
  if(t>=10.6&&t<24.5){
    sim.thr-=DT;
    if(sim.thr<=0){
      let best=null,bd=1e9;
      const wantHero=sim.hero&&t>16&&t<18.2&&rnd()<.55;
      if(wantHero)best=sim.hero;
      else for(const e of sim.en){if(e.aim||e.hero)continue;const d=e.x*e.x+e.z*e.z;if(d<bd&&d<17*17){bd=d;best=e;}}
      sim.thr=t<13.2?.27:t<21?.12:.085;
      if(best){
        if(!best.hero)best.aim=true;
        const d=Math.hypot(best.x,best.z);
        sim.em.push({t0:t,dur:Math.max(.12,d/30),to:best,spin:rr(-9,9),side:rr(-.6,.6)});
        sim.lastThrow=t;if(live)sfxWhoosh();
      }
    }
  }
  for(const m of sim.em){
    if(t-m.t0>=m.dur&&!m.done){
      m.done=true;const e=m.to;
      if(e.hero){sim.fx.push({x:e.x+rr(-.5,.5),y:2.2,z:e.z,vy:1.6,life:.7,txt:'Reopened',col:'#e6337a'});if(live)sfxBounce();}
      else if(!e.dead){
        e.dead=true;if(live)sfxPop();
        sim.fx.push({x:e.x,y:1.6,z:e.z,vy:1.8,life:.8,txt:pick(DONE),col:'#f4f1e6'});
        for(let i=0;i<4;i++)sim.fx.push({x:e.x,y:1,z:e.z,vx:rr(-3,3),vy:rr(2,5),vz:rr(-3,3),life:.6,ch:'🎫'});
      }
    }
  }
  sim.em=sim.em.filter(m=>!m.done);
  sim.en=sim.en.filter(e=>!e.dead);
  // chatter bubbles
  sim.bubT-=DT;
  if(sim.bubT<=0&&sim.en.length){sim.bubT=.32;const e=pick(sim.en);if(!e.hero&&e.bub<=0){e.bub=1.3;e.line=pick(SHOUT);}}
  // hair starts to go
  if(t>21.3&&t<24.5&&rnd()<.5)sim.fx.push({x:rr(-.3,.3),y:1.9,z:0,vx:rr(-4,4),vy:rr(3,7),vz:rr(-4,4),life:.7,hair:true});
  for(const f of sim.fx){f.life-=DT;f.x+=(f.vx||0)*DT;f.y+=(f.vy||0)*DT;f.z+=(f.vz||0)*DT;if(f.ch||f.hair)f.vy-=14*DT;}
  sim.fx=sim.fx.filter(f=>f.life>0);
}
const stressAt=t=>Math.pow(clamp((t-7.5)/15,0,1),1.2);

/* ---------- camera script ---------- */
const CUTS=[13.2,16,18.2,21.5];
function shot(t){
  if(t<8){const k=ease((t-3.3)/4.2),z=lerp(27,0,k),h=lerp(36,21,k);return {pos:[0,h,z],tgt:[0,0,z+.001],up:0};}
  if(t<11.2){const h=lerp(21,17,(t-8)/3.2);return {pos:[0,h,0],tgt:[0,0,.001],up:0};}
  if(t<13.2){const k=ease((t-11.2)/2);return {pos:v3l([0,17,0],[0,2.5,-7.5],k),tgt:v3l([0,0,.001],[0,1.3,6],k),up:k};}
  if(t<16){const k=(t-13.2)/2.8;return {pos:[Math.sin(t*1.3)*.5,lerp(2.5,2.0,k),lerp(-7.5,-5.2,k)],tgt:[0,1.3,6],up:1};}
  if(t<18.2){const h=sim.hero||{x:0,z:10};return {pos:[.7,1.25,.3],tgt:[h.x,1.9,h.z],up:1};}
  if(t<21.5){const a=(t-18.2)*1.7+.6;return {pos:[Math.sin(a)*9.5,4.6,Math.cos(a)*9.5],tgt:[0,1.1,0],up:1};}
  const k=clamp((t-21.5)/3,0,1);return {pos:[lerp(-1.6,.6,k),lerp(3.6,2.7,k),lerp(7.4,4.8,k)],tgt:[0,1.2,0],up:1};
}

/* ---------- drawing ---------- */
function rrect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
function fitFont(text,px,maxW,fam){ctx.font='400 '+px+'px '+fam;const w=ctx.measureText(text).width;if(w>maxW){px=px*maxW/w;ctx.font='400 '+px+'px '+fam;}return px;}
const DISPLAY='"Bowlby One","Arial Black",Impact,sans-serif',MONO='"IBM Plex Mono",ui-monospace,Menlo,monospace';
const PROPS=['🪴','🗄️','🖨️','🪑','🗑️'];
function drawWorld(t,sh){
  const st=stressAt(t),up=sh.up;
  // carpet, tinted towards toner as stress climbs
  const cr=Math.round(lerp(44,92,st*up)),cg=Math.round(lerp(70,36,st*up)),cb=Math.round(lerp(78,58,st*up));
  ctx.fillStyle='rgb('+cr+','+cg+','+cb+')';ctx.fillRect(0,0,W,H);
  // back wall above the horizon once the camera tips over
  const hl=Math.hypot(cam.f[0],cam.f[2]);
  if(hl>.05){
    const dir=[cam.f[0]/hl,0,cam.f[2]/hl],yy=dir[0]*cam.u[0]+dir[2]*cam.u[2],zz=dir[0]*cam.f[0]+dir[2]*cam.f[2];
    if(zz>.02){const hy=H/2-F*yy/zz;
      if(hy>0){const g=ctx.createLinearGradient(0,Math.max(0,hy-H*.6),0,hy);g.addColorStop(0,'#0c1316');g.addColorStop(1,'rgb('+Math.round(cr*.55)+','+Math.round(cg*.55)+','+Math.round(cb*.55)+')');
        ctx.fillStyle=g;ctx.fillRect(0,0,W,hy);
        // strip lights
        ctx.fillStyle='rgba(244,241,230,'+(.10+.08*Math.sin(t*40)*st)+')';
        for(let i=-3;i<=3;i++)ctx.fillRect(W/2+i*W*.17-W*.05,hy-H*.2,W*.1,H*.012);}
    }
  }
  // carpet tile lines
  ctx.strokeStyle='rgba(255,255,255,.09)';ctx.lineWidth=1;ctx.beginPath();
  const cx=Math.round(cam.pos[0]/3)*3,cz=Math.round(cam.pos[2]/3)*3,R=48;
  for(let g=-R;g<=R;g+=3){line3([cx+g,0,cz-R],[cx+g,0,cz+R]);line3([cx-R,0,cz+g],[cx+R,0,cz+g]);}
  ctx.stroke();
  // everything that stands on the carpet
  const list=[];
  const add=(ch,x,y,z,h,o)=>{const p=proj([x,y,z]);if(!p||p.z>60||(p.z<1.3&&!(o&&o.fly)))return;list.push(Object.assign({ch,p,h},o||{}));};
  for(let i=-6;i<=14;i++)for(let j=-5;j<=5;j++){
    const hsh=Math.abs((i*73856093)^(j*19349663))%11;
    if(hsh<PROPS.length&&(Math.abs(i)>1||Math.abs(j)>1))add(PROPS[hsh],j*6+2,0,i*6+2,1.7,{dim:.75});
  }
  for(const e of sim.en){
    const bob=Math.abs(Math.sin(e.ph))*.18*up;
    add(e.ch,e.x,bob,e.z,e.h,{dev:e.dev,bub:e.bub>0?e.line:'',hero:e.hero,tilt:Math.sin(e.ph)*.09});
  }
  const sinceThrow=t-sim.lastThrow,punch=sinceThrow<.1?1-sinceThrow/.1:0;
  const face=st<.15?'🙂':st<.4?'😐':st<.65?'😤':st<.85?'😡':'🤬';
  add(face,0,0,0,1.8*(1+punch*.12),{player:true,tilt:punch*.25*(Math.floor(sim.lastThrow*50)%2?1:-1),shake:st});
  if(t<10)add('☕',1.1,0,.2,.7,{});
  for(const m of sim.em){
    const k=clamp((t-m.t0)/m.dur,0,1),e=m.to;
    add('✉️',lerp(m.side*(1-k),e.x,k),lerp(1.3,e.h*.6,k)+Math.sin(k*Math.PI)*1.1,lerp(0,e.z,k),.75,{fly:true,rot:m.spin*(t-m.t0)});
  }
  for(const f of sim.fx)add(f.ch||'',f.x,f.y,f.z,f.ch?.5:.5,{fly:true,txt:f.txt,col:f.col,hair:f.hair,alpha:clamp(f.life/.4,0,1)});
  list.sort((a,b)=>b.p.z-a.p.z);
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(const o of list){
    const p=o.p,hp=o.h*p.s,fog=up>.5?clamp(1-(p.z-34)/22,0,1):1;
    if(hp<1.5||fog<=0)continue;
    let cyy=o.fly?p.y:p.y-up*hp/2,cxx=p.x;
    if(o.shake&&o.shake>.5){cxx+=Math.sin(t*90)*hp*.02*o.shake;}
    ctx.globalAlpha=(o.alpha==null?1:o.alpha)*fog*(o.dim||1);
    if(!o.fly){ctx.fillStyle='rgba(8,12,14,.32)';ctx.beginPath();ctx.ellipse(p.x,p.y,hp*.3,hp*lerp(.3,.09,up),0,0,6.283);ctx.fill();}
    if(o.hair){ctx.strokeStyle='#5a3418';ctx.lineWidth=Math.max(1.5,hp*.18);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(cxx,cyy);ctx.lineTo(cxx+hp*.5,cyy-hp*.7);ctx.stroke();}
    else if(o.txt){const px=clamp(p.s*.55,9,H*.05);ctx.font='600 '+px+'px '+MONO;ctx.fillStyle='#121c20';ctx.fillText(o.txt,cxx+1.5,cyy+1.5);ctx.fillStyle=o.col;ctx.fillText(o.txt,cxx,cyy);}
    else if(o.ch){
      const s=spr(o.ch),sz=hp*1.25;
      if(o.rot||o.tilt){ctx.save();ctx.translate(cxx,cyy);ctx.rotate(o.rot||o.tilt);ctx.drawImage(s,-sz/2,-sz/2,sz,sz);ctx.restore();}
      else ctx.drawImage(s,cxx-sz/2,cyy-sz/2,sz,sz);
      if(o.dev){const d=spr(o.dev),ds=sz*.5;ctx.drawImage(d,cxx+sz*.12,cyy+sz*.02,ds,ds);}
      if(o.player){const d=spr('💻'),ds=sz*.45;ctx.drawImage(d,cxx-sz*.55,cyy+sz*.05,ds,ds);}
    }
    if(o.bub){
      const px=o.hero?clamp(hp*.11,12,H*.055):clamp(hp*.24,9,H*.03);ctx.font='600 '+px+'px '+MONO;
      const w=Math.min(W-16,ctx.measureText(o.bub).width+px*1.4),bh=px*2,bx=clamp(cxx-w/2,8,W-8-w),by=Math.max(8,cyy-hp*.62-bh);
      ctx.fillStyle='#f4f1e6';ctx.strokeStyle='#121c20';ctx.lineWidth=Math.max(2,px*.14);rrect(bx,by,w,bh,px*.5);ctx.fill();ctx.stroke();
      ctx.fillStyle='#121c20';ctx.fillText(o.bub,bx+w/2,by+bh/2+px*.05,w-px);
    }
    ctx.globalAlpha=1;
  }
}
function hud(t){
  const st=stressAt(t),u=Math.max(11,Math.min(W,H)*.035),m=540+Math.floor(Math.max(0,t-7.5)*28);
  const clock=String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
  ctx.textBaseline='middle';ctx.textAlign='left';
  ctx.fillStyle='#121c20';rrect(u*.8,u*.8,u*4.6,u*2,u*.3);ctx.fill();
  ctx.font='400 '+u*1.3+'px '+DISPLAY;ctx.fillStyle='#ffd84a';ctx.fillText(clock,u*1.15,u*1.85);
  const bx=u*6,bw=Math.min(W-bx-u,u*16);
  ctx.font='600 '+u*.6+'px '+MONO;ctx.fillStyle='#f4f1e6';ctx.fillText('STRESS',bx,u*1.05);
  ctx.fillStyle='#121c20';rrect(bx,u*1.5,bw,u*.95,u*.45);ctx.fill();
  if(st>0){ctx.fillStyle='#e6337a';rrect(bx+u*.15,u*1.65,Math.max(u*.6,(bw-u*.3)*st),u*.65,u*.3);ctx.fill();}
}
const CAPS=[[13.5,15.7,'EVERYONE HAS A PROBLEM'],[18.4,19.9,'150 WAYS TO SAY "IT\'S BROKEN"'],[20.0,21.4,'12 TRAINING COURSES'],[21.7,24.3,'ONE TECHNICIAN']];
function caption(text,k,y,col){
  const sc=k<.12?lerp(2.2,1,ease(k/.12)):1,px=fitFont(text,Math.min(W*.11,H*.12),W*.9,DISPLAY);
  ctx.save();ctx.translate(W/2,y);ctx.rotate(-.035);ctx.scale(sc,sc);ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#121c20';ctx.fillText(text,px*.07,px*.07);ctx.fillStyle=col||'#ffd84a';ctx.fillText(text,0,0);ctx.restore();
}
function typed(text,k){return text.slice(0,Math.floor(clamp(k,0,1)*text.length));}
function drawTitle(t){
  const k=t-27;
  const g=ctx.createRadialGradient(W/2,H*.42,0,W/2,H*.42,Math.max(W,H)*.75);g.addColorStop(0,'#2c464e');g.addColorStop(1,'#121c20');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  // the queue never stops: people marching along the bottom
  const row=['👩‍🏫','👨‍💼','👵','🧔','👨‍🏫','🤵','👴','👩‍💼'],sz=Math.min(W,H)*.11,gap=sz*1.25,off=(k*sz*1.6)%gap;
  ctx.globalAlpha=.55;
  for(let i=-1;i<W/gap+2;i++){const x=i*gap-off,idx=((i+Math.floor(k*sz*1.6/gap))%row.length+row.length)%row.length;
    ctx.drawImage(spr(row[idx]),x,H*.985-sz*1.5-Math.abs(Math.sin(k*9+i))*sz*.12,sz*1.25,sz*1.25);}
  ctx.globalAlpha=1;
  const sx=k<.5?(rnd()-.5)*20*(1-k/.5):0,sy=k<.5?(rnd()-.5)*20*(1-k/.5):0;
  ctx.save();ctx.translate(sx,sy);
  const px=Math.min(W*.165,H*.17);
  const slam=(text,kk,y,col)=>{if(kk<0)return;const sc=kk<.22?lerp(3.2,1,ease(kk/.22)):1,p=fitFont(text,px,W*.92,DISPLAY);
    ctx.save();ctx.translate(W/2,y);ctx.rotate(-.03);ctx.scale(sc,sc);ctx.globalAlpha=clamp(kk/.08,0,1);ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='#121c20';ctx.fillText(text,p*.07,p*.07);ctx.fillStyle=col;ctx.fillText(text,0,0);ctx.restore();ctx.globalAlpha=1;};
  slam('HELPDESK',k,H*.27,'#f4f1e6');slam('HORDE',k-.4,H*.27+px*1.02,'#ffd84a');
  ctx.restore();
  ctx.textAlign='center';ctx.textBaseline='middle';
  if(k>1.7){const hook='"It\'s only a quick one."',p=Math.min(W*.052,H*.05);ctx.font='600 '+p+'px '+MONO;ctx.fillStyle='#f4f1e6';ctx.fillText(typed(hook,(k-1.7)/1.1),W/2,H*.27+px*2.0,W*.92);}
  if(k>3.4){const p=Math.min(W*.036,H*.034);ctx.font='600 '+p+'px '+MONO;ctx.fillStyle='#e6337a';ctx.globalAlpha=clamp((k-3.4)/.4,0,1);
    ctx.fillText('SURVIVE UNTIL 17:00',W/2,H*.27+px*2.0+p*2.4);ctx.globalAlpha=1;}
}
function renderAt(t){
  renderCore(t);
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.globalAlpha=.75;ctx.textAlign='right';ctx.textBaseline='bottom';
  const p=Math.max(11,Math.min(W,H)*.026);ctx.font='600 '+p+'px '+MONO;
  const hint=(AC&&AC.state!=='running')?'Tap for sound · Space to skip':'Tap or press Space to skip';
  ctx.fillStyle='#121c20';ctx.fillText(hint,W-11,H-9);ctx.fillStyle='#f4f1e6';ctx.fillText(hint,W-12,H-10);ctx.globalAlpha=1;
}
function renderCore(t){
  if(t<sim.t-.001)resetSim();
  let guard=0;while(sim.t+DT<=t&&sim.t<24.6&&guard++<4000)stepSim();
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.globalAlpha=1;
  if(t<3.3||(t>=25.2&&t<27)){
    ctx.fillStyle='#121c20';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.textBaseline='middle';
    const p=Math.min(W*.05,H*.05);ctx.fillStyle='#f4f1e6';
    if(t<3.3){
      ctx.font='400 '+p*1.7+'px '+DISPLAY;ctx.fillStyle='#ffd84a';if(t>.35)ctx.fillText('MONDAY 08:59',W/2,H*.44,W*.9);
      ctx.font='600 '+p*.8+'px '+MONO;ctx.fillStyle='#f4f1e6';if(t>1.4)ctx.fillText(typed('One IT technician. One building.',(t-1.4)/1.1),W/2,H*.44+p*2.2,W*.9);
    }else{
      ctx.font='600 '+p*.85+'px '+MONO;const s=typed('"Have you tried turning it off and on again?"',(t-25.5)/1.0);
      ctx.fillText(s+(Math.floor(t*4)%2?'_':' '),W/2,H/2,W*.92);
    }
    return;
  }
  if(t>=27){drawTitle(t);return;}
  const sh=shot(t),st=stressAt(t),amp=(sh.up?.16:.05)*st*(t>21.5?1.8:1);
  const jx=Math.sin(t*47)*amp,jy=Math.sin(t*61+1)*amp*.6;
  setCam([sh.pos[0]+jx,sh.pos[1]+jy,sh.pos[2]],sh.tgt,sh.up);
  drawWorld(t,sh);
  // stress vignette
  if(st>.2){const g=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.28,W/2,H/2,Math.max(W,H)*.72);
    g.addColorStop(0,'rgba(230,51,122,0)');g.addColorStop(1,'rgba(230,51,122,'+(st*.6*(.8+.2*Math.sin(t*12)))+')');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}
  // cinema bars once it goes 3D
  if(sh.up>0){const b=H*.075*sh.up;ctx.fillStyle='#0a1012';ctx.fillRect(0,0,W,b);ctx.fillRect(0,H-b,W,b);}
  hud(t);
  if(t>4.3&&t<7.3)caption('A QUIET MORNING',(t-4.3)/3,H*.8,'#f4f1e6');
  if(t>8.6&&t<11)caption('UNTIL THE TICKETS START',(t-8.6)/2.4,H*.8,'#ffd84a');
  for(const c of CAPS)if(t>=c[0]&&t<c[1])caption(c[2],(t-c[0])/(c[1]-c[0]),H*.78);
  // pings popping off the desk
  for(const pt of PINGS)if(t>=pt&&t<pt+.7&&t<11.2){const k=(t-pt)/.7,p=proj([Math.sin(pt*7)*2.2,0,Math.cos(pt*5)*1.6+.8]);
    if(p){const sz=p.s*1.2*(1+k);ctx.globalAlpha=1-k;ctx.drawImage(spr('✉️'),p.x-sz/2,p.y-sz/2-k*sz,sz,sz);ctx.globalAlpha=1;}}
  // hard-cut flashes, the fade in, and the whiteout
  for(const c of CUTS)if(t>=c&&t<c+.14){ctx.fillStyle='rgba(255,255,255,'+(.8*(1-(t-c)/.14))+')';ctx.fillRect(0,0,W,H);}
  if(t<3.8){ctx.fillStyle='rgba(18,28,32,'+(1-(t-3.3)/.5)+')';ctx.fillRect(0,0,W,H);}
  if(t>24.2){const k=clamp((t-24.2)/.35,0,1);ctx.fillStyle='rgba(255,255,255,'+k+')';ctx.fillRect(0,0,W,H);
    if(t>24.75){ctx.fillStyle='rgba(18,28,32,'+clamp((t-24.75)/.4,0,1)+')';ctx.fillRect(0,0,W,H);}}
}
const PINGS=[5.5,6.5,7.0,7.4,7.7,8.0,8.25,8.5,8.7,8.9,9.1,9.3,9.5,9.7,9.9,10.1,10.3,10.5,10.7,10.9];

/* ---------- sound: everything synthesised, plus a few recorded shouts ---------- */
let AC=null,master=null,T0=0,noiseBuf=null,lastW=0,lastP=0;
function mkNoise(){const b=AC.createBuffer(1,AC.sampleRate,AC.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b;}
function tone(type,f,t,d,vol,f2,atk){
  const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,t);
  if(f2)o.frequency.exponentialRampToValueAtTime(Math.max(1,f2),t+d);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+(atk||.005));g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g);g.connect(master);o.start(t);o.stop(t+d+.05);
}
function noise(t,d,vol,type,f1,f2,q,rise){
  const s=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain();s.buffer=noiseBuf;s.loop=true;
  fl.type=type;fl.Q.value=q||1;fl.frequency.setValueAtTime(f1,t);if(f2)fl.frequency.exponentialRampToValueAtTime(f2,t+d);
  if(rise){g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+d*.97);g.gain.linearRampToValueAtTime(.0001,t+d);}
  else{g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);}
  s.connect(fl);fl.connect(g);g.connect(master);s.start(t);s.stop(t+d+.05);
}
const kick=(t,v)=>{tone('sine',160,t,.22,v||.9,42);noise(t,.02,.2,'highpass',2000);};
const snare=(t,v)=>{noise(t,.16,v||.45,'highpass',1400);tone('triangle',220,t,.1,.3,120);};
const hat=(t,v)=>noise(t,.035,v||.14,'highpass',8000);
function bass(t,f,d,v){
  const o=AC.createOscillator(),fl=AC.createBiquadFilter(),g=AC.createGain();o.type='sawtooth';o.frequency.value=f;
  fl.type='lowpass';fl.Q.value=6;fl.frequency.setValueAtTime(1400,t);fl.frequency.exponentialRampToValueAtTime(180,t+d);
  g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(fl);fl.connect(g);g.connect(master);o.start(t);o.stop(t+d+.03);
}
function stab(t,notes,d,v){for(const f of notes)for(const dt of [-7,0,7]){
  const o=AC.createOscillator(),fl=AC.createBiquadFilter(),g=AC.createGain();o.type='sawtooth';o.frequency.value=f;o.detune.value=dt;
  fl.type='lowpass';fl.frequency.setValueAtTime(3200,t);fl.frequency.exponentialRampToValueAtTime(500,t+d);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(fl);fl.connect(g);g.connect(master);o.start(t);o.stop(t+d+.05);}}
const E2=82.41,G2=98,A2=110,Bb2=116.54,B2=123.47,C3=130.81,D3=146.83;
function schedule(T){
  const at=x=>T+x;
  // cold open: hum and a clock
  tone('sine',55,at(0),3.6,.16,0,.6);
  for(let i=0;i<4;i++){tone('square',1900,at(.35+i*.8),.02,.06);tone('square',1500,at(.75+i*.8),.02,.04);}
  // polite hold music that slowly loses the will to live
  const muz=[261.6,329.6,392,493.9,392,329.6,349.2,440,523.3,659.3,523.3,440];
  for(let i=0,x=3.5;x<11.2;i++){
    const droop=x>9.4?Math.pow(2,-(x-9.4)/1.5):1;
    tone('triangle',muz[i%muz.length]*droop,at(x),.5,.09,0,.02);if(i%6===0)tone('sine',(i%12?174.6:130.8)*droop,at(x),1.6,.1,0,.05);
    x+=.28/(droop*droop>.3?droop:.55);
  }
  for(const p of PINGS){tone('sine',1319,at(p),.09,.1);tone('sine',1760,at(p+.08),.16,.1);}
  // heartbeat, riser, snare roll
  for(let x=8,iv=.62;x<12.4;x+=iv,iv=Math.max(.26,iv*.93)){kick(at(x),.55);kick(at(x+.13),.3);}
  noise(at(10.2),3,.3,'bandpass',300,7000,2,true);tone('sawtooth',80,at(10.6),2.6,.07,640,2.2);
  for(let x=12.4,iv=.1;x<13.18;x+=iv,iv=Math.max(.04,iv*.9))snare(at(x),.2+(x-12.4)*.3);
  // the drop: 150 bpm, seven bars
  const beat=.4,riff=[E2,E2,E2*2,E2, G2,E2,E2*2,E2, A2,E2,E2*2,E2, Bb2,A2,G2,E2];
  const chords=[[E2*2,B2*2,E2*4],[C3,G2*2,C3*2],[D3,A2*2,D3*2],[B2,B2*1.5,B2*2]];
  const lead=[659.3,493.9,784,493.9,659.3,493.9,932.3,784];
  noise(at(13.2),1.2,.4,'highpass',3000);tone('sine',90,at(13.2),.9,.9,30);
  for(let bar=0;bar<7;bar++){
    const b0=13.2+bar*1.6;
    stab(at(b0),chords[bar%4],.5,.05);stab(at(b0+beat*2.5),chords[bar%4],.25,.04);
    for(let q=0;q<4;q++){
      const bt=b0+q*beat;kick(at(bt));if(q%2)snare(at(bt));hat(at(bt+.2));if(bar>1)hat(at(bt+.1),.07);
      for(let s=0;s<4;s++)bass(at(bt+s*.1),riff[q*4+s]*(bar%4===3&&q===3?1.122:1),.095,.22);
      if(bar>0)for(let s=0;s<2;s++)tone('square',lead[(q*2+s)%8],at(bt+s*.2),.12,.035);
    }
    if(bar===3||bar===6)for(let s=0;s<4;s++)snare(at(b0+1.2+s*.1),.3);
  }
  // cut to nothing
  tone('sawtooth',500,at(24.4),.55,.2,35);noise(at(24.4),.5,.3,'lowpass',6000,200);
  tone('sine',2093,at(25.5),.5,.05);
  // title hit and a half-time outro
  const hit=x=>{tone('sine',70,at(x),1.8,1,28);noise(at(x),1.6,.45,'lowpass',9000,300);stab(at(x),[E2,E2*2,B2*2,E2*4,G2*4],2.6,.06);};
  hit(27);
  const oc=[[E2,[E2*2,B2*2,G2*4]],[C3/2*1,[C3,G2*2,E2*4]],[D3/2,[D3,A2*2,D3*2]],[E2,[E2*2,B2*2,E2*4]]];
  for(let bar=0;bar<4;bar++){
    const b0=27.4+bar*1.6;if(bar)stab(at(b0),oc[bar][1],1.4,.045);
    for(let q=0;q<4;q++){const bt=b0+q*beat;if(q%2===0)kick(at(bt),.8);if(q===2)snare(at(bt),.35);hat(at(bt+.2),.09);
      for(let s=0;s<2;s++)bass(at(bt+s*.2),oc[bar][0],.18,.2);}
  }
  hit(33.8);
}
const VOICE=[[7.7,'t30',.8],[9.2,'t32',.8],[10.5,'t1',.8],[14.2,'t30',.6],[16.25,'t0',1.5],[18.9,'t42',.9],[19.9,'s19',.9],[21.2,'g1',1],[22.5,'t45',.9],[23.3,'b0',1.2]];
function scheduleVoices(T,m){
  for(const [x,k,v] of VOICE){
    const V=window.VOICES,cm=CLIPMAP[k];if(!V||!V[cm[0]]||!V[cm[0]][cm[1]])continue;
    try{const bin=atob(V[cm[0]][cm[1]]),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
      AC.decodeAudioData(u.buffer,buf=>{if(master!==m||AC.currentTime>T+x)return;
        const s=AC.createBufferSource(),g=AC.createGain();s.buffer=buf;g.gain.value=v;s.connect(g);g.connect(m);s.start(T+x);},()=>{});
    }catch(e){}
  }
}
function sfxWhoosh(){if(!AC||AC.currentTime-lastW<.07)return;lastW=AC.currentTime;try{noise(AC.currentTime,.09,.09,'bandpass',900,3800,3);}catch(e){}}
function sfxPop(){if(!AC||AC.currentTime-lastP<.05)return;lastP=AC.currentTime;try{tone('square',300+Math.random()*160,AC.currentTime,.07,.08,130);}catch(e){}}
function sfxBounce(){if(!AC)return;try{tone('triangle',180,AC.currentTime,.1,.12,90);}catch(e){}}

/* ---------- playback ---------- */
let playing=false,P0=0,useAC=false;
function start(){
  try{
    AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();
    if(master){try{master.gain.value=0;master.disconnect();}catch(e){}}
    noiseBuf=noiseBuf||mkNoise();
    master=AC.createGain();master.gain.value=.8;
    const comp=AC.createDynamicsCompressor();master.connect(comp);comp.connect(AC.destination);
    T0=AC.currentTime+.12;schedule(T0);scheduleVoices(T0,master);useAC=true;
  }catch(e){useAC=false;}
  P0=performance.now()+120;resetSim();live=true;playing=true;
}
function now(){
  if(useAC&&AC&&AC.state==='running')return AC.currentTime-T0;
  return (performance.now()-P0)/1000;
}
let onDone=null,skipAt=0;
function finish(){
  if(!playing)return;playing=false;live=false;cv.style.display='none';
  window.removeEventListener('keydown',onKey,true);cv.removeEventListener('pointerdown',onTap);
  try{if(master){master.gain.value=0;master.disconnect();}if(AC)AC.close();}catch(e){}
  AC=null;master=null;noiseBuf=null;useAC=false;
  const f=onDone;onDone=null;if(f)f();
}
function onKey(e){
  if(e.key===' '||e.key==='Enter'||e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!e.repeat&&performance.now()>skipAt)finish();}
}
function onTap(e){e.preventDefault();
  if(AC&&AC.state!=='running'){try{AC.resume();}catch(x){}skipAt=performance.now()+450;return;} // first tap turns the sound on and restarts in sync
  if(performance.now()>skipAt)finish();}
function frame(){
  if(!playing)return;
  const t=Math.max(0,now());
  try{renderAt(Math.min(t,TOTAL));}catch(e){finish();return;}
  if(t>=34.6){finish();return;}
  requestAnimationFrame(frame);
}
window.Trailer={play(cb){
  onDone=cb;resize();cv.style.display='block';skipAt=performance.now()+450;start();
  window.addEventListener('keydown',onKey,true);cv.addEventListener('pointerdown',onTap);requestAnimationFrame(frame);
}};
})();
