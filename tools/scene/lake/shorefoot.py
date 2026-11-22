# Sink the cropped envelope of the scan into the lake along its full length.
from scipy.ndimage import minimum_filter1d, gaussian_filter1d
arr=np.empty((len(cliff.data.vertices),3),np.float32)
cliff.data.vertices.foreach_get('co',arr.ravel())
x,y,z=arr.T
bucket=((x-x.min())/(x.max()-x.min())*127).astype(int)
zfloor=np.full(128,20.)
np.minimum.at(zfloor,bucket,z)
zfloor=gaussian_filter1d(minimum_filter1d(zfloor,5),2.)
z[:]-=zfloor[bucket]
cliff.data.vertices.foreach_set('co',arr.ravel())
cliff.data.update()
for k,crag in enumerate(crags):
    crag.location=([ -15,-7,3,12,20][k],[39,41,43,38,42][k],[-.57,-.65,-.48,-.66,-.64][k])
    crag.scale=([1.2,1.4,1.27,1.62,1.29][k],.83,[.22,.28,.19,.25,.21][k])
# Low banks of frost-shattered moraine fuse the headlands to the shore. 
# Their true shoreline crosses the water table; the crest falls landward.
gx=np.linspace(-38,38,580);gy=np.linspace(26,78,320)
Xc,Yc=np.meshgrid(gx,gy)
frontline=33.5+2.3*np.sin(Xc*.24)+1.4*np.cos(Xc*.57)+.75*np.sin(Xc*.79)
slope=Yc-frontline
cove=measured_snow("Snow009A",Xc*.039,Yc*.073)
scree=.27+.52*np.sin(.19*Xc+1.3)**2+.28*np.sin(.46*Xc)**2
gc=np.clip(slope*.30,-.96,1)*scree + .34*(cove-.5)
gc+=np.clip(slope/7,0,1)*(.36+.2*np.sin(Xc*.43))
screeMat,screeBs=surface("Rocky winter foreshore",(.057,.065,.074),.94)
ct=screeMat.node_tree
speck=node(ct,"ShaderNodeTexNoise",Scale=4.2,Detail=6)
wire(ct,node(ct,"ShaderNodeTexCoord"),"Object",speck,0)
tones=node(ct,"ShaderNodeValToRGB")
tones.color_ramp.elements[0].position=.30
tones.color_ramp.elements[0].color=(.018,.021,.024,1)
tones.color_ramp.elements[1].position=.76
tones.color_ramp.elements[1].color=(.21,.24,.25,1)
wire(ct,speck,0,tones,0)
wire(ct,tones,0,screeBs,"Base Color")
wire(ct,tones,0,screeBs,"Emission Color")
screeBs.inputs["Emission Strength"].default_value=.13
relief(screeMat,screeBs,3,.12,.64)
foreshore=field("Scoured foreshore",gx,gy,gc,screeMat)
suntarget.objects.link(foreshore)
# The refrozen skin immediately round a pressure ridge is rougher than the
# open black ice. Reflect the name in the open lead past the grounded edges.
lt=lid.node_tree
worldxyz=node(lt,"ShaderNodeNewGeometry")
yp=node(lt,"ShaderNodeSeparateXYZ")
wire(lt,worldxyz,"Position",yp,0)
wobble=node(lt,"ShaderNodeTexNoise",Scale=2.4,Detail=3)
wire(lt,worldxyz,"Position",wobble,0)
signed=node(lt,"ShaderNodeMath")
signed.operation="MULTIPLY_ADD"
wire(lt,wobble,0,signed,0)
signed.inputs[1].default_value=.22
wire(lt,yp,"Y",signed,2)
refzone=node(lt,"ShaderNodeMapRange")
refzone.interpolation_type="SMOOTHERSTEP"
refzone.inputs["From Min"].default_value=-1.7
refzone.inputs["From Max"].default_value=-.37
refzone.inputs["To Min"].default_value=.048
refzone.inputs["To Max"].default_value=.0010
wire(lt,signed,0,refzone,0)
wire(lt,refzone,0,combine,0)
roughzone=node(lt,"ShaderNodeMapRange")
roughzone.inputs["From Min"].default_value=-1.55
roughzone.inputs["From Max"].default_value=-.28
roughzone.inputs["To Min"].default_value=.135
roughzone.inputs["To Max"].default_value=.38
wire(lt,signed,0,roughzone,0)
wire(lt,roughzone,0,mirror,"Roughness")
for lamp in [front,rear]:
    lamp.visible_glossy=False
    lamp.data.specular_factor=.05
# Return a tenuous line of scattered sunlight to the sun over its fog bank.
ray=Vector((.166,1,.075)).normalized()
distance.inputs[1].default_value=ray
sun.rotation_euler=(-ray).to_track_quat("-Z","Y").to_euler()
skybg.inputs["Strength"].default_value=.42
sunlit.inputs[0].default_value=.95
fade.inputs["To Min"].default_value=.017
mist.inputs["Anisotropy"].default_value=.26
# The brow of the closer range should keep its texture beneath the cloud.
ranges[0][0].scale.z=.65
ranges[0][0].location.x=-16
ranges[1][0].location.x=30
ranges[2][0].scale.z=.68
front.data.energy=1030
rear.data.energy=810
