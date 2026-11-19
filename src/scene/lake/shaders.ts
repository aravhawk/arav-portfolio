// The source camera projects baked radiance onto the stationary meshes. UVs
// remain attached to the lake and the slab when the live camera moves.
export const meshVertex = `#version 300 es
precision highp float;
layout(location=0) in vec3 pos;
layout(location=1) in vec2 octNormal;
uniform vec3 low,span,eye;
uniform vec2 lens,restLens,aim;
out vec3 world,normal,projected;
void main(){
  world=low+span*pos;
  vec2 oct=octNormal*2.-1.;
  normal=vec3(oct,1.-abs(oct.x)-abs(oct.y));
  if(normal.z<0.) normal.xy=(1.-abs(normal.yx))*sign(normal.xy);
  projected=vec3(world.x/restLens.x,-world.y/restLens.y,world.z);
  vec3 p=world-eye;
  gl_Position=vec4(p.xy/lens+p.z*aim,p.z*.99985-.11,p.z);
}`;

export const fullVertex = `#version 300 es
precision highp float;
out vec2 uv;
void main(){
  vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);
  uv=p;
  gl_Position=vec4(p*2.-1.,0.,1.);
}`;

const linear = `vec3 linearLight(vec3 packedColor){
  vec2 chroma=(packedColor.gb-.5)*.25;
  float g=packedColor.r-.25*(chroma.x+chroma.y);
  return max(vec3(0.),(exp2(14.*(g+vec3(chroma.x,0.,chroma.y)))-1.)/1024.);
}`;
const field = `vec3 readField(sampler2D detail,sampler2D baseMap,vec2 p,vec2 band){
  float residual=(texture(detail,p).r-.5)*.4;
  vec2 coord=vec2(p.x,(clamp(p.y,0.,1.)*(band.y-1.)+band.x+.5)/448.);
  return clamp(texture(baseMap,coord).rgb+residual,0.,1.);
}
vec3 fromShape(vec3 c){return max(vec3(0.),(exp2(14.*c)-1.)/1024.);}
vec3 toShape(vec3 c){return log2(1.+1024.*max(c,vec3(0.)))/14.;}`;
export const groundFragment = `#version 300 es
precision highp float;
in vec3 projected,world;
uniform sampler2D atlas,baseMap;
uniform vec3 eye;
out vec4 color;
${field}
void main(){
  vec2 uv=.5+.5*projected.xy/projected.z;
  vec3 c=readField(atlas,baseMap,uv,vec2(0.,320.));
  // Cycles includes the low, sky-matched fog at the rest camera. Apply
  // only the optical-path change when the camera enters the basin.
  float path=clamp((world.z-32.)*.012,0.,1.)*max(-eye.z,0.)*.004;
  color=vec4(mix(c,vec3(.59,.60,.605),path),1.);
}`;

export const iceFragment = `#version 300 es
precision highp float;
in vec3 projected,world,normal;
uniform sampler2D body,material,behind,environment,baseMap;
uniform vec4 crop,waterPlane;
uniform vec2 resolution;
uniform vec3 eye;
uniform float time;
out vec4 color;
${linear}
${field}
void main(){
  if(dot(vec4(world,1.),waterPlane)<-.045)discard;
  vec2 uv=(.5+.5*projected.xy/projected.z-crop.xy)/crop.zw;
  vec4 optical=texture(material,uv);
  vec2 xy=optical.rg*2.-1.;
  vec3 n=normalize(mix(vec3(xy,-sqrt(max(.001,1.-dot(xy,xy)))),normalize(normal),.12));
  vec3 view=normalize(eye-world);
  float fres=pow(1.-max(dot(n,view),0.),5.);
  vec3 reflection=reflect(-view,n);
  vec2 env=vec2(atan(reflection.x,reflection.z)*.159155+.5,acos(clamp(reflection.y,-1.,1.))*.31831);
  vec3 spec=linearLight(textureLod(environment,env,2.).rgb);
  vec2 refr=gl_FragCoord.xy/resolution+(2.+5.*optical.b)*n.xy/resolution;
  vec3 bg=fromShape(textureLod(behind,refr,.9+optical.b).rgb);
  vec3 c=fromShape(readField(body,baseMap,uv,vec2(328.,112.)))+.12*optical.a+(.05-.025*optical.b)*bg;
  float glint=pow(max(0.,dot(n,normalize(vec3(.81+.04*sin(time*.37),.49,-.24)))),18.);
  color=vec4(toShape(c+spec*(.004+.052*fres)+glint*.060),1.);
}`;

export const bloomFragment = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D source;
uniform vec2 delta;
uniform int extract;
out vec4 color;
vec3 readLight(vec2 p){
  vec3 c=texture(source,p).rgb;
  return c*smoothstep(.76,.85,max(c.r,max(c.g,c.b)));
}
void main(){
  vec3 c=.30*readLight(uv);
  c+=.23*(readLight(uv+delta)+readLight(uv-delta));
  c+=.12*(readLight(uv+2.6*delta)+readLight(uv-2.6*delta));
  color=vec4(c,1.);
}`;

export const postFragment = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 uv;
uniform sampler2D scene,bloom;
uniform sampler3D grade;
uniform vec2 invResolution;
out vec4 color;
void main(){
  vec3 c=texture(scene,uv).rgb;
  float y=dot(c,vec3(.213,.715,.072));
  vec2 slopes=vec2(dFdx(y),dFdy(y));
  float strength=max(abs(slopes.x),abs(slopes.y));
  if(strength>max(.07,y*.28)){
    vec2 normal=slopes/(abs(slopes.x)+abs(slopes.y)+.001);
    c=mix(c,(texture(scene,uv+.52*normal*invResolution).rgb+texture(scene,uv-.52*normal*invResolution).rgb)*.5,.42);
  }
  c+=textureLod(bloom,uv,1.65).rgb*.0028;
  vec3 shaped=clamp(c,0.,1.);
  color=vec4(texture(grade,(shaped*31.+.5)/32.).rgb,1.);
}`;

export const driftVertex = `#version 300 es
precision highp float;
uniform float time,dpr;
uniform vec3 eye;
out float opacity;
float hash(float x){return fract(sin(x)*43758.5453);}
void main(){
  float i=float(gl_VertexID+1),layer=mod(i,3.);
  float x=fract(hash(i*2.17)+time*(.012+.005*layer));
  float y=hash(i*4.73);
  gl_Position=vec4(2.*x-1.-eye.x*(.10+.08*layer),-.62+y*.30+sin(time*.66+i)*.004,0.,1.);
  gl_PointSize=(1.+layer*.32)*dpr;
  opacity=(.024+.014*layer)*smoothstep(0.,.08,x)*smoothstep(0.,.08,1.-x);
}`;
export const driftFragment = `#version 300 es
precision mediump float;
in float opacity;
out vec4 color;
void main(){color=vec4(.57,.64,.72,opacity*(1.-smoothstep(.12,.49,length(gl_PointCoord-.5))));}`;
