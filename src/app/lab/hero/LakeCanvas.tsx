'use client';

import { useEffect, useRef } from 'react';

export function LakeCanvas() {
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current!;
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    let controller:AbortController|undefined, timer=0, raf=0,closed=false;
    const cancel=()=>{controller?.abort();clearTimeout(timer);cancelAnimationFrame(raf);};
    const start=()=>{
      cancel();
      if(media.matches||closed)return;
      controller=new AbortController();
      const {signal}=controller;
      raf=requestAnimationFrame(()=>{raf=requestAnimationFrame(()=>{
        timer=window.setTimeout(async()=>{
          if(signal.aborted)return;
          performance.mark('lake:import');
          try{
            const {mount}=await import('@/scene/lake/live');
            if(!signal.aborted)await mount(canvas,'day',signal);
          }catch(err){if(!signal.aborted)console.error('Frozen lake initialization',err);}
        },0);
      });});
    };
    const lost=(e:Event)=>{e.preventDefault();cancel();};
    canvas.addEventListener('webglcontextlost',lost);
    canvas.addEventListener('webglcontextrestored',start);
    media.addEventListener('change',start);
    start();
    return ()=>{closed=true;cancel();media.removeEventListener('change',start);
      canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',start);};
  },[]);
  return <canvas ref={ref} aria-hidden="true" className="flight-canvas" style={{width:'100%',height:'100%',opacity:0}}/>;
}
