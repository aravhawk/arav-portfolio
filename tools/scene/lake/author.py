"""Render the O1 art proof from the repository root with Blender's Python module."""

import argparse
import math
import random
from pathlib import Path

import bpy
import numpy as np
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from mathutils import Vector, noise
from mathutils.bvhtree import BVHTree
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument("--width", type=int, default=2880)
parser.add_argument("--samples", type=int, default=48)
parser.add_argument("--output", default=".tools/out/o2/bake/day.png")
parser.add_argument("--geometry", action="store_true", help="Export the light meshes and slab normal atlas instead of rendering the plate")
parser.add_argument("--bake-geometry", action="store_true", help="Export the original rendered scene after both passes")
parser.add_argument("--theme", choices=["day","night"],default="day")
parser.add_argument("--portrait", action="store_true",help="Bake the tall background outside the composed desktop frame")
args = parser.parse_args()
out = Path(args.output).resolve()
out.parent.mkdir(parents=True, exist_ok=True)
cache = Path.home() / ".t3/portfolio-redesign-v4/assets-src"
random.seed(421)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "METAL"
prefs.refresh_devices()
for device in prefs.devices:
    device.use = device.type == "METAL"
scene.cycles.device = "GPU"
scene.cycles.samples = args.samples
scene.cycles.use_denoising = True
scene.cycles.transparent_max_bounces = 8
scene.render.resolution_x = args.width
scene.render.resolution_y = round(args.width * 5 / 8)
scene.render.resolution_percentage = 100
scene.render.filepath = str(out)
scene.world = bpy.data.worlds.new("Winter light")
scene.world.use_nodes = True


def node(tree, kind, **values):
    n = tree.nodes.new(kind)
    for key, val in values.items():
        n.inputs[key].default_value = val
    return n


def wire(tree, a, output, b, inp):
    tree.links.new(a.outputs[output], b.inputs[inp])


def surface(name, color, roughness, **values):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get("Principled BSDF")
    for key, value in {
        "Base Color": (*color, 1),
        "Roughness": roughness,
        **values,
    }.items():
        bs.inputs[key].default_value = value
    return mat, bs


def relief(mat, bs, scale, distance, strength):
    tree = mat.node_tree
    tex = node(tree, "ShaderNodeTexNoise", Scale=scale, Detail=4)
    coords = node(tree, "ShaderNodeTexCoord")
    wire(tree, coords, "Object", tex, "Vector")
    bump = node(tree, "ShaderNodeBump", Distance=distance, Strength=strength)
    wire(tree, tex, "Fac", bump, "Height")
    wire(tree, bump, "Normal", bs, "Normal")


def geometry(name, vertices, faces, material, smooth=True):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    mesh.materials.append(material)
    if smooth:
        mesh.polygons.foreach_set("use_smooth", np.ones(len(faces), dtype=bool))
    return obj


def sheet(name, xs, ys, height, mat):
    width = len(xs)
    verts = [(x, y, height(x, y)) for y in ys for x in xs]
    faces = [
        (i, i + 1, i + width + 1, i + width)
        for j in range(len(ys) - 1)
        for k in range(width - 1)
        for i in [j * width + k]
    ]
    return geometry(name, verts, faces, mat)


