# Revolve each whole sawn slab about its own foot. Identify closed islands
# from mesh topology so overlapping bounding boxes cannot split a stroke.
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from mathutils import Matrix
mm=name.data
ed=np.empty((len(mm.edges),2),np.int32);mm.edges.foreach_get("vertices",ed.ravel())
adj=coo_matrix((np.ones(len(ed),np.int8),(ed[:,0],ed[:,1])),shape=(len(mm.vertices),len(mm.vertices)))
_,components=connected_components(adj,directed=False)
pos=np.empty((len(mm.vertices),3),np.float32);mm.vertices.foreach_get("co",pos.ravel())
ids,counts=np.unique(components,return_counts=True)
ranges_x=[]
for c,ct0 in zip(ids,counts):
    if ct0<80:continue
    px=pos[components==c,0];ranges_x.append((float(px.min()),float(px.max()),int(c)))
ranges_x.sort()
glyphs=[]
for l0,r0,island in ranges_x:
    if glyphs and min(glyphs[-1][1],r0)-max(glyphs[-1][0],l0)>.36*(r0-l0):
        glyphs[-1][0]=min(glyphs[-1][0],l0);glyphs[-1][1]=max(glyphs[-1][1],r0);glyphs[-1][2].append(island)
    else:glyphs.append([l0,r0,[island]])
assert len(glyphs)==8,glyphs
turn=np.deg2rad([-3,0,-4,-2,-6,-15,-16,-16])
toward=np.array([-.06,.039,.012,-.054,.036,-.029,.019,-.04])
centers=np.array([(l+r)*.5 for l,r,ids in glyphs])
def move(vertices,index):
    a=turn[index];cx=centers[index];dx=vertices[:,0]-cx;dy=1.38*vertices[:,1].copy()
    vertices[:,0]=1.10*cx+.13*(index-3.5)+.25*max(0,index-4)+dx*np.cos(a)-dy*np.sin(a)
    vertices[:,1]=toward[index]+.13*cx+dx*np.sin(a)+dy*np.cos(a)
    return vertices
for j,(l,r,ids) in enumerate(glyphs):
    sel=np.isin(components,ids)
    pos[sel]=move(pos[sel].copy(),j)
mm.vertices.foreach_set("co",pos.ravel());mm.update()
for ob in faults:
    mat=np.asarray(ob.matrix_world)
    inv=np.asarray(ob.matrix_world.inverted())
    verts=np.empty((len(ob.data.vertices),3),np.float32);ob.data.vertices.foreach_get("co",verts.ravel())
    worldv=verts@mat[:3,:3].T+mat[:3,3]
    glyph_distance=np.column_stack([np.maximum.reduce([l-worldv[:,0],worldv[:,0]-r,np.zeros(len(worldv))]) for l,r,ids in glyphs])
    which=glyph_distance.argmin(axis=1)
    for j in range(8):
        sel=which==j
        if sel.any():worldv[sel]=move(worldv[sel].copy(),j)
    local=worldv@inv[:3,:3].T+inv[:3,3]
    ob.data.vertices.foreach_set("co",local.astype(np.float32).ravel());ob.data.update()
bpy.context.view_layer.update()
