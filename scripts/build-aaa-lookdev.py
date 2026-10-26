"""Derive a separate local-evaluation Blender project from the existing studio."""
import bpy, math, os, json
from mathutils import Vector, Quaternion
ROOT='F:/College/5th Sem/AI_interviewer'
OUT='F:/AI_models/interview-meet/aaa'
os.makedirs(ROOT+'/art/aaa',exist_ok=True)
if bpy.context.scene.camera is None:
    bpy.ops.wm.open_mainfile(filepath=ROOT+'/art/interviewer-studio.blend')
scene=bpy.context.scene
for collection in list(bpy.data.collections):
    if collection.name.startswith(('01 | INTERVIEWER','AAA | local evaluation')):
        for o in list(collection.objects):bpy.data.objects.remove(o,do_unlink=True)
        bpy.data.collections.remove(collection)
before=set(scene.objects)
bpy.ops.import_scene.gltf(filepath=OUT+'/avatarsdk-reference.glb')
objects=[o for o in scene.objects if o not in before]
for o in list(objects):
    if o.name.startswith('Icosphere'):
        bpy.data.objects.remove(o,do_unlink=True);objects.remove(o)
rig=next(o for o in objects if o.type=='ARMATURE')
rig.name='AAA_Interviewer_Rig'
collection=bpy.data.collections.new('AAA | local evaluation character');scene.collection.children.link(collection)
for o in objects:
    for c in list(o.users_collection):c.objects.unlink(o)
    collection.objects.link(o)
bpy.context.view_layer.update()
for name,angle in [('LeftArm',1.1),('RightArm',-1.1)]:
    bone=rig.pose.bones.get(name)
    if bone:
        matrix=bone.matrix.copy();location=matrix.translation.copy()
        matrix=Quaternion(Vector((0,1,0)),angle).to_matrix().to_4x4()@matrix;matrix.translation=location;bone.matrix=matrix
bpy.context.view_layer.update()
points=[o.matrix_world@Vector(c) for o in objects if o.type=='MESH' for c in o.bound_box]
bottom=min(p.z for p in points);top=max(p.z for p in points)
scale=1.78/(top-bottom)
rig.scale*=scale;rig.location.z-=bottom*scale
bpy.context.view_layer.update()
for o in objects:
    if o.type!='MESH':continue
    for p in o.data.polygons:p.use_smooth=True
    for m in o.data.materials:
        if not m or not m.use_nodes:continue
        shader=m.node_tree.nodes.get('Principled BSDF')
        if not shader:continue
        if 'Head' in m.name:
            shader.inputs['Subsurface Weight'].default_value=.065
            shader.inputs['Subsurface Scale'].default_value=.006
            shader.inputs['Specular IOR Level'].default_value=.28
            shader.inputs['Roughness'].default_value=.5
        if 'Eyeball' in m.name:
            shader.inputs['Roughness'].default_value=.12
            shader.inputs['Coat Weight'].default_value=.25
        if 'outfit_top' in m.name:
            shader.inputs['Roughness'].default_value=.7
            for link in list(shader.inputs['Base Color'].links):m.node_tree.links.remove(link)
            shader.inputs['Base Color'].default_value=(.018,.025,.04,1)

# Fitted professional outerwear, derived from this character's own skinned garment.
import bmesh
top=bpy.data.objects.get('outfit_top')
shirt=top.data.materials[0];shirt.name='AAA | ivory woven shirt'
shader=shirt.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(.6,.59,.55,1)
navy=bpy.data.materials.new('AAA | charcoal tailored wool');navy.use_nodes=True
p=navy.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.012,.02,.033,1);p.inputs['Roughness'].default_value=.72;p.inputs['Sheen Weight'].default_value=.22
# Keep a single skinned garment surface: stacked offset shells clip when arms move.
top.name='AAA | tailored jacket and shirt'
top.data.materials.clear();top.data.materials.append(shirt);top.data.materials.append(navy)
for face in top.data.polygons:
    center=sum((top.data.vertices[i].co for i in face.vertices),Vector())/len(face.vertices)
    face.material_index=0 if center.y<-.02 and center.z>1.16 and abs(center.x)<(center.z-1.16)*.34 else 1