tree = scene.world.node_tree
env = node(tree, "ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(str(cache / "frozen_lake_2k.hdr"))
bg = tree.nodes.get("Background")
wire(tree, env, "Color", bg, "Color")
bg.inputs["Strength"].default_value = 0.7

"""Study a window of ice over a dark bed with under-surface thermal fissures."""
from scipy.ndimage import gaussian_filter, map_coordinates
from scipy.spatial import Voronoi

def field(name, xs, ys, heights, mat):
    nx=len(xs)
    ny=len(ys)
    xx,yy=np.meshgrid(xs,ys)
    pts=np.stack((xx,yy,heights),axis=-1).astype(np.float32).reshape(-1,3)
    ids=np.arange(len(pts),dtype=np.int32).reshape(ny,nx)[:-1,:-1].reshape(-1)
    faces=np.column_stack((ids,ids+1,ids+nx+1,ids+nx)).astype(np.int32)
    if name=="Sastrugi":
        # Keep only the exposed surface. Under transparent ice a buried snow
        # blanket would return white light all the way to the horizon.
        exposed=np.max(pts[faces,2],axis=1)>-.001
        faces=faces[exposed]
    mesh=bpy.data.meshes.new(name)
    mesh.vertices.add(len(pts))
    mesh.vertices.foreach_set("co",pts.ravel())
    mesh.loops.add(faces.size)
    mesh.loops.foreach_set("vertex_index",faces.ravel())
    mesh.polygons.add(len(faces))
    mesh.polygons.foreach_set("loop_start",np.arange(len(faces),dtype=np.int32)*4)
    mesh.polygons.foreach_set("use_smooth",np.ones(len(faces),dtype=bool))
    mesh.update(calc_edges=True)
    obj=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    mesh.materials.append(mat)
    return obj

bed,bsbed=surface("Under-ice water",(.012,.021,.024),.86)
sheet("Water below",[-120,120],[-40,165],lambda x,y:-.43,bed)
lid,skin=surface("Clear lake surface",(.86,.90,.92),.15,**{"IOR":1.31,"Transmission Weight":1})
# Shadow rays pass through this thin sheet to light the cracks below.
tr=lid.node_tree
coat=node(tr,"ShaderNodeMixShader")
wire(tr,node(tr,"ShaderNodeLightPath"),"Is Shadow Ray",coat,0)
wire(tr,skin,0,coat,1)
wire(tr,node(tr,"ShaderNodeBsdfTransparent"),0,coat,2)
wire(tr,coat,0,tr.nodes.get("Material Output"),0)
cover=sheet("Ice window",[-120,120],[-40,165],lambda x,y:0,lid)
relief(lid,skin,12,.0018,.21)
fract,fractbs=surface("Buried fracture plane",(.60,.72,.75),.38)
verts,faces=[],[]
rng=np.random.default_rng(241)
# Interlocking fracture network in the top 15 cm. The same banks continue
# down through the lake skin, with much finer secondary shear lines.
for density,deep in [(90,.13),(235,.036)]:
    points=rng.uniform((-16,-12),(16,16),size=(density,2))
    diagram=Voronoi(points)
    for ia,ib in diagram.ridge_vertices:
        if min(ia,ib)<0: continue
        a,b=diagram.vertices[[ia,ib]]
        dist=np.linalg.norm(b-a)
        if dist>7 or dist<.06: continue
        count=max(3,int(dist*24))
        side=(b-a)[::-1]*np.array([1,-1])/dist
        offset=0
        width=deep*rng.uniform(.4,1.6)
        dip=rng.uniform(-.8,.8)
        start=len(verts)
        for j in range(count+1):
            t=j/count
            offset=.86*offset+rng.normal(0,.013)
            xy=a+(b-a)*t+side*offset*math.sin(math.pi*t)
            depth=width*(.45+.4*math.sin(t*6.28)+rng.uniform(.07,.27))
            verts.extend([(*xy,-.007),(*(xy+side*depth*dip),-.009-depth)])
            k=start+2*j
            if j: faces.append((k-2,k-1,k+1,k))
network=geometry("Lake cleavage network",verts,faces,fract,False)
network.hide_render=True
# Tension fractures advance independently. Short splays turn off the
# main fault; their changing dip produces an intermittent glint.
local=random.Random(334)
verts,faces=[],[]
def trace(x,y,angle,length,depth,branch=True):
    count=int(length/.085)
    dip=local.uniform(-.7,.7)
    for j in range(count):
        t=j/max(1,count)
        angle+=local.uniform(-.09,.09)+.001
        dx,dy=.085*math.cos(angle),.085*math.sin(angle)
        w=depth*(math.sin(math.pi*t)**.67 )
        if j and branch and local.random()<.012:
            trace(x,y,angle+local.choice([-.84,.73]),length*.28,w*.31,False)
        nx,ny=x+dx,y+dy
        k=len(verts)
        d=w*(.86+local.uniform(-.11,.11))
        t0=local.uniform(.60,1.05)
        sx,sy=-dy/.085*dip,dx/.085*dip
        verts.extend([(x,y,-.009),(nx,ny,-.009),(nx+sx*d,ny+sy*d,-.009-d),(x+sx*w*t0,y+sy*w*t0,-.009-w*t0)])
        faces.append((k,k+1,k+2,k+3))
        x,y=nx,ny
for j in range(115):
    trace(local.uniform(-14,14),local.uniform(-12,16),local.uniform(-3.14,3.14),
        local.uniform(2,16),local.choice([.008,.012,.022,.035,.078]))
network=geometry("Thermal faults",verts,faces,fract,False)
network.visible_shadow=False

snow,snowbs=surface("Windpack",(.77,.82,.86),.81)
relief(snow,snowbs,220,.002,.36)
xs=np.linspace(-13,13,840)
ys=np.linspace(-12,6,640)
xx,yy=np.meshgrid(xs,ys)
# Crosswind profiles have a long ascent and a short, steep lee slope.
u=xx*.93+yy*.37
v=yy*.93-xx*.37
wind=np.zeros_like(xx)
rng=np.random.default_rng(819)
for j in range(440):
    cx,cy=rng.uniform((-17,-14),(17,10))
    length=rng.uniform(.36,2.65)
    width=rng.uniform(.085,.41)
    dx=(u-cx)/length
    bend=v-cy+.14*dx**2+dx*.18
    cross=bend/np.where(bend>0,width,width*.18)
    height=rng.uniform(.035,.126)
    wind=np.maximum(wind,height*np.exp(-dx**2*1.8-cross**2*1.8))
def rand_field(scale):
    grid=gaussian_filter(rng.normal(size=xx.shape),scale)
    return grid/(grid.std()+1e-9)
grain=rand_field(2)
ripples=rand_field((7,40))
margin=(-(yy+4.0)+.35*xx+.20*np.sin(2.0*xx)+.42*np.cos(.7*xx)+.28*ripples+.055*grain)
base=np.clip(margin*.14,-.27,.05)
height=base+wind+.006*grain+.009*ripples
height=base+wind*1.55+.0013*grain+.003*ripples
phase=v*11+.9*np.sin(u*1.3)+.32*np.sin(u*3.7)+.29*ripples
crest=np.mod(phase,2*math.pi)/(2*math.pi)
lee=np.exp(-((crest-.76)/np.where(crest>.76,.052,.29))**2)
height+=.065*lee*np.clip(.55+.45*ripples,0,1)
mantle=field("Sastrugi",xs,ys,height,snow)
skin.inputs["Roughness"].default_value=.23
skin.inputs["IOR"].default_value=1.16
bg.inputs["Strength"].default_value=.35
frac_tree=fract.node_tree
tex=node(frac_tree,"ShaderNodeTexNoise",Scale=55,Detail=3)
wire(frac_tree,node(frac_tree,"ShaderNodeTexCoord"),"Object",tex,0)
col=node(frac_tree,"ShaderNodeValToRGB")
col.color_ramp.elements[0].color=(.09,.13,.15,1)
col.color_ramp.elements[1].color=(.97,1,1,1)
wire(frac_tree,tex,0,col,0)
wire(frac_tree,col,0,fractbs,"Base Color")
fractbs.inputs["Emission Color"].default_value=(.65,.75,.76,1)
fractbs.inputs["Emission Strength"].default_value=.25
tr=snow.node_tree
tex=node(tr,"ShaderNodeTexImage")
tex.image=bpy.data.images.load(str(cache/"snow_field_aerial_height_2k.jpg"),check_existing=True)
tex.image.colorspace_settings.name="Non-Color"
mapping=node(tr,"ShaderNodeVectorMath")
mapping.operation="SCALE"
mapping.inputs["Scale"].default_value=.68
wire(tr,node(tr,"ShaderNodeTexCoord"),"Object",mapping,0)
wire(tr,mapping,0,tex,0)
micro=node(tr,"ShaderNodeBump",Distance=.010,Strength=.53)
wire(tr,tex,0,micro,"Height")
wire(tr,micro,0,snowbs,"Normal")
# Comparison under lower sky return, retaining the snow on its lit side.
bg.inputs["Strength"].default_value=.22
skin.inputs["Roughness"].default_value=.21
skin.inputs["IOR"].default_value=1.11
bsbed.inputs["Base Color"].default_value=(.008,.013,.016,1)
# Partial polarisation of the grazing reflection lets the under-ice
# fissure wall show through, even near the horizon.
tr=lid.node_tree
polar=node(tr,"ShaderNodeMixShader",Fac=.70)
wire(tr,skin,0,polar,1)
wire(tr,node(tr,"ShaderNodeBsdfTransparent"),0,polar,2)
wire(tr,polar,0,coat,1)
polar.inputs[0].default_value=.34
fractbs.inputs["Emission Strength"].default_value=.1
# Carve the scalloped edge at the actual water level per sample.
st=snow.node_tree
split=node(st,"ShaderNodeSeparateXYZ")
wire(st,node(st,"ShaderNodeNewGeometry"),"Position",split,0)
clip=node(st,"ShaderNodeMath")
clip.operation="LESS_THAN"
wire(st,split,"Z",clip,0)
clip.inputs[1].default_value=.0002
fade=node(st,"ShaderNodeMixShader")
wire(st,clip,0,fade,0)
wire(st,snowbs,0,fade,1)
wire(st,node(st,"ShaderNodeBsdfTransparent"),0,fade,2)
wire(st,fade,0,st.nodes.get("Material Output"),0)
diffuse=node(st,"ShaderNodeTexImage")
diffuse.image=bpy.data.images.load(str(cache/"snow_field_aerial_col_2k.jpg"),check_existing=True)
wire(st,mapping,0,diffuse,0)
blend=node(st,"ShaderNodeMixRGB",Fac=.64)
wire(st,diffuse,0,blend,1)
blend.inputs[2].default_value=(.8,.82,.84,1)
wire(st,blend,0,snowbs,"Base Color")
# Diffuse trapped air makes the wall fade into black ice with depth.
tr=fract.node_tree
depth=node(tr,"ShaderNodeSeparateXYZ")
wire(tr,node(tr,"ShaderNodeNewGeometry"),"Position",depth,0)
fade=node(tr,"ShaderNodeMapRange")
fade.inputs["From Min"].default_value=-.09
fade.inputs["From Max"].default_value=-.009
fade.inputs["To Min"].default_value=.05
fade.inputs["To Max"].default_value=.86
wire(tr,depth,"Z",fade,0)
blend=node(tr,"ShaderNodeMixShader")
wire(tr,fade,0,blend,0)
wire(tr,node(tr,"ShaderNodeBsdfTransparent"),0,blend,1)
wire(tr,fractbs,0,blend,2)
wire(tr,blend,0,tr.nodes.get("Material Output"),0)
bg.inputs["Strength"].default_value=.29
polar.inputs[0].default_value=.16
micro.inputs["Distance"].default_value=.016
import zipfile
ranges=[]
for j,(tid,origin,span,gain) in enumerate([("004",85,92,23),("005",145,126,20),("003",225,187,32)]):
    src=f"Terrain{tid}_2K"
    im=bpy.data.images.load(str(cache/(src+".exr")))
    im.colorspace_settings.name="Non-Color"
    a=np.empty(2048*2048*4,np.float32)
    im.pixels.foreach_get(a)
    reliefmap=a.reshape(2048,2048,4)[::3,::3,0].copy()
    count=reliefmap.shape[0]
    coord=np.linspace(0,1,count)
    xs=(coord-.5)*span
    ys=(coord-.5)*span*.66+origin
    foot=np.minimum(1,coord/.14)
    z=(reliefmap*gain-.48)*foot[:,None] - (1-foot[:,None])*1.1
    mat,bs=surface("Ridge "+tid,(.42,.48,.56),.92)
    tr=mat.node_tree
    # Height, albedo and deposit maps share one UV projection.
    uv=node(tr,"ShaderNodeUVMap")
    zipfile_path=cache/(src+"-JPG.zip")
    with zipfile.ZipFile(zipfile_path) as arc:
        colors=next(f for f in arc.namelist() if f.endswith("_Color.jpg"))
        albedo=cache/colors
        if not albedo.exists(): albedo.write_bytes(arc.read(colors))
    tex=node(tr,"ShaderNodeTexImage")
    tex.image=bpy.data.images.load(str(albedo))
    wire(tr,uv,0,tex,0)
    bw=node(tr,"ShaderNodeRGBToBW")
    wire(tr,tex,0,bw,0)
    rocks=node(tr,"ShaderNodeValToRGB")
    rocks.color_ramp.elements[0].position=.10
    rocks.color_ramp.elements[0].color=(.045,.054,.066,1)
    rocks.color_ramp.elements[1].position=.69
    rocks.color_ramp.elements[1].color=(.75,.79,.81,1)
    wire(tr,bw,0,rocks,0)
    wire(tr,rocks,0,bs,"Base Color")
    grain=node(tr,"ShaderNodeBump",Distance=.1,Strength=.34)
    wire(tr,bw,0,grain,"Height")
    wire(tr,grain,0,bs,"Normal")
    geo=node(tr,"ShaderNodeNewGeometry")
    altitude=node(tr,"ShaderNodeSeparateXYZ")
    wire(tr,geo,"Position",altitude,0)
    mist=node(tr,"ShaderNodeMapRange")
    mist.interpolation_type="SMOOTHERSTEP"
    mist.inputs["From Min"].default_value=-.4
    mist.inputs["From Max"].default_value=3.1
    mist.inputs["To Min"].default_value=[.34,.6,.78][j]
    mist.inputs["To Max"].default_value=[.10,.34,.58][j]
    wire(tr,altitude,"Z",mist,0)
    mix=node(tr,"ShaderNodeMixShader")
    wire(tr,mist,0,mix,0)
    wire(tr,bs,0,mix,1)
    fog=node(tr,"ShaderNodeEmission",Color=(.46,.53,.59,1))
    wire(tr,fog,0,mix,2)
    wire(tr,mix,0,tr.nodes.get("Material Output"),0)
    mountains=field("Watershed "+str(j),xs,ys,z,mat)
    mesh=mountains.data
    layer=mesh.uv_layers.new()
    indices=np.empty(len(mesh.loops),np.int32)
    mesh.loops.foreach_get("vertex_index",indices)
    uvmap=np.column_stack((indices%count,indices//count)).astype(np.float32)/(count-1)
    layer.data.foreach_set("uv",uvmap.ravel())
    ranges.append((mountains,mist,fog,rocks))
# Camera sees the photographed sky; the terrain receives the lake HDRI.
world=scene.world.node_tree
above=node(world,"ShaderNodeTexEnvironment")
above.image=bpy.data.images.load(str(cache/"snow_field_2_puresky_4k.hdr"))
direction=node(world,"ShaderNodeMapping")
wire(world,node(world,"ShaderNodeTexCoord"),"Generated",direction,0)
wire(world,direction,0,above,0)
skybg=node(world,"ShaderNodeBackground",Strength=.6)
wire(world,above,0,skybg,0)
mix=node(world,"ShaderNodeMixShader")
wire(world,node(world,"ShaderNodeLightPath"),"Is Camera Ray",mix,0)
wire(world,bg,0,mix,1)
wire(world,skybg,0,mix,2)
wire(world,mix,0,world.nodes.get("World Output"),0)
bpy.ops.object.light_add(type="SUN")
sun=bpy.context.object
sun.rotation_euler=Vector((-.65,-1,-.18)).to_track_quat("-Z","Y").to_euler()
sun.data.energy=4
sun.data.color=(1,.94,.86)
sun.data.angle=.028
bg.inputs["Strength"].default_value=.48
bpy.ops.object.camera_add(location=(.85,-19,1.05))
cam=bpy.context.object
cam.rotation_euler=(Vector((0,0,.41))-cam.location).to_track_quat("-Z","Y").to_euler()
cam.data.angle=math.radians(30)
cam.data.clip_end=650
scene.camera=cam
# Ground fog occupies a volume over the far ice; its upper edge dissolves
# continuously. Long sightlines through it hide the mountain/lake intersection.
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,96,1.6))
fogbox=bpy.context.object
fogbox.dimensions=(230,160,5)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
air=bpy.data.materials.new("Low ice fog")
air.use_nodes=True
fogbox.data.materials.append(air)
tr=air.node_tree
tr.nodes.remove(tr.nodes.get("Principled BSDF"))
pos=node(tr,"ShaderNodeNewGeometry")
alt=node(tr,"ShaderNodeSeparateXYZ")
wire(tr,pos,"Position",alt,0)
drift=node(tr,"ShaderNodeTexNoise",Scale=.09,Detail=2)
wire(tr,pos,"Position",drift,0)
fade=node(tr,"ShaderNodeMapRange")
fade.interpolation_type="SMOOTHERSTEP"
fade.inputs["From Min"].default_value=.06
fade.inputs["From Max"].default_value=3.8
fade.inputs["To Min"].default_value=.019
fade.inputs["To Max"].default_value=0
wire(tr,alt,"Z",fade,0)
density=node(tr,"ShaderNodeMath")
density.operation="MULTIPLY"
wire(tr,fade,0,density,0)
wire(tr,drift,0,density,1)
mist=node(tr,"ShaderNodeVolumeScatter",Color=(.81,.87,.94,1),Anisotropy=.42)
wire(tr,density,0,mist,"Density")
wire(tr,mist,0,tr.nodes.get("Material Output"),"Volume")
# Soft solar glow is aligned with the cast shadow of the day key.
world=scene.world.node_tree
skyvec=node(world,"ShaderNodeTexCoord")
distance=node(world,"ShaderNodeVectorMath")
distance.operation="DISTANCE"
wire(world,skyvec,"Generated",distance,0)
distance.inputs[1].default_value=Vector((.121,1,.080)).normalized()
sun_ramp=node(world,"ShaderNodeValToRGB")
sun_ramp.color_ramp.elements[0].color=(8.6,7.95,7.1,1)
sun_ramp.color_ramp.elements[1].position=.08
sun_ramp.color_ramp.elements[1].color=(0,0,0,1)
for t,val in [(.0038,8),(.006,1.9),(.013,.72),(.028,.21)]:
    s=sun_ramp.color_ramp.elements.new(t)
    s.color=(val,val*.95,val*.9,1)
wire(world,distance,"Value",sun_ramp,0)
sunlit=node(world,"ShaderNodeMixRGB",Fac=1)
sunlit.blend_type="ADD"
wire(world,above,0,sunlit,1)
wire(world,sun_ramp,0,sunlit,2)
wire(world,sunlit,0,skybg,0)
# Place the real HDR sun on the right, just above the far ridge.
im=above.image
buf=np.empty(im.size[0]*im.size[1]*4,np.float32)
im.pixels.foreach_get(buf)
lum=buf.reshape(im.size[1],im.size[0],4)[:,:,1]
y,x=np.unravel_index(lum.argmax(),lum.shape)
theta=(.5-x/im.size[0])*math.tau
phi=(y/im.size[1]-.5)*math.pi
v=Vector((math.cos(theta)*math.cos(phi),math.sin(theta)*math.cos(phi),math.sin(phi)))
wanted=Vector((.145,1,.080)).normalized()
direction.inputs["Rotation"].default_value=wanted.rotation_difference(v).to_euler()
skybg.inputs["Strength"].default_value=.85
for k,(m,mi,fo,rock) in enumerate(ranges):
    m.scale.z=[.78,.88,.95][k]
ranges[0][0].location.x=-9
ranges[2][0].location.x=12
ranges[0][1].inputs["To Min"].default_value=.19
ranges[0][2].inputs[0].default_value=(.21,.25,.29,1)
ranges[0][0].rotation_euler.z=.11
ranges[0][0].location.x=1
for m,mi,fo,rock in ranges:
    rock.color_ramp.elements[0].position=.045
    rock.color_ramp.elements[1].position=.43
for j,(m,mi,fo,rock) in enumerate(ranges):
    m.scale.z=[.42,.52,.48][j]
direction.inputs["Rotation"].default_value[2]-=.30
skybg.inputs["Strength"].default_value=.89
scene.cycles.volume_bounces=3
fade.inputs["To Min"].default_value=.035
ranges[0][1].inputs["To Min"].default_value=.30
sun.rotation_euler=Vector((-.23,-1,-.10)).to_track_quat("-Z","Y").to_euler()
sun.data.energy=6.1
ranges[0][0].scale.z=.52
ranges[1][0].location.x=12
skybg.inputs["Strength"].default_value=1.55
ranges[2][0].location.x=-40
ranges[1][1].inputs["To Max"].default_value=.59
ranges[2][1].inputs["To Max"].default_value=.76
font = instantiateVariableFont(TTFont("src/fonts/TASAOrbiter-VF.woff2"), {"wght":700})
from fontTools.ttLib.removeOverlaps import removeOverlaps
removeOverlaps(font)
font.flavor=None
fontpath=out.parent/"bold.ttf"
font.save(fontpath)
bpy.ops.object.text_add(rotation=(math.pi/2,0,0))
name=bpy.context.object
name.data.body="Arav Jain"
name.data.font=bpy.data.fonts.load(str(fontpath))
name.data.align_x="CENTER"
name.data.size=2
name.data.space_character=1.025
name.data.extrude=.18
name.data.bevel_depth=.012
name.data.bevel_resolution=3
name.data.resolution_u=36
bpy.ops.object.convert(target="MESH")
bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
# Join caps to the side walls before running volume light transport.
import bmesh
bm=bmesh.new()
bm.from_mesh(name.data)
bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=.00003)
bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
bm.to_mesh(name.data)
bm.free()
ice,bs=surface("Satin slab",(.92,.975,.98),.20,**{"IOR":1.31,"Transmission Weight":.94})
name.data.materials.append(ice)
tr=ice.node_tree
scat=node(tr,"ShaderNodeVolumeScatter",Color=(.88,.97,.985,1),Density=2,Anisotropy=.22)
absorb=node(tr,"ShaderNodeVolumeAbsorption",Color=(.44,.82,.85,1),Density=1)
total=node(tr,"ShaderNodeAddShader")
wire(tr,scat,0,total,0)
wire(tr,absorb,0,total,1)
wire(tr,total,0,tr.nodes.get("Material Output"),"Volume")
# Warped strata run diagonally into the material. They vary the density of trapped air.
coords=node(tr,"ShaderNodeTexCoord")
mapping=node(tr,"ShaderNodeMapping")
mapping.inputs["Rotation"].default_value[1]=-.61
mapping.inputs["Scale"].default_value=(3.5,3.1,1.3)
wire(tr,coords,"Object",mapping,0)
veils=node(tr,"ShaderNodeTexNoise",Scale=2.8,Detail=5.0,Roughness=.64,Distortion=.29)
wire(tr,mapping,0,veils,0)
ramp=node(tr,"ShaderNodeValToRGB")
ramp.color_ramp.elements[0].position=.28
ramp.color_ramp.elements[0].color=(.018,.018,.018,1)
ramp.color_ramp.elements[1].position=.72
ramp.color_ramp.elements[1].color=(1,1,1,1)
wire(tr,veils,0,ramp,0)
density_gain=node(tr,"ShaderNodeMath")
density_gain.operation="MULTIPLY"
density_gain.inputs[1].default_value=7
wire(tr,ramp,0,density_gain,0)
wire(tr,density_gain,0,scat,"Density")
rough_map=node(tr,"ShaderNodeMapRange")
rough_map.inputs["To Min"].default_value=.075
rough_map.inputs["To Max"].default_value=.34
wire(tr,ramp,0,rough_map,0)
wire(tr,rough_map,0,bs,"Roughness")
# Cleavage is a connected sheet clipped inside each stroke. Intersect the glyph
# with each thin solid so no flake can escape into an open counter.
fault,fb=surface("Closed air fissure",(.9,.96,.97),.18,**{"Transmission Weight":.66,"IOR":1.04})
faults=[]
for j,(x,z,ang,radius) in enumerate([(-.68,.78,-.57,.56),(-.37,.39,.98,.30),(.49,.65,-.75,.41),(.96,.26,.27,.27)]):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=8,location=(x,-.075,z))
    q=bpy.context.object
    q.name="Sealed cleavage"
    q.scale=(radius,.006,radius*.57)
    q.rotation_euler=(.53,.22+ang,-.32)
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    for v in q.data.vertices:
        v.co.y+=.008*noise.noise_vector(v.co*18)[0]
    q.data.materials.append(fault)
    mod=q.modifiers.new("Clip inside outline","BOOLEAN")
    mod.operation="INTERSECT"
    mod.object=name
    bpy.ops.object.modifier_apply(modifier=mod.name)
    # Interior sheets are inset even where they were trimmed to a glyph boundary.
    for v in q.data.vertices:
        v.co*=.978
    faults.append(q)
