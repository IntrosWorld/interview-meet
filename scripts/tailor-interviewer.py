"""Build curved, fitted lapels in bind space with weights from the shirt surface.

Executed by build-aaa-lookdev.py with top, rig, collection, objects and navy.
"""
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
bm=bmesh.new();bm.from_mesh(top.data)
surface_tree=BVHTree.FromBMesh(bm);bm.free()
nearest=KDTree(len(top.data.vertices))
for v in top.data.vertices:nearest.insert(v.co,v.index)
nearest.balance()
for side in [-1,1]:
    points=[];faces=[];weights=[]
    rows=24;columns=5
    for row in range(rows):
        t=row/(rows-1);z=1.235+t*.258
        edge=(z-1.16)*.34
        # Taper the fold at the bottom; curve it onto the actual chest surface.
        width=.002+.038*math.sin(t*math.pi)
        for column in range(columns):
            u=column/(columns-1);x=side*(edge+u*width)
            loc,normal,index,distance=surface_tree.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
            if loc is None:raise RuntimeError('Lapel left garment surface: adjust pattern')
            loc.y-=.0025+.003*math.sin(u*math.pi)
            points.append(tuple(loc))
            weights.append(nearest.find(loc)[1])
    for row in range(rows-1):
        for column in range(columns-1):
            a=row*columns+column;face=(a,a+1,a+1+columns,a+columns)
            faces.append(face if side==1 else tuple(reversed(face)))
    mesh=bpy.data.meshes.new('Curved wool lapel');mesh.from_pydata(points,[],faces);mesh.update()
    obj=bpy.data.objects.new('AAA | fitted lapel '+str(side),mesh);collection.objects.link(obj)
    obj.parent=top.parent;obj.matrix_parent_inverse=top.matrix_parent_inverse.copy();obj.matrix_basis=top.matrix_basis.copy()
    obj.data.materials.append(navy)
    for group in top.vertex_groups:obj.vertex_groups.new(name=group.name)
    for vertex,source_index in enumerate(weights):
        for group in top.data.vertices[source_index].groups:obj.vertex_groups[group.group].add([vertex],group.weight,'REPLACE')
    for polygon in mesh.polygons:polygon.use_smooth=True
    arm=obj.modifiers.new('Follow garment weights','ARMATURE');arm.object=rig
    # No stacked solidify shell: the surface itself is smoothly fitted.
    objects.append(obj)
# More even fabric normals, while retaining the existing seam and skin weights.
for face in top.data.polygons:face.use_smooth=True