def surface(x,z):
    hit,loc,normal,index=top.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
    return (x,loc.y-.012 if hit else -.07,z)
def cloth(name,points,mat):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(points,[],[(0,1,2),(0,2,3)]);mesh.update()
    obj=bpy.data.objects.new(name,mesh);collection.objects.link(obj)
    obj.parent=top.parent;obj.matrix_parent_inverse=top.matrix_parent_inverse.copy();obj.matrix_basis=top.matrix_basis.copy()
    obj.data.materials.append(mat);obj.vertex_groups.new(name='Spine2').add(list(range(len(points))),1,'REPLACE')
    arm=obj.modifiers.new('Spine follow','ARMATURE');arm.object=rig
    thickness=obj.modifiers.new('Cloth fold','SOLIDIFY');thickness.thickness=.004
    objects.append(obj)
for side in [-1,1]:
    cloth('AAA | jacket lapel',[surface(side*x,z) for x,z in [(.10,1.525),(.155,1.42),(.038,1.22),(.03,1.37)]],navy)
scene.frame_start=1;scene.frame_end=300;scene.render.fps=30
for o in objects:
    if o.type=='MESH' and o.data.shape_keys:
        o.data.shape_keys.animation_data_clear()
        for key in o.data.shape_keys.key_blocks:key.value=0

# Drive the Blender preview using the same engine-produced visemes as the WAV.
timing=json.load(open(OUT+'/preview-timing.json',encoding='utf8'))
mapping=['sil','aa','aa','O','E','RR','I','U','O','O','aa','aa','kk','RR','nn','SS','CH','TH','FF','DD','kk','PP']
offset=15
for o in objects:
    if o.type!='MESH' or not o.data.shape_keys:continue
    keys=o.data.shape_keys.key_blocks
    for cue in timing['visemes']:
        name='viseme_'+mapping[cue['id']]
        if name not in keys:continue
        key=keys[name];frame=offset+cue['time']*30;duration=max(1,cue['duration']*30)
        for f,v in [(frame-1,0),(frame+.5,.65),(frame+duration-1,.65),(frame+duration,0)]:
            key.value=v;key.keyframe_insert('value',frame=f)
    for name in ['eyeBlinkLeft','eyeBlinkRight']:
        if name in keys:
            for f,v in [(1,0),(90,0),(93,1),(96,0),(218,0),(221,1),(224,0)]:
                keys[name].value=v;keys[name].keyframe_insert('value',frame=f)
scene.frame_set(1)
if scene.sequence_editor:scene.sequence_editor_clear()
editor=scene.sequence_editor_create()
sound=editor.strips.new_sound('Timed spoken interview preview',OUT+'/preview.wav',channel=1,frame_start=offset)
scene.camera.data.dof.aperture_fstop=4.5
scene.cycles.samples=96;scene.render.resolution_x=1920;scene.render.resolution_y=1080
scene.render.filepath=ROOT+'/art/aaa/preview'
scene['Asset license']='AvatarSDK example from met4citizen/TalkingHead, non-commercial evaluation only. Not included in Git or production.'
scene['Lip timing']='Windows SAPI engine visemes; matching WAV is in Video Sequencer at frame 15.'
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/art/aaa/interviewer-aaa.blend',compress=True)
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=OUT+'/interviewer-aaa.glb',use_selection=True,export_format='GLB',export_animations=False,export_morph=True,export_skins=True)
result={'blend':ROOT+'/art/aaa/interviewer-aaa.blend','character':OUT+'/interviewer-aaa.glb','meshCount':len([o for o in objects if o.type=='MESH']),'normalizedHeight':1.78}
