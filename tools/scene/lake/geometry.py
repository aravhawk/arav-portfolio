"""Sample the surveyed ground and bake the original slab normals onto the camera UVs."""
import json
import struct
import meshoptimizer
from scipy.ndimage import distance_transform_edt

folder = out.parent
scene.view_layers[0].update()
deps = bpy.context.evaluated_depsgraph_get()
eye = cam.matrix_world.translation.copy()
camera_matrix = np.array(cam.matrix_world, dtype=np.float64)
right, up, backward = camera_matrix[:3, :3].T
frame = cam.data.view_frame(scene=scene)
half_x = max(v.x / -v.z for v in frame)
half_y = max(v.y / -v.z for v in frame)

def direction(u, v):
    return Vector(right * ((2*u-1)*half_x) + up * ((1-2*v)*half_y) - backward).normalized()

chunks = []
draws = []

def store_mesh(positions, normals, triangles):
    p = np.ascontiguousarray(positions, dtype=np.float32)
    n = np.ascontiguousarray(normals, dtype=np.float32)
    indices = np.asarray(triangles, dtype=np.uint32).reshape(-1)
    # Signed octahedral normals and 16-bit bounds-relative positions.
    low, high = p.min(axis=0), p.max(axis=0)
    span = np.maximum(high-low, 1.e-6)
    encoded = np.zeros((len(p),4),np.uint16)
    encoded[:,:3] = np.rint((p-low)/span*65535).astype(np.uint16)
    n /= np.maximum(1.e-6, np.abs(n).sum(axis=1,keepdims=True))
    xy = n[:,:2].copy()
    folded = n[:,2] < 0
    xy[folded] = (1-np.abs(xy[folded,::-1]))*np.sign(xy[folded]+1.e-10)
    octets = np.rint((xy*.5+.5)*255).clip(0,255).astype(np.uint16)
    encoded[:,3] = octets[:,0] | (octets[:,1]<<8)
    vb = meshoptimizer.encode_vertex_buffer(encoded)
    ib = meshoptimizer.encode_index_buffer(indices)
    draws.append(dict(vertices=len(p), indices=len(indices), vertexBytes=len(vb),
                      indexBytes=len(ib), low=low.tolist(), span=span.tolist()))
    chunks.extend([vb, ib])

# A depth field across the actual terrain and lake gives the baked background
# its parallax. The camera-projected colour includes the fog, contact shadows,
# reflections and sub-surface fractures which Cycles integrated.
objects = [r[0] for r in ranges] + [cover, nextbank]
surfaces = []
for ob in objects:
    if ob.hide_render: continue
    ev=ob.evaluated_get(deps);m=ev.to_mesh()
    xyz=np.empty((len(m.vertices),3),np.float32);m.vertices.foreach_get('co',xyz.ravel())
    M=np.asarray(ev.matrix_world); xyz=xyz@M[:3,:3].T+M[:3,3]
    m.calc_loop_triangles()
    tri=np.empty((len(m.loop_triangles),3),np.int32);m.loop_triangles.foreach_get('vertices',tri.ravel())
    surfaces.append(BVHTree.FromPolygons(xyz,tri,all_triangles=True))
    ev.to_mesh_clear()
# Extra rows supply geometry below a tall viewport and around the scroll move.
xs=np.r_[np.linspace(-.4,0,9,endpoint=False),np.linspace(0,1,217),np.linspace(1.025,1.4,9)]
ys=np.r_[np.linspace(-2,0,18,endpoint=False),np.linspace(0,1,167),np.linspace(1.025,3,26)]
gp=[];gn=[]
for v in ys:
    for u in xs:
        ray=direction(u,v);dist=720.
        for tree in surfaces:
            hit,_,_,length=tree.ray_cast(eye,ray,dist)
            if hit is not None: dist=min(dist,length)
        delta=np.array(ray)*dist
        gp.append([delta@right,delta@up,-delta@backward]);gn.append([0,0,1])
grid=np.arange(len(gp),dtype=np.uint32).reshape(len(ys),len(xs))
a,b,c,e=grid[:-1,:-1],grid[:-1,1:],grid[1:,:-1],grid[1:,1:]
store_mesh(gp,gn,np.stack((a,c,b,b,c,e),axis=-1))

# Renderable type is a decimated solid, including counter walls and backs.
ev=name.evaluated_get(deps);m=ev.to_mesh();m.calc_loop_triangles()
coords=np.empty((len(m.vertices),3),np.float32);m.vertices.foreach_get('co',coords.ravel())
norm=np.empty_like(coords);m.vertices.foreach_get('normal',norm.ravel())
tri=np.empty((len(m.loop_triangles),3),np.int32);m.loop_triangles.foreach_get('vertices',tri.ravel())
original=tri.ravel()
reduced=np.empty_like(original)
count=meshoptimizer.simplify(reduced,original,coords,target_index_count=46000*3,target_error=.0009)
used,remap=np.unique(reduced[:count],return_inverse=True)
tri=remap.astype(np.uint32)
coords=coords[used]
norm=norm[used]
M=np.asarray(name.matrix_world)
wp=coords@M[:3,:3].T+M[:3,3]-np.asarray(eye)
axes=np.stack([right,up,-backward],axis=1)
store_mesh(wp@axes,norm@np.linalg.inv(M[:3,:3])@axes,tri)
ev.to_mesh_clear()

(folder/"geometry.bin").write_bytes(b''.join(chunks))

# Sample high-resolution normals and front/back intersections on the untouched
# slab. The atlas has exactly one texel per native device pixel before padding.
mask=np.asarray(Image.open(folder/'name-0001.png').convert('L'))>127
H,W=mask.shape
yy,xx=np.where(mask)
x0=max(0,(xx.min()-12)//4*4);y0=max(0,(yy.min()-12)//4*4)
x1=min(W,(xx.max()+16)//4*4);y1=min(H,(yy.max()+16)//4*4)
local=name.matrix_world.inverted(); origin=local@eye
tree=BVHTree.FromObject(name,deps)
normal_atlas=np.empty((y1-y0,x1-x0,3),np.uint8)
normal_atlas[:]=[128,128,0]
valid=np.zeros(normal_atlas.shape[:2],bool)
for y,x in zip(yy,xx):
    dr=direction((x+.5)/W,(y+.5)/H)
    local_dr=(local.to_3x3()@dr).normalized()
    hit,n,_,_=tree.ray_cast(origin,local_dr)
    if hit is None:continue
    world_n=name.matrix_world.to_3x3()@n
    eye_n=np.asarray(world_n)@axes
    # All visible faces point towards -Z in this eye-space convention.
    tangent=eye_n[:2]
    back,_,_,thickness=tree.ray_cast(hit+local_dr*.0005,local_dr)
    normal_atlas[y-y0,x-x0]=[*np.rint((tangent*.5+.5)*255).clip(0,255),
                              int(255*min(1,(thickness or .25)/.50))]
    valid[y-y0,x-x0]=True
nearest=distance_transform_edt(~valid,return_distances=False,return_indices=True)
normal_atlas=normal_atlas[tuple(nearest)]
Image.fromarray(normal_atlas).save(folder/'optics.png')
print('Light meshes',draws,flush=True)
(folder/'mesh.json').write_text(json.dumps(dict(draws=draws, half=[half_x,half_y],
    plane=[float(right[2]),float(up[2]),float(-backward[2]),float(eye.z)],
    crop=[int(x0),int(y0),int(x1),int(y1)],size=[W,H]),separators=(',',':')))
