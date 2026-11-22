export const whiteoutField = `float smoothNoise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  vec4 h=fract(sin(dot(i,vec2(12.9898,78.233))+vec4(0.,12.9898,78.233,91.2228))*43758.54);
  return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);
}
vec4 whiteout(vec2 uv,float time,float transition,float night,out float reveal){
    vec2 wind=vec2(uv.x+uv.y*.32-time*.045,uv.y);
    float plume=.7*smoothNoise(wind*vec2(3.,16.))+.3*smoothNoise(wind*vec2(10.,69.));
    float t=clamp(transition+(plume-.5)*.24*sin(transition*3.14159),0.,1.);
    vec3 fog=mix(vec3(.674,.678,.682),vec3(.53,.545,.563),night)
             +.018*(uv.y-.5)+.019*(plume-.5);
    reveal=smoothstep(.52,1.,t);
    return vec4(fog,smoothstep(0.,.48,t));
}`;

// The plate and water share the authored projection. Red stores inverse
// distance, green isolates liquid and foam. Offsets taper at the ice foot.
export const plateFragment = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 color;
uniform sampler2D plate,survey;
uniform vec2 cover,focus,lean;
uniform float push,time,transition,night,reduce;
${whiteoutField}
void main(){
  vec2 p=(vec2(uv.x,1.-uv.y)-.5)*cover+.5;
  float z=texture(survey,p).r;
  vec2 eye=(p-focus)*push+lean;
  p-=eye*(.32+.68*z);
  vec4 data=texture(survey,p);
  float gate=smoothstep(.43,.8,data.g)*(1.-reduce);
  float phase=p.y*135.+p.x*16.-time*.95;
  vec2 offset=vec2(sin(phase*.53+p.x*42.),sin(phase+sin(phase*.31)))*vec2(.00031,.00145);
  float luma=texture(plate,p+gate*offset).r;
  vec2 chroma=(data.ba-128./255.)/6.;
  float green=luma-.25*(chroma.x+chroma.y);
  vec3 c=green+vec3(chroma.x,0.,chroma.y);
  // Steam only in the surveyed opening, strongest at the foot of the spill.
  vec2 mist=(p-focus)*vec2(10.,13.);
  c+=.005*(1.-reduce)*exp(-dot(mist,mist))*sin(13.*p.x+9.*p.y-time*.32);
  if(transition<1. && reduce<.5){
    float reveal;
    vec4 gust=whiteout(uv,time,transition,night,reveal);
    color=vec4(mix(gust.rgb,c,reveal),gust.a);return;
  }
  color=vec4(c,transition);
}`;
