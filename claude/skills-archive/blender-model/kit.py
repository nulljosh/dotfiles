"""Tiny modelling kit for headless Blender. In a model script:

    import sys; sys.path.insert(0, "/Users/joshua/.claude/skills/blender-model"); import kit
    kit.reset()
    steel = kit.mat("steel", (.17, .18, .2), metal=.9, rough=.3)
    kit.box("slide", (2.6, .42, .55), (0, 0, .45), mat=steel, bevel=.05)
    kit.cyl("barrel", .09, .3, (1.45, 0, .45), rot=(0, 90, 0), mat=steel)
    kit.finish(sys.argv[-2], sys.argv[-1])   # out.glb, preview.png

Units are metres, Z is up, +X is "forward". Rotations are degrees.
"""
import math, bpy, mathutils


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, metal=0.0, rough=0.5, tex=None, scale=1.0, emit=0.0):
    """Principled material. tex: path to an image (photo texture) tiled `scale` times per metre."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Metallic"].default_value = metal; b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*color, 1); b.inputs["Emission Strength"].default_value = emit
    if tex:
        img = nt.nodes.new("ShaderNodeTexImage"); img.image = bpy.data.images.load(tex)
        co = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (scale, scale, scale)
        nt.links.new(co.outputs["Object"], mp.inputs["Vector"]); nt.links.new(mp.outputs["Vector"], img.inputs["Vector"]); nt.links.new(img.outputs["Color"], b.inputs["Base Color"])
    return m


def _place(o, name, loc, rot, m, bevel, seg=3):
    o.name = name; o.location = loc; o.rotation_euler = [math.radians(a) for a in rot]
    if m: o.data.materials.append(m)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        md = o.modifiers.new("bevel", "BEVEL"); md.width = bevel; md.segments = seg; md.limit_method = "ANGLE"
    bpy.ops.object.shade_smooth_by_angle()
    return o


def box(name, size, loc=(0, 0, 0), rot=(0, 0, 0), mat=None, bevel=0.02):
    bpy.ops.mesh.primitive_cube_add(size=1); o = bpy.context.object; o.scale = size
    return _place(o, name, loc, rot, mat, bevel)


def cyl(name, r, depth, loc=(0, 0, 0), rot=(0, 0, 0), mat=None, verts=32, bevel=0.01):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts)
    return _place(bpy.context.object, name, loc, rot, mat, bevel)


def sphere(name, r, loc=(0, 0, 0), mat=None, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=48, ring_count=24); o = bpy.context.object; o.scale = scale
    return _place(o, name, loc, (0, 0, 0), mat, 0)


def torus(name, major, minor, loc=(0, 0, 0), rot=(0, 0, 0), mat=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=48, minor_segments=16)
    return _place(bpy.context.object, name, loc, rot, mat, 0)


def bounds():
    pts = [o.matrix_world @ mathutils.Vector(c) for o in bpy.data.objects if o.type == "MESH" for c in o.bound_box]
    lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)]); hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
    return lo, hi


def export(path):
    """GLB with modifiers applied. Shrink after with gltf-transform (see SKILL.md)."""
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True)


def preview(path, size=900):
    """3/4 studio render on grey so you can judge the model before it goes in the game."""
    lo, hi = bounds(); c = (lo + hi) / 2; r = max((hi - lo).length / 2, 1e-3)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); bpy.context.scene.collection.objects.link(cam)
    cam.location = c + mathutils.Vector((r * 1.6, -r * 2.2, r * 1.2)); cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    for e, rot in ((4, (50, 10, 30)), (1.5, (60, -20, 210))):
        s = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); s.data.energy = e; s.rotation_euler = [math.radians(a) for a in rot]; bpy.context.scene.collection.objects.link(s)
    w = bpy.data.worlds.new("w"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (.35, .37, .4, 1); bpy.context.scene.world = w
    sc = bpy.context.scene; sc.render.resolution_x = sc.render.resolution_y = size; sc.render.filepath = path
    for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        try: sc.render.engine = eng; break
        except TypeError: continue
    bpy.ops.render.render(write_still=True)


def finish(glb, png):
    export(glb); preview(png); print("kit: wrote", glb, png)