# A sparse rough skin pulls light across the otherwise satin planar faces.
grain=node(tr,"ShaderNodeTexNoise",Scale=160,Detail=2.0)
wire(tr,coords,"Object",grain,0)
bump=node(tr,"ShaderNodeBump",Distance=.0008,Strength=.19)
wire(tr,grain,0,bump,"Height")
wire(tr,bump,0,bs,"Normal")
# Millimetre-scale spalling confined to the cut edges; the broad sawn
# planes and the openings survive because the displacement fades on the caps.
bpy.context.view_layer.objects.active=name
name.select_set(True)
name.data.remesh_voxel_size=.005
bpy.ops.object.voxel_remesh()
normals=[v.normal.copy() for v in name.data.vertices]
for v,norm in zip(name.data.vertices,normals):
    pos=v.co.copy()
    edge=1-abs(norm.y)**9
    grain=noise.noise_vector(pos*11)[1]+.36*noise.noise_vector(pos*38)[0]
    chip=max(0,grain+.25)*.017
    v.co-=norm*(edge*chip)
name.data.update()
name.data.polygons.foreach_set("use_smooth",np.ones(len(name.data.polygons),dtype=bool))
# The sawn inner face has broad fans left by sheets of trapped air. A warp
# of the sampling frame bends their edges, while keeping the plates planar.
facet=node(tr,"ShaderNodeTexVoronoi",Scale=4.9)
facet.feature="DISTANCE_TO_EDGE"
mapped=node(tr,"ShaderNodeMapping")
mapped.inputs["Rotation"].default_value[1]=.81
mapped.inputs["Scale"].default_value=(1.3,2.1,.44)
wire(tr,coords,"Object",mapped,0)
wire(tr,mapped,0,facet,0)
lamina=node(tr,"ShaderNodeValToRGB")
lamina.color_ramp.elements[0].position=.008
lamina.color_ramp.elements[0].color=(.82,.82,.82,1)
lamina.color_ramp.elements[1].position=.052
lamina.color_ramp.elements[1].color=(0,0,0,1)
wire(tr,facet,0,lamina,0)
streak=node(tr,"ShaderNodeMath")
streak.operation="MULTIPLY"
wire(tr,lamina,0,streak,0)
wire(tr,ramp,0,streak,1)
cloudmat=node(tr,"ShaderNodeMixRGB")
cloudmat.inputs[1].default_value=(.44,.71,.71,1)
cloudmat.inputs[2].default_value=(.97,.995,.985,1)
wire(tr,ramp,0,cloudmat,0)
bands=node(tr,"ShaderNodeMixRGB")
wire(tr,streak,0,bands,0)
wire(tr,cloudmat,0,bands,1)
bands.inputs[2].default_value=(1,1,1,1)
wire(tr,bands,0,bs,"Base Color")
normal=node(tr,"ShaderNodeSeparateXYZ")
wire(tr,node(tr,"ShaderNodeNewGeometry"),"Normal",normal,0)
frostmask=node(tr,"ShaderNodeMath")
frostmask.operation="MULTIPLY"
wire(tr,normal,"Z",frostmask,0)
wire(tr,veils,0,frostmask,1)
frost=node(tr,"ShaderNodeMapRange")
frost.inputs["From Min"].default_value=.31
frost.inputs["From Max"].default_value=.68
wire(tr,frostmask,0,frost,0)
mix=node(tr,"ShaderNodeMixShader")
wire(tr,frost,0,mix,0)
wire(tr,bs,0,mix,1)
wire(tr,node(tr,"ShaderNodeBsdfDiffuse",Color=(.81,.85,.85,1)),0,mix,2)
wire(tr,mix,0,tr.nodes.get("Material Output"),0)

