"""Worked example: a pistol. Blender -b --factory-startup --python example_pistol.py -- out.glb preview.png"""
import sys; sys.path.insert(0, "/Users/joshua/.claude/skills/blender-model"); import kit

kit.reset()
steel = kit.mat("steel", (.16, .17, .19), metal=.9, rough=.28)
poly = kit.mat("polymer", (.05, .05, .055), rough=.7)
kit.box("slide", (.19, .028, .034), (0, 0, .03), mat=steel, bevel=.004)
kit.box("frame", (.16, .026, .024), (-.005, 0, .004), mat=poly, bevel=.004)
kit.cyl("barrel", .0055, .02, (.1, 0, .03), rot=(0, 90, 0), mat=steel)
kit.box("grip", (.035, .028, .095), (-.06, 0, -.045), rot=(0, -16, 0), mat=poly, bevel=.006)
kit.torus("guard", .016, .003, (-.005, 0, -.012), rot=(90, 0, 0), mat=poly)
kit.box("sight", (.008, .006, .006), (.085, 0, .049), mat=steel, bevel=.001)
kit.finish(sys.argv[-2], sys.argv[-1])
