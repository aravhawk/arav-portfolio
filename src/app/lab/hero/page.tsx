import type { Metadata } from 'next';
import { LakeCanvas } from './LakeCanvas';
import '../../home.css';
import '../../flight.css';

export const metadata:Metadata={title:'Frozen lake',robots:{index:false,follow:false},alternates:{canonical:'/lab/hero'}};

export default function LakeLab(){
  return <main id="main" className="fl" data-lake-lab>
    <section className="fl-sec fl-hero" data-fl style={{height:'300svh'}} aria-labelledby="name" data-lenis-prevent>
      <div className="fl-pin">
        <div className="fl-lake" data-basin style={{display:'block'}}>
          <div className="fl-poster" aria-hidden="true" />
          <LakeCanvas/>
          <h1 id="name" className="fl-name sr-only" data-ice>Arav Jain</h1>
        </div>
        <div className="fl-words fl-hero-words" data-fl-from={-1} data-fl-to={1.9} data-hero data-on>
          <p className="statement fl-role">
            <span className="fl-rise" data-at={-1} data-in><span className="fl-rise-in">AI and developer</span></span>
            <span className="fl-rise" data-at={-1} data-in><span className="fl-rise-in">tooling builder.</span></span>
          </p>
          <p className="fl-line fl-intro" data-at={-1} data-fl-until={0.25} data-in>
            I co-founded Infiniflop Labs and build Infiniview: agents that attack your app to prove what breaks.
          </p>
        </div>
      </div>
    </section>
  </main>;
}