scene.cycles.volume_bounces=5
scat.inputs["Anisotropy"].default_value=.22
absorb.inputs["Density"].default_value=.75
bs.inputs["Subsurface Weight"].default_value=.15
bs.inputs["Subsurface Radius"].default_value=(.49,.86,.91)
bs.inputs["Subsurface Scale"].default_value=.08
bs.inputs["Transmission Weight"].default_value=.84
density_gain.inputs[1].default_value=3.1
fb.inputs["Transmission Weight"].default_value=.54
cloudmat.inputs[1].default_value=(.28,.57,.61,1)
def area(name,location,power,size,color):
    bpy.ops.object.light_add(type="AREA",location=location)
    light=bpy.context.object
    light.name=name
    light.rotation_euler=(Vector((0,0,.56))-light.location).to_track_quat("-Z","Y").to_euler()
    light.data.shape="RECTANGLE"
    light.data.size=size
    light.data.size_y=size*.45
    light.data.energy=power
    light.data.color=color
    return light
rear=area("Rear snowfield",(2.6,2.8,2.0),1150,7,(1,.97,.92))
front=area("Sky bounce",(-1,-4,3),850,7,(.94,.97,1))
# Angular broken plates in sheltered pockets beside the letter feet.
chips=[]
r=random.Random(9039)
for x in [-3.47,-2.14,-1.03,-.26,1.17,2.14,3.10,3.62]:
    for j in range(r.randrange(3,8)):
        radius=r.uniform(.045,.13)
        cnt=r.randrange(4,8)
        pts=[]
        for k in range(cnt):
            ang=(k+r.uniform(-.22,.22))*math.tau/cnt
            pts.append((math.cos(ang)*radius*r.uniform(.7,1.55),math.sin(ang)*radius*r.uniform(.5,1.1)))
        thickness=r.uniform(.017,.072)
        obj=geometry("Rafted plate",[(a,b,z) for z in (0,thickness) for a,b in pts],
            [tuple(reversed(range(cnt))),tuple(range(cnt,2*cnt))]+[(k,(k+1)%cnt,(k+1)%cnt+cnt,k+cnt) for k in range(cnt)],ice,False)
        obj.location=(x+r.uniform(-.17,.19),r.uniform(-.12,.28),.008)
        obj.rotation_euler=(r.uniform(-.44,.44),r.uniform(-.35,.35),r.uniform(-2,2))
        bevel=obj.modifiers.new("Edge glint","BEVEL")
        bevel.width=.004
        bevel.segments=2
        chips.append(obj)
