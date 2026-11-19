// The source camera projects baked radiance onto the stationary meshes. UVs
// remain attached to the lake and the slab when the live camera moves.
const rotate = `vec3 rotateRay(vec4 q,vec3 p){return p+2.*cross(q.xyz,cross(q.xyz,p)+q.w*p);}`;
const approach = `uniform sampler2D secondView,extension;
vec3 tallField(vec2 uv,float gate){
  const float extent=.5*(390./844.)/(1.6*1.55);
  vec2 p=vec2((uv.x-.5)/1.55+.5,.5+(uv.y-.5)*2.*extent);
  float row=p.y<.5 ? .5*p.y/(.5-extent+.002) : .5+.5*(p.y-(.5+extent-.002))/(.5-extent+.002);
  vec2 local=clamp(vec2(p.x,row),0.,1.);
  vec2 tex=(clamp(local*vec2(384.,448.),vec2(.5),vec2(383.5,447.5))+vec2(384.*gate,0.))/vec2(768.,448.);
  vec2 baseUV=(clamp(local*vec2(128.,64.),vec2(.5),vec2(127.5,63.5))+vec2(128.+128.*gate,448.))/512.;
  return textureLod(baseMap,baseUV,0.).rgb+(texture(extension,tex).rgb-.5)*.625;
}
uniform float travel;
in vec3 closeProjected;
vec3 readApproach(vec3 primary,bool slab,float uncovered){
  if(travel<=0. || closeProjected.z<=0.)return primary;
  vec2 uv=.5+.5*closeProjected.xy/closeProjected.z;
  vec2 edge=min(uv,1.-uv);
  float weight=max(smoothstep(.10,.91,travel),uncovered);
  vec3 sampleColor=texture(secondView,uv).rgb;
  if(!slab){
    vec2 baseUV=(clamp(uv*vec2(128.,64.),vec2(.5),vec2(127.5,63.5))+vec2(0.,448.))/512.;
    sampleColor=textureLod(baseMap,baseUV,0.).rgb+(sampleColor-.5)*.625;
    if(edge.y<.017)sampleColor=mix(sampleColor,tallField(uv,1.),1.-smoothstep(-.018,.017,edge.y));
    weight*=smoothstep(-.015,.012,edge.x);
  }else{
    if(max(max(sampleColor.r,sampleColor.g),sampleColor.b)<.04)return primary;
    weight*=smoothstep(-.025,.003,min(edge.x,edge.y));
  }
  return mix(primary,sampleColor,weight);
}`;
export const meshVertex = `#version 300 es
precision highp float;
layout(location=0) in vec3 pos;
layout(location=1) in vec2 octNormal;
uniform vec3 low,span,eye;
uniform vec2 lens,restLens,aim;
out vec3 world,normal,projected,closeProjected;
uniform vec4 rotation,endRotation;
uniform vec3 endEye;
uniform vec2 endLens;
${rotate}
void main(){
  world=low+span*pos;
  vec2 oct=octNormal*2.-1.;
  normal=vec3(oct,1.-abs(oct.x)-abs(oct.y));
  if(normal.z<0.) normal.xy=(1.-abs(normal.yx))*sign(normal.xy);
  projected=vec3(world.x/restLens.x,-world.y/restLens.y,world.z);
  // Distant rays in the survey converge to 60 metres. The solar disc
  // and sky translate at infinity while the near relief keeps its parallax.
  float translation=1.-smoothstep(48.,59.8,world.z);
  vec3 end=rotateRay(endRotation,world-endEye*translation);
  closeProjected=vec3(end.x/endLens.x,-end.y/endLens.y,end.z);
  vec3 p=rotateRay(rotation,world-eye*translation);
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
  vec2 coord=vec2(p.x,(clamp(p.y,0.,1.)*(band.y-1.)+band.x+.5)/512.);
  return clamp(texture(baseMap,coord).rgb+residual,0.,1.);
}
vec3 fromShape(vec3 c){return max(vec3(0.),(exp2(14.*c)-1.)/1024.);}
vec3 toShape(vec3 c){return log2(1.+1024.*max(c,vec3(0.)))/14.;}`;
// Both cameras share the same frozen surface, sampled in metres. The
// bake supplies the diffuse field. Only the tiny facets facing the low
// sun brighten as the viewing direction crosses the reflection.
export const lakeSurface = `
uniform sampler2D lakeUV,grain,fractures;
uniform float daylight;
vec3 nearSurface(vec2 metres,vec2 uvLake,vec3 direction){
  vec4 baked=texture(lakeUV,uvLake);
  float mask=clamp((baked.a*255.-64.)/191.,0.,1.);
  vec3 detail=texture(grain,metres*vec2(.68,1.16)).rgb;
  float crystal=texture(grain,metres*6.13).r;
  float dust=mask+(detail.b-.5)*.15+(detail.r-.5)*.15+(crystal-.5)*.11;
  float frost=smoothstep(.36,.64,dust);
  vec3 stepColor=mix(vec3(.285,.245,.203),vec3(.315,.288,.275),daylight);
  vec3 field=baked.rgb+frost*stepColor;
  field+=((detail.r-.5)*.040+(crystal-.5)*.024+(detail.b-.5)*.010)*mix(.21,1.,frost);
  vec2 joint=texture(fractures,uvLake).rg;
  float side=joint.r*2.05-.55+(crystal-.5)*.09;
  float lip=1.-smoothstep(.018,.085,abs(side));
  float wall=smoothstep(.015,.19,side)*(1.-smoothstep(.49,.93,side));
  float air=(.68*lip+wall*(.35+.40*detail.r))*joint.g*(1.-frost);
  field+=air*mix(vec3(.10,.13,.14),vec3(.18,.21,.225),daylight);
  vec3 delta=(normalize(direction)-normalize(vec3(.80,.98,-.077)))*vec3(1.,.5,.25);
  float path=1.-smoothstep(.013,.099,length(delta));
  return mix(field,vec3(.774,.767,.746),daylight*path*(1.-frost)*detail.g*.82);
}`;
export const groundFragment = `#version 300 es
precision highp float;
in vec3 projected,world;
uniform sampler2D atlas,baseMap;
${lakeSurface}
uniform vec4 waterPlane,eastAxis,northAxis;
uniform vec3 eye;
out vec4 color;
${field}
${approach}
vec3 surveyedGround(){
  vec2 uv=.5+.5*projected.xy/projected.z;
  vec3 c=readField(atlas,baseMap,uv,vec2(0.,320.));
  if(uv.y<.017 || uv.y>.983){
    float blend=1.-smoothstep(-.018,.017,min(uv.y,1.-uv.y));
    c=mix(c,tallField(uv,0.),blend);
  }
  // Cycles includes the low, sky-matched fog at the rest camera. Apply
  // only the optical-path change when the camera enters the basin.
  float path=clamp((world.z-32.)*.012,0.,1.)*max(-eye.z,0.)*.004;
  float uncovered=1.-smoothstep(-.025,.003,min(uv.x,1.-uv.x));
  return readApproach(mix(c,vec3(.59,.60,.605),path),false,uncovered);
}
void main(){
  // Evaluate the camera field across the whole fragment quad. Its mip
  // derivatives stay continuous where the metric survey begins.
  vec3 surveyed=surveyedGround();
  // Intersect the viewing ray with the physical lake, including pixels
  // uncovered between survey samples. Orthographic baking gives constant
  // texels per metre on both the windbank and the exposed ice.
  vec3 ray=world-eye;
  float vertical=dot(waterPlane.xyz,ray);
  if(vertical<-.0001){
    float t=-dot(waterPlane,vec4(eye,1.))/vertical;
    vec4 hit=vec4(eye+t*ray,1.);
    vec2 metres=vec2(dot(eastAxis,hit),dot(northAxis,hit));
    vec2 uvLake=(metres*vec2(1.,-1.)+vec2(10.,3.))/vec2(18.,16.);
    vec2 edge=min(uvLake,1.-uvLake)*vec2(18.,16.);
    float along=metres.y-.13*metres.x;
    float distanceToEye=length(hit.xyz-eye);
    float mixLake=(1.-smoothstep(-2.0,-.74,along))*(1.-smoothstep(4.8,7.1,distanceToEye))
                  *smoothstep(.04,.54,min(edge.x,edge.y));
    if(mixLake>0.){
      vec3 direction=vec3(dot(eastAxis.xyz,ray),dot(northAxis.xyz,ray),vertical);
      vec3 local=nearSurface(metres,uvLake,direction);
      color=vec4(mix(surveyed,local,mixLake),0.);
      return;
    }
  }
  color=vec4(surveyed,0.);
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
${approach}
void main(){
  if(dot(vec4(world,1.),waterPlane)<-.045)discard;
  vec2 uv=(.5+.5*projected.xy/projected.z-crop.xy)/crop.zw;
  vec4 optical=texture(material,uv);
  vec2 xy=optical.rg*2.-1.;
  vec3 n=normalize(mix(vec3(xy,-sqrt(max(.001,1.-dot(xy,xy)))),normalize(normal),mix(.12,.82,travel)));
  vec3 view=normalize(eye-world);
  float fres=pow(1.-max(dot(n,view),0.),5.);
  vec3 reflection=reflect(-view,n);
  vec2 env=vec2(atan(reflection.x,reflection.z)*.159155+.5,acos(clamp(reflection.y,-1.,1.))*.31831);
  vec3 spec=linearLight(textureLod(environment,env,2.).rgb);
  vec2 refr=gl_FragCoord.xy/resolution+(2.+5.*optical.b)*n.xy/resolution;
  vec3 bg=fromShape(textureLod(behind,refr,.9+optical.b).rgb);
  vec3 c=fromShape(readField(body,baseMap,uv,vec2(328.,112.)))+(.05-.025*optical.b)*bg;
  float glint=pow(max(0.,dot(n,normalize(vec3(.81+.04*sin(time*.37),.49,-.24)))),18.);
  if(travel>0.)c=fromShape(readApproach(toShape(c),true,0.));
  color=vec4(toShape(c+spec*(.004+.052*fres)+glint*.11*(.55+.45*sin(world.x*2.5-time*.55))),1.);
}`;

