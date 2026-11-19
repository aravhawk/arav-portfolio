import { LakeGPU, nextFrame, rest, type Pose } from './gpu';

export type LakeProof = {
  capture: () => string;
  measure: (width:number,height:number,breakdown?:boolean)=>ReturnType<LakeGPU['measure']>;
  sample: (enabled:boolean)=>{intervals:number[];main:number[]};
  frame: (scroll:number,x:number,y:number)=>string;
  state: ()=>{width:number;height:number;drawing:boolean;scale:number};
};
declare global {interface Window {__lakeProof?:LakeProof}}
const ease=(rate:number,dt:number)=>-Math.expm1(-rate*dt);
function spring(value:number,speed:number,target:number,dt:number){
  const delta=value-target, q=speed+8*delta,k=Math.exp(-8*dt);
  return [target+(delta+q*dt)*k,(speed-8*q*dt)*k];
}
export async function mount(canvas:HTMLCanvasElement, theme:string,signal:AbortSignal){
  const gpu=new LakeGPU(canvas);
  let raf=0,visible=true,busy=false,record=false,pinned=false,scale=1,rough=0,stable=0;
  let x=0,y=0,vx=0,vy=0,tx=0,ty=0,lead=0,scroll=0,t=0,prev=0;
  let intervals:number[]=[],cpu:number[]=[];
  let pose:Pose={...rest};
  const resize=()=>{const dpr=Math.min(2,devicePixelRatio)*scale;gpu.resize(Math.round(canvas.clientWidth*dpr),Math.round(canvas.clientHeight*dpr));};
  const update=(s:number,px:number,py:number,clock:number):Pose=>({
    x:px*.14+Math.sin(clock*.18)*.013,y:py*.055-s*.16+Math.sin(clock*.22)*.009,
    z:s*1.7+Math.sin(clock*.15)*.024,t:clock,
  });
  const frame=(now:number)=>{
    raf=0;
    if(signal.aborted||document.hidden||!visible||busy||gpu.disposed)return;
    const delta=prev?now-prev:0,dt=Math.min(.06,delta/1000);prev=now;t+=dt;
    lead+=(Math.min(1,Math.max(0,window.scrollY/(2*innerHeight)))-lead)*ease(6.49,dt);
    scroll+=(lead-scroll)*ease(6.49,dt);
    [x,vx]=spring(x,vx,tx,dt);[y,vy]=spring(y,vy,ty,dt);
    pose=update(scroll,x,y,t);
    if(record && delta){intervals.push(delta);}
    // Ignore the cadence of a healthy 60 Hz display. A sustained series of
    // missed refreshes triggers one bounded step, followed by a long recovery.
    if(!pinned && delta){
      rough=delta>23?rough+1:Math.max(0,rough-1);
      stable=delta<18?stable+1:0;
      if(rough>=60 && scale>.80){scale=Math.max(.8,scale-.05);rough=0;stable=0;resize();}
      if(stable>600 && scale<1){scale=Math.min(1,scale+.05);stable=0;resize();}
    }
    const start=performance.now();gpu.draw(pose);
    if(record)cpu.push(performance.now()-start);
    raf=requestAnimationFrame(frame);
  };
  const resume=()=>{
    if(document.hidden||!visible||busy||signal.aborted){cancelAnimationFrame(raf);raf=0;prev=0;}
    else if(!raf){prev=0;raf=requestAnimationFrame(frame);}
  };
  const move=(e:PointerEvent)=>{tx=e.clientX/innerWidth*2-1;ty=1-e.clientY/innerHeight*2;};
  const leave=()=>{tx=ty=0;};
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;resume();});
  const onResize=()=>{if(!busy&&!signal.aborted)resize();};
  const api:LakeProof={
    capture:()=>{gpu.draw(rest);return canvas.toDataURL('image/png');},
    frame:(s,px,py)=>{gpu.draw(update(s,px,py,0));return canvas.toDataURL('image/png');},
    sample:(enabled)=>{record=enabled;pinned=true;if(enabled){intervals=[];cpu=[];scale=1;resize();}return {intervals,main:cpu};},
    state:()=>({width:canvas.width,height:canvas.height,drawing:!!raf,scale}),
    measure:async(w,h,details=false)=>{
      pinned=true;busy=true;resume();
      try{return await gpu.measure(w,h,details);}
      finally{busy=false;scale=1;resize();resume();}
    },
  };
  const dispose=()=>{
    cancelAnimationFrame(raf);observer.disconnect();gpu.dispose();canvas.style.opacity='0';
    if(window.__lakeProof===api)delete window.__lakeProof;
  };
  signal.addEventListener('abort',dispose,{once:true});
  if(signal.aborted){dispose();return;}
  try{
    await gpu.load(theme);
    if(signal.aborted)return;
    resize();gpu.draw(rest);await nextFrame();
    if(signal.aborted)return;
    // Wait for the warm-up GPU submission to finish before exposing the canvas.
    const gl=gpu.gl, fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
    gl.flush();
    if(fence){
      while(!signal.aborted && gl.clientWaitSync(fence,0,0)===gl.TIMEOUT_EXPIRED)await nextFrame();
      gl.deleteSync(fence);
    }
    if(signal.aborted)return;
    window.__lakeProof=api;
    performance.mark('lake:live');
    canvas.style.opacity='1';
    document.addEventListener('visibilitychange',resume,{signal});
    window.addEventListener('pointermove',move,{passive:true,signal});
    document.addEventListener('pointerleave',leave,{signal});
    window.addEventListener('resize',onResize,{passive:true,signal});
    observer.observe(canvas);resume();
  }catch(e){dispose();if(!signal.aborted)throw e;}
}