cam.location=(.52,-19.2,1.03)
cam.rotation_euler=(Vector((0,0,.36))-cam.location).to_track_quat("-Z","Y").to_euler()
name.pass_index=1
scene.view_layers[0].use_pass_object_index=True
scene.use_nodes=True
graph=scene.node_tree
mask=node(graph,"CompositorNodeIDMask")
mask.index=1
wire(graph,graph.nodes.get("Render Layers"),"IndexOB",mask,0)
maskfile=node(graph,"CompositorNodeOutputFile")
maskfile.base_path=str(out.parent)
maskfile.format.color_mode="BW"
wire(graph,mask,0,maskfile,0)
rear.data.energy=1650
front.data.energy=1200
polar.inputs[0].default_value=.65
skybg.inputs["Strength"].default_value=1.05
# Keep the lower third in the page's foreground typography position.
mantle.location.y=-2.8
fade.inputs["To Min"].default_value=.009
cam.location.z=.90
cam.rotation_euler=(Vector((0,0,.36))-cam.location).to_track_quat("-Z","Y").to_euler()
exec((Path(__file__).parent/"exposure.py").read_text())
cam.rotation_euler=(Vector((0,0,.62))-cam.location).to_track_quat("-Z","Y").to_euler()
mantle.location.y=-4.2
polar.inputs[0].default_value=.88
fade.inputs["To Min"].default_value=.0032
# A shaded headland behind the name provides a continuous darker band.
ranges[0][2].inputs["Color"].default_value=(.035,.047,.062,1)
ranges[0][3].color_ramp.elements[1].color=(.17,.21,.24,1)
fade.inputs["To Min"].default_value=.001
polar.inputs[0].default_value=.965
front.data.energy=1600
cam.location.z=1.7
cam.rotation_euler=(Vector((0,0,.62))-cam.location).to_track_quat("-Z","Y").to_euler()
mantle.location.y=-4.6
# Coat the dark water with a subtle ripple and weaken the bright fissures.
fractbs.inputs["Base Color"].default_value=(.22,.29,.30,1)
sun.data.energy=1.8
polar.inputs[0].default_value=.93
cam.location.z=1.44
cam.rotation_euler=(Vector((0,0,.62))-cam.location).to_track_quat("-Z","Y").to_euler()
exec((Path(__file__).parent/"surface.py").read_text())
polar.inputs[0].default_value=.74
cam.location.z=1.23
cam.rotation_euler=(Vector((0,0,.63))-cam.location).to_track_quat("-Z","Y").to_euler()
mantle.rotation_euler.z=-.23
mantle.location.x=.75
mantle.location.y=-4.9
mantle.scale.z=.68
sun.data.energy=4.0
sunlit.inputs[0].default_value=.78
ranges[0][0].location.x=-13
ranges[0][1].inputs["To Max"].default_value=.11
polar.inputs[0].default_value=.92
# Illuminate the windward ridges with forward-scattered daylight.
reflector=area("Windward snow bounce",(5,-7,4),1600,9,(1,.97,.92))
onlysnow=bpy.data.collections.new("Windpack bounce receivers")
onlysnow.objects.link(mantle)
reflector.light_linking.receiver_collection=onlysnow
exec((Path(__file__).parent/"finish.py").read_text())
mantle.rotation_euler.z=.43
mantle.scale=(1,1.45,.54)
mantle.location=(.87,-5.2,0)
polar.inputs[0].default_value=.79
fade.inputs["To Min"].default_value=.0022
mantle.rotation_euler.z=.67
mantle.location.x=1.65
heightlight.inputs["To Max"].default_value=1.1
heightlight.inputs["From Min"].default_value=1.8
ranges[2][0].location.x=-34
ranges[0][0].scale.z=.55
ranges[1][0].location.x=-5
bs.inputs["Emission Color"].default_value=(.66,.83,.81,1)
bs.inputs["Emission Strength"].default_value=.095
polar.inputs[0].default_value=.88
watercolors.color_ramp.elements[1].color=(.045,.060,.068,1)
# Give the backlit stone faces relief above the quiet dark foot.
rocklamp=area("Alpine snow bounce",(12,65,16),32000,22,(1,.94,.87))
cliffs=bpy.data.collections.new("Near cliff faces")
cliffs.objects.link(ranges[0][0])
rocklamp.light_linking.receiver_collection=cliffs
rocklamp.rotation_euler=(Vector((0,79,3))-rocklamp.location).to_track_quat("-Z","Y").to_euler()
exec((Path(__file__).parent/"slabs.py").read_text())
# Expose the actual frozen-lake scan at the bed with a softer shallow
# specular return. Let the large features come from the fracture sheets.
watercolors.color_ramp.elements[0].color=(.018,.022,.029,1)
watercolors.color_ramp.elements[1].color=(.36,.40,.43,1)
watercolors.color_ramp.elements[1].position=.31
bsbed.inputs["Emission Strength"].default_value=.54
network.scale.z=.35
quiet.inputs["To Max"].default_value=.09
quiet.inputs["To Min"].default_value=.52
polar.inputs[0].default_value=.935
mantle.rotation_euler.z=.12
mantle.location=(.38,-4.25,0)
mantle.scale=(1,1.42,.62)
reflector.data.energy=1480
reflector.location=(4,-13,3)
front.data.energy=1130
rear.data.energy=930
rocklamp.data.energy=15000
falloff.inputs["To Max"].default_value=1
ranges[0][1].inputs["To Min"].default_value=1
ranges[0][2].inputs["Color"].default_value=(.058,.070,.083,1)
haze_color.inputs["Color"].default_value=(.058,.070,.083,1)
distance.inputs[1].default_value=Vector((.142,1,.102)).normalized()
# Haze varies with the shore profile, easing the line at the lake.
fade.inputs["To Min"].default_value=.0047
mist.inputs["Color"].default_value=(.58,.67,.73,1)
ranges[2][1].inputs["To Max"].default_value=.86
ranges[1][1].inputs["To Max"].default_value=.54
watercolors.color_ramp.elements[1].color=(.20,.23,.26,1)
cam.location.x=1.48
cam.rotation_euler=(Vector((0,0,.62))-cam.location).to_track_quat("-Z","Y").to_euler()
bs.inputs["Emission Strength"].default_value=.105
cam.location.x=.52
cam.rotation_euler=(Vector((0,0,.62))-cam.location).to_track_quat("-Z","Y").to_euler()
# Shallow surface snow sweeps into the side of the open lead.
mantle.rotation_euler.z=-.08
mantle.location=(.52,-4.7,0)
front.data.energy=1060
rear.data.energy=990
exec((Path(__file__).parent/"relight.py").read_text())
ranges[0][0].location.x=-24
ranges[0][0].rotation_euler.z=.26
ranges[2][0].location.x=-41
mantle.rotation_euler.z=-.67
mantle.location=(2.2,.8,0)
mantle.scale=(.75,.74,1.05)
fade.inputs["To Min"].default_value=.008
polar.inputs[0].default_value=.97
front.data.energy=1050
sun.data.energy=4.9
ranges[0][0].location.x=12
ranges[0][0].rotation_euler.z=.73
ranges[0][0].scale.z=.62
ranges[1][0].scale.z=.48
ranges[1][0].location.x=12
front.data.energy=920
cam.location.z=.96
cam.rotation_euler=(Vector((0,0,.60))-cam.location).to_track_quat("-Z","Y").to_euler()
exec((Path(__file__).parent/"coast.py").read_text())
ranges[0][0].rotation_euler.z=-.11
ranges[0][0].location.x=-14
ranges[0][0].scale.z=.81
ranges[1][0].location.x=38
bank.rotation_euler.z=.15
bank.location.y=.65
reflector.data.energy=1150
ray=Vector((.14,1,.108)).normalized()
distance.inputs[1].default_value=ray
sun.rotation_euler=(-ray).to_track_quat("-Z","Y").to_euler()
bank.rotation_euler.z=-.18
bank.location=(.55,-.32,0)
bank.scale.z=1.35
ranges[0][0].location.x=-26
ranges[0][0].scale.z=.74
fade.inputs["To Min"].default_value=.009
front.data.energy=850
bs.inputs["Emission Strength"].default_value=.11
polar.inputs[0].default_value=.961
exec((Path(__file__).parent/"lead.py").read_text())
nextbank.rotation_euler.z=.25
nextbank.location=(.10,.48,0)
nextbank.scale.z=1.23
cam.location.z=1.54
cam.rotation_euler=(Vector((0,0,.60))-cam.location).to_track_quat("-Z","Y").to_euler()
ranges[1][0].location.x=7
fade.inputs["To Min"].default_value=.014
polar.inputs[0].default_value=.99
reflector.data.energy=1320
ranges[0][0].scale.z=.58
ranges[0][0].location.x=-15
ranges[1][0].scale.z=.47
ranges[2][0].scale.z=.50
front.data.energy=840
rear.data.energy=670
cam.location.x=-.9
cam.rotation_euler=(Vector((0,0,.60))-cam.location).to_track_quat("-Z","Y").to_euler()
exec((Path(__file__).parent/"flightlight.py").read_text())
combine.inputs[0].default_value=.055
ranges[0][0].location.x=-19
ranges[0][0].scale.z=.75
skybg.inputs["Strength"].default_value=.64
nextbank.location=(.9,.23,0)
reflector.data.energy=1070
combine.inputs[0].default_value=.090
front.data.energy=850
rear.data.energy=800
cam.location.x=-.42
cam.rotation_euler=(Vector((0,0,.61))-cam.location).to_track_quat("-Z","Y").to_euler()
ranges[0][0].location.x=-30
ranges[2][0].scale.z=.72
skybg.inputs["Strength"].default_value=.87
exec((Path(__file__).parent/"outcrops.py").read_text())
for k,cl in enumerate(crags):
    cl.location.z-=[.52,.36,.47,.61,.43][k]
    cl.location.y+=[3,0,2,-2,0][k]