export const bloomFragment = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D field,mat;
uniform vec2 lens,restLens,aim;
uniform vec3 eye;
uniform vec4 crop;
uniform float time;
out vec4 color;
uniform vec4 rotation;
uniform float travel;
${rotate}
vec2 project(vec2 p,float depth){
  vec3 ray=rotateRay(vec4(-rotation.xyz,rotation.w),vec3((p*2.-1.-aim)*lens,1.));
  vec2 original=(eye.xy+ray.xy*(depth-eye.z)/ray.z)/depth/restLens;
  return .5+.5*vec2(original.x,-original.y);
}
void main(){
  vec2 bg=project(uv,600.);
  float glow=(texture(field,vec2(bg.x,(clamp(bg.y,0.,1.)*319.+.5)/512.)).a-128./255.)*(255./127.);
  vec2 slab=(project(uv,11.)-crop.xy)/crop.zw;
  if(all(greaterThan(slab,vec2(0.)))&&all(lessThan(slab,vec2(1.)))){
    float rim=(texture(field,vec2(slab.x,(slab.y*111.+328.5)/512.)).a-128./255.)*(255./127.);
    vec2 n=textureLod(mat,slab,3.).rg*2.-1.;
    float glint=pow(max(0.,dot(n,normalize(vec2(.81+.04*sin(time*.37),.49)))),18.);
    glow+=rim*(1.+.25*glint);
  }
  color=vec4(vec3(glow*(1.-travel)),1.);
}`;

export const postFragment = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 uv;
uniform sampler2D scene,bloom;
uniform sampler3D grade;
uniform vec2 invResolution;
uniform vec4 slabBounds;
uniform float bloomGain;
out vec4 color;
void main(){
  vec4 centre=texture(scene,uv);
  vec3 c=centre.rgb;
  float y=dot(c,vec3(.213,.715,.072));
  vec2 slopes=vec2(dFdx(y),dFdy(y));
  float strength=max(abs(slopes.x),abs(slopes.y));
  if(strength>max(.07,y*.28)){
    vec2 normal=slopes/(abs(slopes.x)+abs(slopes.y)+.001);
    c=mix(c,(texture(scene,uv+.52*normal*invResolution).rgb+texture(scene,uv-.52*normal*invResolution).rgb)*.5,.42);
  }
  // Alpha identifies the opaque slab in the scene attachment. At its
  // silhouette estimate pixel coverage from four subpixel neighbours. The
  // untouched interior keeps its one-to-one frost and fracture detail.
  if(all(greaterThan(uv,slabBounds.xy))&&all(lessThan(uv,slabBounds.zw))){
    vec2 px=.72*invResolution;
    vec4 neighbours=.25*(texture(scene,uv+px)+texture(scene,uv-px)+
                         texture(scene,uv+vec2(px.x,-px.y))+texture(scene,uv+vec2(-px.x,px.y)));
    c=mix(c,neighbours.rgb,smoothstep(.01,.13,abs(neighbours.a-centre.a))*.89);
  }
  c+=textureLod(bloom,uv,1.65).rgb*bloomGain;
  vec3 shaped=clamp(c,0.,1.);
  float dither=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5;
  float chromaNoise=fract(52.9829189*fract(dot(gl_FragCoord.yx,vec2(.06711056,.00583715))))-.5;
  shaped+=vec3(dither+.32*chromaNoise,dither,dither-.32*chromaNoise)*.0038;
  color=vec4(texture(grade,(shaped*31.+.5)/32.).rgb+chromaNoise*1.5/255.,1.);
}`;

