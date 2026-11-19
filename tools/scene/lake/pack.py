"""Encode scene radiance and material atlases, authored geometry, and the OCIO grade."""
import argparse
import gzip
import json
import os
import shutil
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
def ktx(name,pixels,quality,universal=False):
    pixels.save(src/(name+'.png'))
    codec=["--encode","uastc","--uastc_quality","3","--uastc_rdo_l",("4.2" if theme=="night" or name.startswith("portrait") else "3.2"),"--zcmp","18"] if universal else ["--encode","etc1s","--qlevel",str(quality),"--clevel","4"]
    subprocess.run([os.environ.get("TOKTX","toktx"),"--t2",*codec,"--genmipmap","--assign_oetf","linear","--assign_primaries","bt709",
                    str(dest/(name+".ktx2")),str(src/(name+'.png'))],check=True)
size=tuple(meta['size'])
source=Image.open(src/(theme+'.png')).resize(size,Image.Resampling.LANCZOS)
ground=Image.open(src/'ground.png')
mask=np.asarray(Image.open(src/'name-0001.png').convert('L').resize(size,Image.Resampling.NEAREST))>127
x0,y0,x1,y1=meta["crop"]
slab=source.crop((x0,y0,x1,y1))
zone=mask[y0:y1,x0:x1]
nearest=distance_transform_edt(~zone,return_distances=False,return_indices=True)
slab_lin=radiance(slab)[tuple(nearest)]
opt=np.asarray(Image.open(shared/'optics.png').convert('RGB')).copy()
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
base_image=Image.new("RGBA",(512,448))
def split_field(name,lin,size,offset):
    signal=np.log2(1+1024*np.maximum(0,lin))/14
    low=np.stack([np.asarray(Image.fromarray(c.astype("float32")).resize(size,Image.Resampling.BOX))
                  for c in signal.transpose(2,0,1)],axis=-1)
    expanded=np.stack([np.asarray(Image.fromarray(c).resize((signal.shape[1],signal.shape[0]),Image.Resampling.BILINEAR))
                       for c in low.transpose(2,0,1)],axis=-1)
    residual=(signal-expanded)@np.array([.25,.5,.25])
    high=np.rint(255*np.clip(.5+2.5*residual,0,1)).astype(np.uint8)
    if theme=="day":
        detail=Image.fromarray(high).convert("RGB")
        if name=="ground":
            detail=detail.resize((2880,1800),Image.Resampling.LANCZOS)
        ktx(name+'-'+theme,detail,116 if name=="ground" else 140)
    elif name=="ground":
        # Preserve the stars and the absence of a direct solar reflection.
        detail=Image.fromarray(high).convert("RGB").resize((1440,900),Image.Resampling.LANCZOS)
        ktx(name+'-'+theme,detail,156)
    # Select only the solar core and glinting ice. Filter the radiance mask
    # before resizing so tiny hot edges contribute to the wide bloom.
    hot=np.clip((lin.max(axis=2)-1.65)/3,0,1).astype(np.float32)
    seed=np.asarray(Image.fromarray(hot).resize(size,Image.Resampling.BOX))
    field=np.dstack([low,seed])
    base_image.paste(Image.fromarray(np.uint8(np.rint(field.clip(0,1)*255))),(0,offset))
split_field("ground",bg,(512,320),0)
split_field("body",body,(512,112),328)
ktx("base-"+theme,base_image,0,True)
if theme=='day':ktx('optics',Image.fromarray(opt),105)
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
    shutil.copyfile(src/'mesh.json',dest/'mesh.json')
    # Render a small environment lookup from the CC0 panorama in eye space.
    hd=bpy.data.images.load(str(Path.home()/'.t3/portfolio-redesign-v4/assets-src/frozen_lake_2k.hdr'))
    buf=np.empty(hd.size[1]*hd.size[0]*4,np.float32);hd.pixels.foreach_get(buf)
    hdr=buf.reshape(hd.size[1],hd.size[0],4)[::-1,:,:3]
    env=np.asarray(Image.fromarray(encode(hdr*.255)).resize((128,64),Image.Resampling.BOX))
    ktx('environment',Image.fromarray(env),185)

if args.portrait:
    # The camera remains centred on the same scene; this lookup supplies
    # newly visible ice and sky beyond the desktop projection on tall screens.
    portrait=radiance(Image.open(args.portrait))
    shaped=np.log2(1+1024*portrait)/14
    h,w=shaped.shape[:2]
    # The central band is available at higher resolution in the ground atlas.
    # Pack the upper and lower extensions into one compact RGB illumination map.
    crop=.5*(390/844)/(1.6*.99)
    upper=shaped[:int(h*(.5-crop))+3]
    lower=shaped[int(h*(.5+crop))-3:]
    def half(values):
        pixels=np.uint8(np.rint(values.clip(0,1)*255))
        return Image.fromarray(pixels).resize((384,224),Image.Resampling.LANCZOS)
    sides=Image.new("RGB",(384,448))
    sides.paste(half(upper),(0,0));sides.paste(half(lower),(0,224))
    ktx('portrait-'+theme,sides,0,True)
