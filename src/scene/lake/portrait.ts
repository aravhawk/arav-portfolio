import { lakeSurface } from './shaders';
// Independent portrait survey. Texels for the exposed lake are in metres.
// The other two atlas regions hold the distant shore and the two rows.
const gate = `
uniform vec2 gateHalf;
uniform float gateShift, groundPart, slabTop;
vec2 cameraUV(vec3 p){
  return .5+.5*vec2(p.x/p.z,-p.y/p.z+gateShift)/gateHalf;
}`;
export const portraitGround = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D plate;
${lakeSurface}
uniform mat3 phoneAxes;
uniform vec3 sourceEye,eye;
uniform vec2 lens;
uniform float pan,tilt;
out vec4 color;
${gate}
void main(){
  vec3 dir=vec3((uv*2.-1.)*lens+vec2(pan,gateShift+tilt),1.);
  vec3 ray=phoneAxes*dir;
  vec3 origin=sourceEye+phoneAxes*eye;
  float t=clamp(-origin.z/min(ray.z,-.0001),.1,100.);
  vec3 p=eye+t*dir;
  vec2 camera=cameraUV(p);
  vec3 c=texture(plate,vec2(camera.x,clamp(camera.y,0.,.9995)*groundPart)).rgb;
  vec2 metres=(origin+ray*t).xy;
  vec2 bankMetres=metres-vec2(2.15,-1.1);
  vec2 lake=(bankMetres*vec2(1.,-1.)+vec2(10.,3.))/vec2(18.,16.);
  vec2 edge=min(lake,1.-lake)*vec2(18.,16.);
  // Leave the ice collars and local reflections around both rows in their
  // portrait survey. Everything closer than this strip has metric UVs.
  float nearLake=(1.-smoothstep(-3.8,-2.65,metres.y)) * smoothstep(.04,.54,min(edge.x,edge.y));
  color=vec4(mix(c,nearSurface(bankMetres,lake,ray),nearLake),0.);
}`;
export const portraitMesh = `#version 300 es
precision highp float;
layout(location=0) in vec3 pos;
layout(location=1) in vec2 octNormal;
uniform vec3 low,span,baseEye,sourceEye,eye,farOffset,nearOffset;
uniform mat3 baseAxes,phoneAxes;
uniform vec2 lens;
uniform float pan,tilt;
uniform float splitX,farScale;
uniform vec3 cuts;
uniform vec4 spacing;
out vec3 source,surfaceNormal;
out float elevation;
${gate}
void main(){
  vec3 world=baseEye+baseAxes*(low+span*pos);
  int glyph=int(world.x>=cuts.x)+int(world.x>=cuts.y)+int(world.x>=cuts.z);
  world=world.x<splitX ? world*farScale+farOffset : world+nearOffset+vec3(spacing[glyph],0.,0.);
  elevation=world.z;
  vec2 xy=octNormal*2.-1.;
  vec3 n=vec3(xy,1.-abs(xy.x)-abs(xy.y));
  if(n.z<0.)n.xy=(1.-abs(n.yx))*sign(n.xy);
  surfaceNormal=transpose(phoneAxes)*baseAxes*n;
  source=transpose(phoneAxes)*(world-sourceEye);
  vec3 p=source-eye;
  gl_Position=vec4((p.xy-vec2(pan,gateShift+tilt)*p.z)/lens,p.z*.99985-.11,p.z);
}`;
export const portraitIce = `#version 300 es
precision highp float;
in vec3 source,surfaceNormal;
uniform float time;
in float elevation;
uniform sampler2D plate;
out vec4 color;
${gate}
void main(){
  if(elevation<-.045)discard;
  vec2 p=cameraUV(source);
  vec3 n=normalize(surfaceNormal);
  vec3 body=texture(plate,vec2(p.x,groundPart*(1.+p.y-slabTop))).rgb;
  vec2 clear=p*vec2(1.,groundPart);
  vec3 through=textureLod(plate,clear+n.xy*.0017,1.).rgb-textureLod(plate,clear,1.).rgb;
  float glint=pow(max(0.,dot(n,normalize(vec3(.76+.10*sin(time*.37),.41,-.35)))),22.);
  color=vec4(body+through*.045+glint*.018*(.52+.48*sin(source.x*2.3-time*.55)),1.);
}`;

export const portraitBloom = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D field;
out vec4 color;
void main(){
  vec3 c=texture(field,uv).rgb;
  color=vec4(vec3(smoothstep(.66,.79,max(c.r,max(c.g,c.b)))),1.);
}`;