fade.inputs["To Min"].default_value=.012
combine.inputs[0].default_value=.018
ranges[0][0].scale.z=.58
front.data.energy=1080
skybg.inputs["Strength"].default_value=.47
nextbank.rotation_euler.z=.04
nextbank.scale=(1,.98,1.28)
nextbank.location=(-.48,.11,0)
ranges[0][0].scale.z=.69
fade.inputs["To Min"].default_value=.0032
front.data.energy=920
rear.data.energy=670
combine.inputs[0].default_value=.026
skybg.inputs["Strength"].default_value=.63
sunlit.inputs[0].default_value=.86
exec((Path(__file__).parent/"shorefoot.py").read_text())
exec((Path(__file__).parent/"mistlight.py").read_text())
foreshore.scale.z=.27
crags[1].location.x=-7
crags[3].location.x=19
ranges[0][0].scale.z=.50
ranges[0][0].location.x=-13
ranges[1][0].scale.z=.50
front.data.energy=920
refzone.inputs["To Max"].default_value=.0004
nextbank.rotation_euler.z=-.09
nextbank.location=(-.13,.70,0)
fade.inputs["To Min"].default_value=.019
exec((Path(__file__).parent/"setslabs.py").read_text())
exec((Path(__file__).parent/"contactlight.py").read_text())
fadegr.inputs["To Min"].default_value=.12
cam.location.x=-1.03
cam.rotation_euler=(Vector((0,0,.61))-cam.location).to_track_quat("-Z","Y").to_euler()
crags[1].scale.z*=1.32
crags[3].scale.z*=1.32
fade.inputs["To Min"].default_value=.013
nextbank.location=(.28,.27,0)
front.data.energy=1170
exec((Path(__file__).parent/"basin.py").read_text())
near.location.z=-2.75
near.location.x=7
near.rotation_euler.z=-.53
ranges[2][0].location.x=-23
cam.location.z=1.45
cam.rotation_euler=(Vector((0,0,.60))-cam.location).to_track_quat("-Z","Y").to_euler()
fade.inputs["To Min"].default_value=.0065
nextbank.location=(.36,.49,0)
scene.view_settings.look="AgX - Base Contrast"
exec((Path(__file__).parent/"northlight.py").read_text())
grazing.inputs["From Min"].default_value=12
grazing.inputs["From Max"].default_value=49
grazing.inputs["To Max"].default_value=.77
near.location.z=-1.77
near.location.x=-7
cam.location.z=1.60
cam.rotation_euler=(Vector((0,0,.60))-cam.location).to_track_quat("-Z","Y").to_euler()
fade.inputs["To Min"].default_value=.009
front.data.energy=1200
lowfog.inputs["To Min"].default_value=.12
exec((Path(__file__).parent/"rafted.py").read_text())
exec((Path(__file__).parent/"pressure.py").read_text())
front.data.energy=1085
rear.data.energy=765
rough_map.inputs["To Min"].default_value=.14
rough_map.inputs["To Max"].default_value=.34
exec((Path(__file__).parent/"transmission.py").read_text())
exec((Path(__file__).parent/"keel.py").read_text())
exec((Path(__file__).parent/"milk.py").read_text())
exec((Path(__file__).parent/"dayplate.py").read_text())
exec((Path(__file__).parent/"submerged.py").read_text())
exec((Path(__file__).parent/"freezing.py").read_text())
exec((Path(__file__).parent/"shearwall.py").read_text())
exec((Path(__file__).parent/"firstlight.py").read_text())
if args.theme=="night":
    exec((Path(__file__).parent/"bluehour.py").read_text())