export const driftVertex = `#version 300 es
precision highp float;
uniform float time,dpr;
uniform vec3 eye;
uniform vec2 lens,aim;
uniform vec4 waterPlane;
out float opacity;
uniform vec4 rotation;
${rotate}
float hash(float x){return fract(sin(x)*43758.5453);}
void main(){
  float i=float(gl_VertexID+1),layer=mod(i,3.);
  float phase=fract(hash(i*2.17)+time*(.008+.003*layer));
  float z=6.+layer*6.+4.*hash(i*4.73);
  float x=(phase-.5)*z*.9;
  float height=.03+.23*hash(i*5.41)+.025*sin(time*.54+i);
  float y=(height-waterPlane.w-dot(waterPlane.xz,vec2(x,z)))/waterPlane.y;
  vec3 p=rotateRay(rotation,vec3(x,y,z)-eye);
  gl_Position=vec4(p.xy/lens+p.z*aim,p.z*.99985-.11,p.z);
  gl_PointSize=dpr*clamp(18./p.z,.85,2.4);
  opacity=(.10+.07*hash(i*3.39))*smoothstep(0.,.08,phase)*smoothstep(0.,.08,1.-phase);
}`;
export const driftFragment = `#version 300 es
precision mediump float;
in float opacity;
out vec4 color;
void main(){color=vec4(.57,.64,.72,opacity*(1.-smoothstep(.12,.49,length(gl_PointCoord-.5))));}`;
