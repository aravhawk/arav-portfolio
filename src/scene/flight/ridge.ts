import { whiteoutField } from './plate';

// A ray through the moving camera intersects a plane surveyed in the opening
// camera. Each plane has a fully baked view behind the objects that occlude it.
export const ridgeVertex = `#version 300 es
precision highp float;
out vec2 uv,sky;
out vec4 floorRay;
out vec3 nearRay,jawRay;
uniform vec2 cover,focus,lean;
uniform vec3 floorPlane,jawPlane,nearPlane,track;
uniform float push;

// Both the numerator and denominator of this homography are affine.
// Interpolate them across the fullscreen triangle before dividing.
vec4 intersectPlane(vec2 p,vec2 travel,vec3 plane){
  float inverseDepth=dot(plane,vec3(p,1.));
  float w=1.-dot(plane.xy,travel);
  return vec4(p*w+travel*inverseDepth,w,inverseDepth-.009*w);
}
void main(){
  uv=vec2((gl_VertexID<<1)&2,gl_VertexID&2);
  gl_Position=vec4(uv*2.-1.,0.,1.);
  vec2 p=(vec2(uv.x,1.-uv.y)-.5)*cover+.5;
  // Apply the authored aim and sideways motion over the move toward the gap.
  p+=push*track.xy;
  vec2 travel=(focus+vec2(track.z,0.)-p)*push+lean;
  floorRay=intersectPlane(p,travel,floorPlane);
  nearRay=intersectPlane(p,travel,nearPlane).xyz;
  jawRay=intersectPlane(p,travel,jawPlane).xyz;
  sky=p+travel*.009;
}`;

export const ridgeFragment = `#version 300 es
precision highp float;
in vec2 uv,sky;
in vec4 floorRay;
in vec3 nearRay,jawRay;
out vec4 color;
uniform sampler2D plate,survey,wind,silhouettes;
uniform vec2 focus,atlasScale,jawOffset,nearOffset;
uniform vec4 jawBounds,nearBounds;
uniform float time,transition,night,reduce;

vec3 radiance(float y,vec2 axes){
  vec2 c=(axes-128./255.)*(255./1320.);
  float green=y-.25*(c.x+c.y);
  return green+vec3(c.x,0.,c.y);
}
vec4 lip(vec2 p,vec4 bounds,vec2 offset){
  if(any(lessThan(p,bounds.xy))||any(greaterThan(p,bounds.zw)))return vec4(0.);
  vec2 at=p*atlasScale+offset;
  vec2 cut=vec2(at.x,(at.y-atlasScale.y)/(1.-atlasScale.y));
  float alpha=texture(silhouettes,cut).r;
  if(alpha<.002)return vec4(0.);
  float y=texture(plate,at).r;
  return vec4(radiance(y,texture(survey,at).rg)*alpha,alpha);
}
${whiteoutField}
float drift(vec2 p){return texture(wind,fract(p)).r;}
void main(){
  float reveal=1.;
  vec4 gust=vec4(0.,0.,0.,transition);
  if(transition<1. && reduce<.5){
    gust=whiteout(uv,time,transition,night,reveal);
    if(reveal==0.){color=gust;return;}
  }
  vec2 jaw=jawRay.xy/jawRay.z;
  vec2 close=nearRay.xy/nearRay.z;
  vec4 ice=nearRay.z>0.?lip(close,nearBounds,nearOffset):vec4(0.);
  if(ice.a<.999 && jawRay.z>0.)ice+=(1.-ice.a)*lip(jaw,jawBounds,jawOffset);
  vec3 c=ice.rgb;
  if(ice.a<.999){
    vec2 ground=floorRay.w>0.?floorRay.xy/floorRay.z:sky;
    vec2 st=clamp(ground,0.,1.)*atlasScale;
    vec4 info=texture(survey,st);
    float y=texture(plate,st).r;
    if(info.b>.03 && reduce<.5){
      // Advect two samples of the baked breaking crests downstream. A second
      // phase takes over before the first returns to its starting position.
      vec2 face=ground-focus;
      float nearFall=exp(-dot(face*vec2(6.,12.),face*vec2(6.,12.)));
      vec2 travel=vec2(.002+.009*max(face.y,0.),.007+.021*nearFall)*atlasScale*info.b;
      float a=fract(time*.79),b=fract(a+.5);
      float one=texture(plate,st-travel*(a-.5)).r;
      float two=texture(plate,st-travel*(b-.5)).r;
      y=mix(y,mix(one,two,abs(2.*a-1.)),smoothstep(.22,.92,info.b));
    }
    c+=(1.-ice.a)*radiance(y,info.rg);
  }
  if(reduce<.5){
    // Backlit vapour follows the opening and the crosswind combs its crown.
    vec2 m=(jaw-focus)*vec2(7.5,12.);
    float steam=max(0.,1.-dot(m,m));
    if(steam>0.){
      float vapour=drift(jaw*vec2(2.9,7.1)+vec2(-time*.066,time*.022));
      c+=steam*steam*(vapour-.32)*.061;
    }
    float driftBand=max(0.,1.-abs(jaw.y-focus.y+.11)*15.);
    if(driftBand>0.){
      float crystals=drift(jaw*vec2(2.5,16.)+vec2(-time*.13,time*.013));
      c+=driftBand*smoothstep(.6,.94,crystals)*.045;
    }
  }
  color=vec4(mix(gust.rgb,c,reveal),gust.a);
}`;
