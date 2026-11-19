"""Encode scene radiance and material atlases, authored geometry, and the OCIO grade."""
import argparse
import gzip
import json
import os
import subprocess
from pathlib import Path
import bpy
import numpy as np
import PyOpenColorIO as ocio
from PIL import Image
from scipy.ndimage import distance_transform_edt

parser=argparse.ArgumentParser()
parser.add_argument("folder",type=Path)
parser.add_argument("destination",type=Path)
parser.add_argument("--theme",choices=("day","night"),default="day")
parser.add_argument("--shared",type=Path,help="Day geometry and optics for a second lighting bake")
parser.add_argument("--portrait",type=Path,help="Wide-angle portrait ground outside the desktop camera")
parser.add_argument("--lake-only",action="store_true",help="Encode a revised metric surface")
parser.add_argument("--phone-only",action="store_true",help="Encode a revised two-row portrait survey")
args=parser.parse_args()
src,dest=args.folder,args.destination
dest.mkdir(exist_ok=True,parents=True)
theme=args.theme
shared=args.shared or src
meta=json.loads((shared/"mesh.json").read_text())
config=ocio.Config.CreateFromFile(bpy.utils.resource_path('LOCAL')+'/datafiles/colormanagement/config.ocio')
display=ocio.DisplayViewTransform(src='Linear Rec.709',display='sRGB',view='AgX')
if theme=="night":
    group=ocio.GroupTransform()
    group.appendTransform(ocio.LookTransform(src='Linear Rec.709',dst='Linear Rec.709',looks='AgX - Medium Low Contrast'))
    group.appendTransform(display)
    display=group
def transform(values,direction):
    display.setDirection(direction)
    proc=config.getProcessor(display).getDefaultCPUProcessor()
    rgb=np.ascontiguousarray(values,dtype=np.float32)
    proc.applyRGB(rgb)
    return np.maximum(0,rgb)
def radiance(image):
    return transform(np.asarray(image.convert('RGB'),dtype=np.float32)/255,ocio.TRANSFORM_DIR_INVERSE)
def encode(rgb):
    shaped=np.log2(1+1024*np.maximum(0,rgb))/14
    r,g,b=shaped.transpose(2,0,1)
    # The lake is nearly neutral. Store luma separately and enlarge the two
    # opponent axes so block compression cannot turn fog purple and green.
    coded=np.stack((.25*r+.5*g+.25*b,.5+4*(r-g),.5+4*(b-g)),axis=-1)
    return np.uint8(np.rint(np.clip(coded,0,1)*255))
def ktx(name,pixels,quality):
    pixels.save(src/(name+'.png'))
    codec=["--encode","etc1s","--qlevel",str(quality),"--clevel","4"]
    if name!="environment":
        # Texture extent stays fixed. Rate-distortion selects fewer similar
        # block patterns in the scanned frost and fragment normals.
        codec+=["--endpoint_rdo_threshold","2.8","--selector_rdo_threshold","3"]
    subprocess.run([os.environ.get("TOKTX","toktx"),"--t2",*codec,"--genmipmap","--assign_oetf","linear","--assign_primaries","bt709",
                    str(dest/(name+".ktx2")),str(src/(name+'.png'))],check=True)
def field_avif(name, signal, quality):
    # Dither in the log radiance domain before quantization.
    noise = np.random.default_rng(340).uniform(-.5,.5,signal.shape[:2]).astype(np.float32)
    pixels = np.uint8(np.clip(np.rint(255*signal + noise[:,:,None]),0,255))
    Image.fromarray(pixels).save(dest/(name+".avif"),quality=quality,speed=6,subsampling="4:4:4")
if not args.phone_only:
    # Both themes share the same metre grid. The log scale retains detail in
    # black ice and snow in a single RGB sample, independent of either camera.
    if theme == "day":
        from surface_detail import bake_detail
        bake_detail(dest)
    from lake_field import encode_lake
    encode_lake(Image.open(shared/("lake-uv-"+theme+".png")),Image.open(shared/"lake-uv-day.png"),
                radiance,dest/("lake-uv-"+theme+".avif"),theme=="night")
    if args.lake_only:
        raise SystemExit(0)
