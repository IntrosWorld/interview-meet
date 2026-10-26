"""Run inside Blender 5.1. Builds a separate editable character/studio project."""
import bpy, math, os, json
from mathutils import Vector, Quaternion

ROOT = 'F:/College/5th Sem/AI_interviewer'
ART = ROOT + '/art'
os.makedirs(ART + '/renders', exist_ok=True)
os.makedirs(ROOT + '/public/models', exist_ok=True)

# The MCP scene was verified as a fresh startup scene before this script runs.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.import_scene.gltf(filepath='F:/AI_models/interview-meet/assets/mpfb-cc0.glb')
for o in list(bpy.context.scene.objects):
    if o.type=='MESH' and o.name.startswith('Icosphere'): bpy.data.objects.remove(o,do_unlink=True)
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
rig.name = 'Interviewer_Rig'
character = [o for o in scene.objects if o.type in {'MESH','ARMATURE'}]
collection = bpy.data.collections.new('01 | INTERVIEWER - facial rig and wardrobe')
scene.collection.children.link(collection)
for o in character:
    for c in list(o.users_collection): c.objects.unlink(o)
    collection.objects.link(o)

def material(name, color, roughness=.5, metallic=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=roughness
    p.inputs['Metallic'].default_value=metallic
    return m

skin = bpy.data.materials.get('Human.body')
if skin:
    skin.name='Skin | layered dermal detail'
    nodes=skin.node_tree.nodes; links=skin.node_tree.links; p=nodes.get('Principled BSDF')
    p.inputs['Subsurface Weight'].default_value=.11
    p.inputs['Subsurface Radius'].default_value=(1,.43,.23)
    p.inputs['Subsurface Scale'].default_value=.008
    p.inputs['Specular IOR Level'].default_value=.3
    p.inputs['Roughness'].default_value=.42
    tex=nodes.new('ShaderNodeTexNoise'); tex.name='Fine skin breakup'; tex.inputs['Scale'].default_value=380; tex.inputs['Detail'].default_value=3
    bump=nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.075; bump.inputs['Distance'].default_value=.0006
    links.new(tex.outputs['Fac'],bump.inputs['Height']); links.new(bump.outputs['Normal'],p.inputs['Normal'])
    ramp=nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color=(.32,.32,.32,1); ramp.color_ramp.elements[1].color=(.49,.49,.49,1)
    links.new(tex.outputs['Fac'],ramp.inputs[0]); links.new(ramp.outputs[0],p.inputs['Roughness'])

for o in character:
    if o.type!='MESH': continue
    for poly in o.data.polygons: poly.use_smooth=True
    if 'female_casualsuit' in o.name:
        m=o.data.materials[0]; m.name='Wardrobe | tailored charcoal'
        p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Roughness'].default_value=.78
        p.inputs['Sheen Weight'].default_value=.2
        for link in list(p.inputs['Base Color'].links): m.node_tree.links.remove(link)
        p.inputs['Base Color'].default_value=(.47,.47,.43,1)
    if 'high-poly' in o.name:
        for m in o.data.materials:
            p=m.node_tree.nodes.get('Principled BSDF')
            if p: p.inputs['Roughness'].default_value=.14; p.inputs['Specular IOR Level'].default_value=.45
    if 'ponytail' in o.name:
        for m in o.data.materials:
            p=m.node_tree.nodes.get('Principled BSDF')
            if p:
                p.inputs['Roughness'].default_value=.48
                for link in list(p.inputs['Base Color'].links): m.node_tree.links.remove(link)
                p.inputs['Base Color'].default_value=(.045,.022,.012,1)
                texture=next((n for n in m.node_tree.nodes if n.type=='TEX_IMAGE'),None)
                if texture:
                    mix=m.node_tree.nodes.new('ShaderNodeMixRGB'); mix.blend_type='MULTIPLY'; mix.inputs[0].default_value=1; mix.inputs[2].default_value=(.32,.2,.13,1)
                    m.node_tree.links.new(texture.outputs['Color'],mix.inputs[1]); m.node_tree.links.new(mix.outputs[0],p.inputs['Base Color'])

# Professional wardrobe uses the fitted garment topology to avoid body intersections.
jacketmat=material('Wardrobe | midnight wool',(.018,.025,.035),.78)
jacketmat.node_tree.nodes.get('Principled BSDF').inputs['Sheen Weight'].default_value=.25
shirtmat=material('Wardrobe | ivory shirt',(.55,.53,.48),.75)
garment=bpy.data.objects.get('Human.female_casualsuit01')
garment.data.materials.clear(); garment.data.materials.append(shirtmat)
# Duplicate the fitted cloth into a separate jacket shell, with a real front opening.
import bmesh
blazer=garment.copy(); blazer.data=garment.data.copy(); blazer.name='Wardrobe | tailored blazer shell'; collection.objects.link(blazer)
blazer.data.materials.clear(); blazer.data.materials.append(jacketmat)
bm=bmesh.new(); bm.from_mesh(blazer.data)
remove=[]
for face in bm.faces:
    center=face.calc_center_median()
    if center.z<1.05 or (center.y<-.02 and center.z>1.17 and abs(center.x)<(center.z-1.17)*.43): remove.append(face)
bmesh.ops.delete(bm,geom=remove,context='FACES'); bm.to_mesh(blazer.data); bm.free(); blazer.data.update()
for v in blazer.data.vertices: v.co += v.normal*.007
for p in blazer.data.polygons: p.use_smooth=True
sub=blazer.modifiers.new('Tailored shaping','SUBSURF'); sub.levels=1
solid=blazer.modifiers.new('Wool edge','SOLIDIFY'); solid.thickness=.004
character.append(blazer)

def bind_torso(obj):
    group=obj.vertex_groups.new(name='Spine2'); group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    modifier=obj.modifiers.new('Torso follow','ARMATURE'); modifier.object=rig
    collection.objects.link(obj)
    for c in list(obj.users_collection):
        if c != collection: c.objects.unlink(obj)
    character.append(obj)

def cloth_point(x,z):
    hit,loc,normal,index=garment.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
    return (x,loc.y-.007 if hit else -.12,z)
for side in [-1,1]:
    coords=[cloth_point(side*x,z) for x,z in [(.105,1.475),(.16,1.375),(.065,1.22),(.035,1.30)]]
    mesh=bpy.data.meshes.new('Notched lapel pattern'); mesh.from_pydata(coords,[],[(0,1,2),(0,2,3)]); mesh.update()
    lapel=bpy.data.objects.new('Wardrobe | notched lapel',mesh); scene.collection.objects.link(lapel); lapel.data.materials.append(jacketmat)
    solid=lapel.modifiers.new('Lapel thickness','SOLIDIFY'); solid.thickness=.004
    bevel=lapel.modifiers.new('Lapel edge','BEVEL'); bevel.width=.002; bevel.segments=3
    bind_torso(lapel)

# Relax the A-pose using rig-space rotations, keeping the face rig intact.
for bone, angle in [('LeftArm',.3),('RightArm',-.3)]:
    pb=rig.pose.bones.get(bone)
    if pb:
        matrix=pb.matrix.copy(); loc=matrix.translation.copy()
        matrix=Quaternion(Vector((0,1,0)),angle).to_matrix().to_4x4() @ matrix
        matrix.translation=loc; pb.matrix=matrix
bpy.context.view_layer.update()

def cube(name, loc, scale, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o=bpy.context.object; o.name=name
    o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if bevel:
        b=o.modifiers.new('Soft manufactured edges','BEVEL'); b.width=bevel; b.segments=3
        o.modifiers.new('Weighted face normals','WEIGHTED_NORMAL')
    return o

wall=material('Studio | mineral gray',(.045,.055,.07),.85)
floor=material('Studio | honed stone',(.17,.19,.20),.7)
wood=material('Desk | dark walnut',(.065,.038,.024),.38)
metal=material('Details | satin graphite',(.035,.045,.055),.3,.65)
cube('Seamless backdrop',(0,1.35,1.7),(8,.15,5),wall,.08)
cube('Floor',(0,0,-.07),(8,8,.12),floor,.03)
cube('Interview desk',(0,-.58,.93),(1.75,.72,.075),wood,.035)
cube('Desk pedestal',(0,-.4,.44),(.72,.5,.88),metal,.035)
chairmat=material('Chair | woven graphite',(.045,.055,.06),.85)
cube('Chair back',(0,.23,1.12),(.52,.12,.58),chairmat,.08)
cube('Chair seat',(0,.12,.82),(.52,.48,.1),chairmat,.04)

# Architectural wall seams are real set geometry rather than image overlays.
for x in [-2,-1.25,1.25,2]:
    cube('Acoustic panel',(x,1.24,1.65),(.025,.04,2.7),metal,.006)
practical=material('Practical | warm opal',(1,.73,.42),.3)
shader=practical.node_tree.nodes.get('Principled BSDF'); shader.inputs['Emission Color'].default_value=(1,.65,.28,1); shader.inputs['Emission Strength'].default_value=2
for x in [-.65,.65]: cube('Architectural light',(x,1.15,1.5),(.025,.04,1.55),practical,.01)

def point_at(o,target): o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
def light(name,loc,target,power,color,size,shape='DISK'):
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.color=color; data.shape=shape; data.size=size
    o=bpy.data.objects.new(name,data); scene.collection.objects.link(o); o.location=loc; point_at(o,target); return o

focus=(0,-.015,1.50)
light('KEY | large neutral silk',(-1.3,-1.65,2.8),focus,90,(1,.91,.82),1.65)
light('FILL | soft cool bounce',(1.5,-.8,1.8),focus,25,(.72,.83,1),1.8)
light('RIM | warm separation',(.8,.7,2.4),focus,80,(1,.73,.44),.8)
light('TOP | overhead softbox',(-.15,.0,3.0),(0,0,1.2),30,(.83,.9,1),1.3)
light('EYE | subtle catchlight',(.1,-2.1,1.8),focus,4,(1,1,1),.4)
world=bpy.data.worlds.new('Studio ambient'); world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.18,.22,1); world.node_tree.nodes['Background'].inputs[1].default_value=.18; scene.world=world

bpy.ops.object.camera_add(location=(.01,-1.60,1.62)); camera=bpy.context.object; camera.name='CAM | interview portrait'; point_at(camera,(0,0,1.57)); scene.camera=camera
camera.data.lens=70; camera.data.sensor_width=36
bpy.ops.object.empty_add(type='PLAIN_AXES',location=(0,-.035,1.62)); eye_focus=bpy.context.object; eye_focus.name='FOCUS | eyes'
camera.data.dof.use_dof=True; camera.data.dof.focus_object=eye_focus; camera.data.dof.aperture_fstop=4

# A preview performance, editable as shape-key and bone animation tracks.
scene.render.fps=30; scene.frame_start=1; scene.frame_end=240
for o in character:
    if o.type!='MESH' or not o.data.shape_keys: continue
    keys=o.data.shape_keys.key_blocks
    for name in ['eyeBlinkLeft','eyeBlinkRight']:
        if name in keys:
            k=keys[name]
            for f,v in [(1,0),(57,0),(60,1),(64,0),(149,0),(152,1),(156,0),(240,0)]: k.value=v; k.keyframe_insert('value',frame=f)
    for name in ['jawOpen','viseme_aa','viseme_O','viseme_PP']:
        if name in keys:
            k=keys[name]
            for f in range(1,241,4):
                speaking=35<f<115 or 175<f<232
                amount=max(0,math.sin(f*.6)) if speaking else 0
                k.value=amount*(.15 if name=='jawOpen' else .25 if name=='viseme_aa' else .08)
                k.keyframe_insert('value',frame=f)
head=rig.pose.bones.get('Head')
if head:
    head.rotation_mode='XYZ'
    for f in range(1,241,12):
        head.rotation_euler=(.013*math.sin(f*.025),.016*math.sin(f*.018),.012*math.sin(f*.012)); head.keyframe_insert('rotation_euler',frame=f)

scene.frame_set(1)
scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=48; scene.cycles.use_denoising=True
scene.render.resolution_x=1600; scene.render.resolution_y=900; scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'; scene.view_settings.exposure=-.25
scene.render.image_settings.file_format='PNG'; scene.render.filepath=ART+'/renders/interviewer-portrait.png'
scene['Asset attribution']='CC0 MPFB character by met4citizen/TalkingHead; studio, material refinement and performance authored for Interview Meet.'
scene['Quality note']='Cinematic prototype, not a scanned AAA digital human. Cycles skin detail does not fully transfer to glTF.'
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=ART+'/interviewer-studio.blend',compress=True)

# Export only the character, retaining its facial morph targets and bones.
bpy.ops.object.select_all(action='DESELECT')
for o in character: o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=ROOT+'/public/models/interviewer.glb',use_selection=True,export_format='GLB',export_animations=False,export_morph=True,export_skins=True)
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    if o.type=='MESH' and o not in character: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=ROOT+'/public/models/interviewer-studio.glb',use_selection=True,export_format='GLB',export_animations=False)
result={'blend':ART+'/interviewer-studio.blend','export':ROOT+'/public/models/interviewer.glb','objects':len(scene.objects),'characterMeshes':len([o for o in character if o.type=='MESH'])}
print('STUDIO_READY',json.dumps(result))