if args.portrait:
    cam.data.sensor_fit="HORIZONTAL"
    cam.data.lens/=.99
    scene.render.resolution_y=round(args.width*844/390)
    maskfile.mute=True
    for ob in [name,*faults]: ob.visible_camera=False
    scene.render.filepath=str(out)
    bpy.ops.render.render(write_still=True)
    raise SystemExit(0)
if args.geometry:
    exec((Path(__file__).parent/"geometry.py").read_text())
    raise SystemExit(0)
# Only the slab needs the oversampled gate. Render its full vertical
# extent, including the bevels, and keep the original camera projection.
if args.bake_geometry:
    corners=[world_to_camera_view(scene,cam,name.matrix_world@Vector(c)) for c in name.bound_box]
    scene.render.use_border=True
    scene.render.use_crop_to_border=False
    scene.render.border_min_y=max(0,min(c.y for c in corners)-.015)
    scene.render.border_max_y=min(1,max(c.y for c in corners)+.015)
maskfile.file_slots[0].path="name-"
scene.render.filepath=str(out)
bpy.ops.render.render(write_still=True)
# Matched clean plate for pixelwise contrast. Preserve secondary rays,
# all snow and shards as well as the original camera and exposure.
hidden=[name,*faults]
for ob in hidden: ob.visible_camera=False
maskfile.mute=True
# The ground atlas remains at its native shipping size. The subject is
# oversampled separately to hold texel density at the end of the push.
scene.render.use_border=False
if args.bake_geometry and args.width > 2880:
    scene.render.resolution_x=2880
    scene.render.resolution_y=1800
scene.render.filepath=str(out.parent/"ground.png")
bpy.ops.render.render(write_still=True)
maskfile.mute=False
for ob in hidden: ob.visible_camera=True

if args.bake_geometry:
    from PIL import ImageFilter
    # Reconstruct the full proof plate from the two matched Cycles passes.
    # Retain a two-pixel guard around the name for antialiased boundaries.
    slab_render=Image.open(out).convert("RGB")
    clean=Image.open(out.parent/"ground.png").convert("RGB").resize(slab_render.size,Image.Resampling.LANCZOS)
    coverage=Image.open(out.parent/"name-0001.png").convert("L").filter(ImageFilter.MaxFilter(5))
    Image.composite(slab_render,clean,coverage).save(out)
    exec((Path(__file__).parent/"geometry.py").read_text())