phone_folder = shared / ("phone-" + theme)
phone = json.loads((phone_folder/"portrait.json").read_text())
phone_clean = Image.open(phone_folder/"ground.png").convert("RGB")
phone_layer = np.asarray(Image.open(phone_folder/(theme+".png")).convert("RGB"))
phone_mask = np.asarray(Image.open(phone_folder/"name-0001.png").convert("L"))>127
dist, nearest = distance_transform_edt(~phone_mask, return_indices=True)
# Both themes address the same atlas region. The anti-aliased object
# coverage in a separate lighting render can differ by a few pixels.
bounds_mask=np.asarray(Image.open(shared/"phone-day"/"name-0001.png").convert("L"))>127
y,x = np.where(bounds_mask)
start = max(0,(y.min()-16)//4*4)
stop = min(phone_clean.height,(y.max()+19)//4*4)
slabs = phone_layer[tuple(nearest)][start:stop].copy()
slabs[dist[start:stop]>14] = 0
atlas = Image.new("RGB",(phone_clean.width,phone_clean.height+stop-start))
atlas.paste(phone_clean)
atlas.paste(Image.fromarray(slabs),(0,phone_clean.height))
field_avif("two-rows-"+theme,np.log2(1+1024*radiance(atlas))/14,75)
phone.update(slabTop=float(start/phone_clean.height), groundPart=float(phone_clean.height/atlas.height))
meta["phone"] = phone
if args.phone_only:
    if theme == "day":
        (dest/'mesh.json').write_text(json.dumps(meta,separators=(',',':')))
    raise SystemExit(0)
size=tuple(meta['size'])
source=Image.open(src/(theme+'.png')).resize(size,Image.Resampling.LANCZOS)
ground=Image.open(src/'ground.png')
mask=np.asarray(Image.open(src/'name-0001.png').convert('L').resize(size,Image.Resampling.NEAREST))>127
x0,y0,x1,y1=meta["crop"]
slab=source.crop((x0,y0,x1,y1))
zone=mask[y0:y1,x0:x1]
distance,nearest=distance_transform_edt(~zone,return_indices=True)
slab_lin=radiance(slab)[tuple(nearest)]
opt=np.asarray(Image.open(shared/'optics.png').convert('RGB')).copy()
opt[distance>24]=[128,128,128]
bg=radiance(ground)
# Split off the scene behind each facet at its resting UV. The runtime reads
# the moving, mipped scene at the corresponding refracted position.
nx,ny=(opt[:,:,:2].astype(float)/127.5-1).transpose(2,0,1)
yy,xx=np.mgrid[y0:y1,x0:x1]
thick=opt[:,:,2]/255
sample_x=np.clip(np.rint((xx+nx*(2+5*thick))*ground.width/size[0]).astype(int),0,bg.shape[1]-1)
sample_y=np.clip(np.rint((yy-ny*(2+5*thick))*ground.height/size[1]).astype(int),0,bg.shape[0]-1)
trans=.025+.025*(1-thick)
body=np.maximum(0,slab_lin-bg[sample_y,sample_x]*trans[:,:,None])
# Split the low-frequency chromatic field from one high-frequency luminance
# channel. This preserves smooth fog through block compression while retaining
# a one-to-one sample grid for the name. Both fields stay attached to the UVs.
base_image=Image.new("RGBA",(512,512))
def lighting_bands(signal,size):
    low=np.stack([np.asarray(Image.fromarray(c.astype(np.float32,copy=False)).resize(size,Image.Resampling.BOX))
                  for c in signal.transpose(2,0,1)],axis=-1)
    native=(signal.shape[1],signal.shape[0])
    expanded=np.stack([np.asarray(Image.fromarray(c).resize(native,Image.Resampling.BILINEAR))
                       for c in low.transpose(2,0,1)],axis=-1)
    return low,(signal-expanded)@np.array([.25,.5,.25])

def split_field(name,lin,size,offset):
    signal=np.log2(1+1024*np.maximum(0,lin))/14
    low,residual=lighting_bands(signal,size)
    high=np.rint(255*np.clip(.5+2.5*residual,0,1)).astype(np.uint8)
    if name=="body":
        high[distance>24]=128
    if theme=="day":
        detail=Image.fromarray(high).convert("RGB")
        if name=="ground":
            detail=detail.resize((2880,1800),Image.Resampling.LANCZOS)
        ktx(name+'-'+theme,detail,58)
    elif name=="ground":
        # Preserve the stars and the absence of a direct solar reflection.
        detail=Image.fromarray(high).convert("RGB").resize((1440,900),Image.Resampling.LANCZOS)
        ktx(name+'-'+theme,detail,75)
    # Select only the solar core and glinting ice. Filter the radiance mask
    # before resizing so tiny hot edges contribute to the wide bloom.
    hot=np.clip((lin.max(axis=2)-1.65)/3,0,1).astype(np.float32)
    seed=np.asarray(Image.fromarray(hot).resize(size,Image.Resampling.BOX))
    field=np.dstack([low,seed])
    base_image.paste(Image.fromarray(np.uint8(np.rint(field.clip(0,1)*255))),(0,offset))
split_field("ground",bg,(512,320),0)
split_field("body",body,(512,112),328)
if theme=='day':ktx('optics',Image.fromarray(opt),58)
# A regular table in log-shaped scene-linear space covers the expanded
# highlights. Texel centres correspond exactly to the 32 grid coordinates.
u=np.linspace(0,1,32,dtype=np.float32)
bb,gg,rr=np.meshgrid(u,u,u,indexing='ij')
grid=(np.exp2(14*np.stack((rr,gg,bb),axis=-1))-1)/1024
rgb=transform(grid,ocio.TRANSFORM_DIR_FORWARD)
# Adjacent entries have nearly identical colours. Difference each channel
# before compression; the worker reverses this byte-for-byte on load.
table=np.rint(rgb.clip(0,1)*255).astype("uint8").reshape(-1,3)
table[1:]=table[1:]-table[:-1]
(dest/('grade-'+theme+'.rgb.gz')).write_bytes(gzip.compress(table.T.tobytes(),mtime=0))
if theme=='day':
    (dest/'lake.meshopt.gz').write_bytes(gzip.compress((src/'geometry.bin').read_bytes(),mtime=0))
    (dest/'mesh.json').write_text(json.dumps(meta,separators=(',',':')))
    # Render a small environment lookup from the CC0 panorama in eye space.
    hd=bpy.data.images.load(str(Path.home()/'.t3/portfolio-redesign-v4/assets-src/frozen_lake_2k.hdr'))
    buf=np.empty(hd.size[1]*hd.size[0]*4,np.float32);hd.pixels.foreach_get(buf)
    hdr=buf.reshape(hd.size[1],hd.size[0],4)[::-1,:,:3]
    env=np.asarray(Image.fromarray(encode(hdr*.255)).resize((128,64),Image.Resampling.BOX))
    ktx('environment',Image.fromarray(env),185)

# The eastern and portrait gates use smaller colour fields. Their fine
# residuals are calculated against the actual compressed fields below.
portrait_signals=[]
def add_gate(signal,column):
    low=np.stack([np.asarray(Image.fromarray(c).resize((128,64),Image.Resampling.BOX))
                  for c in signal.transpose(2,0,1)],axis=-1)
    base_image.paste(Image.fromarray(np.uint8(np.rint(255*low.clip(0,1)))),(128*column,448))

if args.portrait:
    # Both tall gates extend the corresponding desktop camera. Reuse the
    # ground's chroma-plus-detail encoding so we can carry both views.
    extent=.5*(390/844)/(1.6*1.55)
    for gate,file in enumerate((args.portrait,shared/'approach-portrait'/(theme+'.png'))):
        plate=radiance(Image.open(file))
        shape=np.log2(1+1024*plate)/14
        h=shape.shape[0]
        if theme=="night":
            # The high sky and snow right at the lens occupy most of the
            # tall gate. Ease their chroma back gently outside the shared image.
            v=(np.arange(h,dtype=np.float32)+.5)/h
            outer=np.clip((np.abs(v-.5)-extent)/.16,0,1)
            outer=(outer*outer*(3-2*outer))[:,None,None]
            gray=shape@np.array([.2126,.7152,.0722],np.float32)
            shape=gray[:,:,None]+(shape-gray[:,:,None])*(1-.11*outer)
        upper=shape[:int(h*(.5-extent))+3]
        lower=shape[int(h*(.5+extent))-3:]
        def reduce_half(values):
            return np.stack([np.asarray(Image.fromarray(c).resize((384,224),Image.Resampling.LANCZOS))
                             for c in values.transpose(2,0,1)],axis=-1)
        sides=np.concatenate([reduce_half(upper),reduce_half(lower)])
        add_gate(sides,gate+1)
        portrait_signals.append(sides)

# Sample the eastern-facing gate from a second pair of matched Cycles
# renders. Dilate the slab boundary for filtering but keep empty space
# black so surfaces outside this gate retain their primary projection.
approach=shared/('approach-'+theme)
clean=Image.open(approach/'ground.png').convert('RGB')
layer=Image.open(approach/(theme+'.png')).convert('RGB')
coverage=np.asarray(Image.open(approach/'name-0001.png').convert('L'))>127
distance,nearest=distance_transform_edt(~coverage,return_indices=True)
padded=np.asarray(layer)[tuple(nearest)]
padded[distance>16]=0
clean.thumbnail((1920,1200),Image.Resampling.LANCZOS)
ground_signal=np.log2(1+1024*radiance(clean))/14
add_gate(ground_signal,0)
body_signal=np.log2(1+1024*radiance(Image.fromarray(padded)))/14
ktx('approach-body-'+theme,Image.fromarray(np.uint8(np.rint(255*body_signal.clip(0,1)))),85)
# Native 4:4:4 coding keeps smooth gradients and avoids block endpoints
# on magnified sky. Preserve colour even in the zero-bloom parts of the atlas.
rgba = np.asarray(base_image).copy()
rgba[:,:,3] = 128 + np.rint(rgba[:,:,3] * (127 / 255)).astype(np.uint8)
base_file = dest / ("base-" + theme + ".avif")
Image.fromarray(rgba).save(base_file,quality=84,speed=6,subsampling="4:4:4")

# A nearly uniform sky can expose the endpoint choices of a compressed
# block after magnification. Decode the shipped low field before computing
# the correction, including chroma and the hard change across the skyline.
decoded_base=Image.open(base_file).convert("RGB")
def correction(signal,column):
    low=np.asarray(decoded_base.crop((128*column,448,128*(column+1),512)),np.float32)/255
    size=(signal.shape[1],signal.shape[0])
    expanded=np.stack([np.asarray(Image.fromarray(c).resize(size,Image.Resampling.BILINEAR))
                       for c in low.transpose(2,0,1)],axis=-1)
    coded=.5+1.6*(signal-expanded)
    return Image.fromarray(np.uint8(np.rint(255*coded.clip(0,1))))
ktx('approach-ground-'+theme,correction(ground_signal,0),93)
if portrait_signals:
    extensions=Image.new("RGB",(768,448))
    for gate,signal in enumerate(portrait_signals):
        extensions.paste(correction(signal,gate+1),(384*gate,0))
    ktx('portrait-'+theme,extensions,85)
