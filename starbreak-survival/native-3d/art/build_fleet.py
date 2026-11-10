"""Build the editable Starbreak fleet and export batched GLB meshes for Godot."""

import argparse
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector

HERE = Path(__file__).resolve().parent
METALS = {}


def image(name, channels):
    height, width = channels.shape[:2]
    texture = bpy.data.images.new(name, width=width, height=height, alpha=False)
    texture.colorspace_settings.name = "Non-Color"
    texture.pixels.foreach_set(channels.astype(np.float32).ravel())
    texture.pack()
    return texture


def metal_textures():
    """Use the same fine brush/scratch field for every machined finish."""
    size = 128
    rng = np.random.default_rng(83)
    y, x = np.mgrid[0:size, 0:size] * (math.tau / size)
    brush = (np.sin(y * 53 + np.sin(x * 3) * 0.15) * 0.32
             + np.sin(y * 39 + x) * 0.20 + np.sin(y * 14 - x * 2) * 0.13
             + rng.uniform(-0.24, 0.24, (size, size)))
    for row in (12, 35, 71, 108):
        brush[row, :] += np.maximum(0, np.sin(x[row] * 2 + row)) * 0.36
    dx = (np.roll(brush, 1, 1) - np.roll(brush, -1, 1)) * 0.038
    dy = (np.roll(brush, 1, 0) - np.roll(brush, -1, 0)) * 0.059
    z = np.sqrt(1.0 - dx * dx - dy * dy)
    normal = image("Brushed alloy micro-normal", np.stack((.5 + dx, .5 + dy, .5 + .5 * z, np.ones_like(z)), axis=-1))
    return normal, brush


def material(name, color, metal=0.0, roughness=0.4, emission=0.0, brushed=False):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Emission Color"].default_value = (*color, 1)
    shader.inputs["Emission Strength"].default_value = emission
    if brushed:
        normal, brush = METALS["grain"]
        key = (metal, roughness)
        if key not in METALS:
            orm = np.stack((np.ones_like(brush), np.clip(roughness + .10 * brush, .04, .98),
                            np.full_like(brush, metal), np.ones_like(brush)), axis=-1)
            METALS[key] = image(name + " metallic-roughness", orm)
        data = nodes.new("ShaderNodeTexImage")
        data.image = METALS[key]
        split = nodes.new("ShaderNodeSeparateColor")
        links.new(data.outputs["Color"], split.inputs["Color"])
        links.new(split.outputs["Green"], shader.inputs["Roughness"])
        links.new(split.outputs["Blue"], shader.inputs["Metallic"])
        scratches = nodes.new("ShaderNodeTexImage")
        scratches.image = normal
        bump = nodes.new("ShaderNodeNormalMap")
        bump.inputs["Strength"].default_value = 0.40
        links.new(scratches.outputs["Color"], bump.inputs["Color"])
        links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    return mat


def mesh(name, vertices, faces, mat, bevel=0.0, edge=None, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(mat)
    if edge:
        data.materials.append(edge)
    uv = data.uv_layers.new(name="Brushed metal UV")
    for face in data.polygons:
        face.use_smooth = smooth and len(face.vertices) == 4
        axis = max(range(3), key=lambda i: abs(face.normal[i]))
        u, v = ((1, 2), (0, 2), (0, 1))[axis]
        for loop in face.loop_indices:
            p = data.vertices[data.loops[loop].vertex_index].co
            uv.data[loop].uv = (p[u] * 1.75, p[v] * 1.75)
    if bevel > 0.0:
        modifier = obj.modifiers.new("Machined chamfer", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        modifier.limit_method = "ANGLE"
        if edge:
            modifier.material = 1
        normals = obj.modifiers.new("Face-weighted normals", "WEIGHTED_NORMAL")
        normals.keep_sharp = True
    return obj


def plate(name, points, depth, mat, bevel=0.023, edge=None):
    n = len(points)
    vertices = points + [(x, y, z - depth) for x, y, z in points]
    faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, j + n, i + n))
    return mesh(name, vertices, faces, mat, bevel, edge)


def mirrored(points, side):
    return [(x, y * side, z) for x, y, z in points]


def loft(name, rings, mat, sides=12, squareness=1.0, bevel=0.0, edge=None, caps=True):
    vertices = []
    for x, y, z, ry, rz in rings:
        for i in range(sides):
            angle = math.tau * i / sides
            c, s = math.cos(angle), math.sin(angle)
            vertices.append((x, y + ry * math.copysign(abs(c) ** squareness, c),
                             z + rz * math.copysign(abs(s) ** squareness, s)))
    faces = skin(len(rings), sides, caps)
    return mesh(name, vertices, faces, mat, bevel, edge, smooth=bevel == 0.0)


def skin(rings, sides, caps=True):
    faces = []
    for layer in range(rings - 1):
        start = layer * sides
        for i in range(sides):
            j = (i + 1) % sides
            faces.append((start + i, start + j, start + j + sides, start + i + sides))
    if caps:
        faces += [tuple(reversed(range(sides))), tuple(range((rings - 1) * sides, rings * sides))]
    return faces


def lathe(name, center, axis, profile, mat, sides=20, caps=False):
    axial = Vector(axis).normalized()
    across = axial.cross(Vector((0, 1, 0))).normalized()
    around = axial.cross(across)
    center = Vector(center)
    vertices = []
    for depth, radius in profile:
        for i in range(sides):
            a = math.tau * i / sides
            vertices.append(tuple(center + axial * depth + (across * math.cos(a) + around * math.sin(a)) * radius))
    return mesh(name, vertices, skin(len(profile), sides, caps), mat, smooth=True)


def pipe(name, points, radius, mat, sides=8):
    points = [Vector(p) for p in points]
    vertices = []
    for i, point in enumerate(points):
        tangent = (points[min(i + 1, len(points) - 1)] - points[max(0, i - 1)]).normalized()
        across = tangent.cross(Vector((0, 0, 1)))
        if across.length < 0.01:
            across = tangent.cross(Vector((0, 1, 0)))
        across.normalize()
        around = tangent.cross(across)
        for j in range(sides):
            a = math.tau * j / sides
            vertices.append(tuple(point + radius * (across * math.cos(a) + around * math.sin(a))))
    return mesh(name, vertices, skin(len(points), sides), mat, smooth=True)


def block(name, x, y, z, lx, ly, dz, mat, bevel=0.012):
    points = [(x - lx / 2, y - ly / 2, z), (x + lx / 2, y - ly / 2, z),
              (x + lx / 2, y + ly / 2, z), (x - lx / 2, y + ly / 2, z)]
    return plate(name, points, dz, mat, bevel)


def bolts(points, mat=None, radius=0.025):
    for x, y, z in points:
        lathe("Captive fastener", (x, y, z), (0, 0, 1), [(-.012, radius), (.001, radius), (.008, radius * .76)],
              mat or P["steel"], 8, True)


def louvers(x, y, z, length, width, mat, count=5):
    block("Recessed grille", x, y, z, length, width, .045, P["cavity"])
    for i in range(count):
        cx = x + length * ((i + .75) / (count + .5) - .5)
        plate("Louver blade", [(cx - .019, y - width * .43, z + .018),
              (cx + .026, y - width * .43, z + .030), (cx + .057, y + width * .43, z + .022),
              (cx + .012, y + width * .43, z + .010)], .021, mat, .005)


def thruster(name, x, y, z, radius, emission, body=None):
    center = (x, y, z)
    axis = (1, 0, 0)
    r = radius
    lathe(name + " shell", center, axis, [(-.27, .83 * r), (-.24, r), (-.12, 1.04 * r), (.10, r),
          (.16, .77 * r), (.23, .76 * r)], body or P["graphite"])
    lathe("Burnished exhaust collar", center, axis, [(-.265, .83 * r), (-.279, .83 * r),
          (-.285, .67 * r), (-.18, .62 * r)], P["steel"])
    lathe("Status band at nozzle lip", center, axis, [(-.257, .955 * r), (-.245, 1.012 * r),
          (-.232, 1.020 * r), (-.218, 1.006 * r)], emission)
    lathe("Inconel throat", center, axis, [(-.183, .63 * r), (-.114, .54 * r),
          (-.11, .52 * r)], P["cavity"])
    lathe("Ion afterburner", center, axis, [(-.12, .55 * r), (-.118, .47 * r),
          (-.113, .32 * r)], emission)
    lathe("Turbine hub", center, axis, [(-.137, .19 * r), (-.106, .27 * r)], P["graphite"], 12, True)
    for i in range(8):
        a = math.tau * i / 8.0
        pipe("Nozzle actuator", [(x - .24, y + math.cos(a) * r * .91, z + math.sin(a) * r * .91),
             (x + .07, y + math.cos(a) * r * 1.01, z + math.sin(a) * r * 1.01)],
             r * .065, P["steel"], 6)


def lark():
    loft("Titanium monocoque", [(-1.43, 0, -.04, .28, .19), (-.97, 0, -.02, .40, .27),
          (-.28, 0, 0, .40, .28), (.34, 0, -.01, .28, .20), (.90, 0, -.025, .16, .108),
          (1.48, 0, -.035, .07, .053), (1.77, 0, -.042, .012, .018)], P["pearl"], 14, .72)
    loft("Ventral keel", [(-1.29, 0, -.18, .24, .13), (-.56, 0, -.20, .29, .15),
          (.21, 0, -.15, .20, .085), (1.21, 0, -.06, .045, .032)], P["graphite"], 10)
    loft("Canopy sill", [(-.78, 0, .21, .18, .06), (-.47, 0, .255, .24, .10),
          (.20, 0, .223, .20, .08), (.60, 0, .17, .058, .035)], P["steel"], 12, .68)
    loft("Faceted teal canopy", [(-.67, 0, .258, .123, .036), (-.43, 0, .307, .192, .092),
          (.06, 0, .271, .17, .068), (.46, 0, .207, .064, .023)], P["glass"], 10, .72)
    pipe("Central canopy spar", [(-.68, 0, .291), (-.43, 0, .405), (.06, 0, .343), (.46, 0, .232)],
         .011, P["steel"], 6)
    for side in (-1, 1):
        m = lambda pts: mirrored(pts, side)
        plate("Load-bearing swept spar", m([(.24, .28, .16), (-.42, .49, .10), (-1.43, 1.03, -.06),
              (-1.64, 1.01, -.08), (-1.16, .55, -.015), (-.90, .30, .17)]), .14, P["graphite"], .032, P["steel"])
        plate("Ivory outer wing", m([(-.27, .38, .205), (-.83, .61, .160), (-1.57, 1.015, .005),
              (-1.34, 1.009, .029), (-.90, .647, .142), (-.67, .485, .215)]), .090, P["wing_coat"], .023, P["satin"])
        plate("Inboard thermal plate", m([(-.12, .33, .215), (-.54, .52, .159), (-.85, .61, .131),
              (-.78, .46, .178), (-.63, .34, .227)]), .068, P["satin"], .021, P["pearl"])
        pipe("Brass leading trim", m([(.15, .31, .181), (-.40, .50, .148), (-1.09, .83, .065),
             (-1.55, 1.016, -.012)]), .021, P["trim"], 6)
        plate("Forward cowling", m([(1.66, .016, -.009), (.93, .151, .092), (.35, .279, .217),
              (.46, .333, .166), (.88, .213, .054), (1.60, .047, -.012)]), .055, P["satin"], .018, P["pearl"])
        plate("Forward titanium panel", m([(1.06, .055, .064), (.70, .117, .121), (.45, .198, .189),
              (.59, .220, .161), (.89, .138, .101)]), .032, P["pearl"], .010, P["satin"])
        plate("Intake fairing", m([(-.14, .274, .244), (-.53, .341, .256), (-1.12, .357, .242),
              (-1.21, .265, .189), (-.59, .248, .226)]), .088, P["pearl"], .021, P["steel"])
        louvers(-.72, side * .324, .260, .32, .071, P["graphite"], 5)
        thruster("Dual ion nacelle", -1.38, side * .236, -.047, .165, P["cyan"])
        pipe("Exposed propellant line", m([(-1.36, .35, .073), (-1.09, .41, .093), (-.81, .40, .120)]),
             .024, P["trim"])
        pipe("Running light", m([(.28, .273, .179), (.45, .257, .171), (.55, .232, .142)]),
             .016, P["cyan"], 6)
        pipe("Wingtip light", m([(-1.53, .996, -.005), (-1.40, .958, -.002)]), .016, P["cyan"], 6)
        pipe("Inboard service seam", m([(-1.18, .322, .239), (-.96, .316, .255), (-.76, .282, .273)]),
             .008, P["cavity"], 6)
        bolts(m([(-.74, .543, .174), (-.98, .698, .102), (-1.17, .783, .068), (.34, .277, .225)]), radius=.018)


def scout():
    loft("Needle frame", [(-1.32, 0, 0, .27, .16), (-.63, 0, .01, .25, .17),
          (-.06, 0, 0, .23, .149), (.48, 0, -.026, .148, .089), (1.14, 0, -.035, .061, .042),
          (1.67, 0, -.042, .008, .009)], P["graphite"], 12, .74)
    loft("Jade forward fairing", [(-.68, 0, .095, .17, .075), (-.02, 0, .103, .20, .075),
          (.52, 0, .040, .135, .045), (1.46, 0, -.026, .030, .017)], P["jade"], 10, .77)
    loft("Slit sensor glass", [(-.20, 0, .152, .112, .025), (.23, 0, .122, .105, .032),
          (.63, 0, .051, .054, .023)], P["glass"], 10)
    thruster("Single vectoring engine", -1.26, 0, -.005, .192, P["teal"])
    for side in (-1, 1):
        m = lambda pts: mirrored(pts, side)
        plate("Raked aft control fin", m([(-.29, .19, .121), (-.66, .35, .076), (-1.16, .48, .115),
              (-1.52, .48, .121), (-1.21, .27, .071), (-.78, .21, .090)]), .080, P["jade"], .019, P["steel"])
        plate("Trimmed mid-body panel", m([(.86, .056, .005), (.43, .153, .095), (-.17, .219, .146),
              (-.41, .251, .101), (.31, .194, .069), (.73, .102, .016)]), .055, P["jade"], .015, P["satin"])
        louvers(-.71, side * .19, .146, .29, .08, P["steel"], 4)
        pipe("Green navigation insert", m([(-1.31, .442, .123), (-1.11, .432, .115)]), .020, P["teal"], 6)
        bolts(m([(-.82, .313, .100), (-.41, .235, .116), (.33, .168, .084)]), radius=.020)


def striker(pulse=False):
    armor = P["pulse_armor"] if pulse else P["copper"]
    trim = P["violet_trim"] if pulse else P["burnt"]
    light = P["pink"] if pulse else P["amber"]
    loft("Armored pressure vessel", [(-1.13, 0, -.045, .34, .23), (-.87, 0, 0, .56, .38),
          (-.46, 0, .015, .69, .49), (.15, 0, .02, .72, .49), (.66, 0, -.005, .59, .40),
          (1.00, 0, -.035, .37, .27), (1.10, 0, -.04, .19, .14)], P["graphite"], 16, .80)
    loft("Dorsal armor backing", [(-.92, 0, .270, .25, .09), (-.58, 0, .372, .35, .091),
          (-.13, 0, .428, .40, .085), (.37, 0, .381, .34, .090), (.72, 0, .289, .22, .067),
          (.96, 0, .18, .10, .05)], P["graphite"], 12, .7)
    thruster("Impulse motor", -.99, 0, -.016, .272, light, P["burnt"])
    lathe("Amber rangefinder seat", (.92, 0, .27), (.62, 0, 1), [(-.075, .16), (.002, .145), (.032, .105)],
          P["steel"], 16)
    lathe("Forward rangefinder", (.92, 0, .27), (.62, 0, 1), [(.018, .107), (.040, .081), (.045, .061)],
          light, 16, True)
    for side in (-1, 1):
        m = lambda pts: mirrored(pts, side)
        plate("Forward upper armor", m([(.06, .025, .589), (.18, .266, .551), (.60, .277, .456),
              (.82, .143, .362), (.80, .025, .404)]), .112, armor, .030, trim)
        plate("Aft upper armor", m([(-.05, .025, .600), (-.18, .298, .575), (-.57, .318, .529),
              (-.78, .162, .465), (-.74, .025, .532)]), .152, armor, .029, trim)
        plate("Upper shoulder tile", m([(.64, .34, .456), (.38, .49, .439), (-.13, .56, .456),
              (-.56, .45, .465), (-.29, .30, .558), (.21, .28, .576)]), .110, armor, .035, trim)
        plate("Segmented side armor", m([(.99, .22, .222), (.72, .48, .338), (.24, .69, .303),
              (-.12, .70, .293), (-.36, .60, .365), (.23, .54, .443), (.64, .39, .434)]),
              .128, trim, .032, armor)
        plate("Aft quarter clamp", m([(-.37, .59, .369), (-.58, .585, .34), (-.86, .438, .300),
              (-1.02, .301, .294), (-.68, .318, .453), (-.51, .428, .450)]), .112, armor, .031, trim)
        plate("Ventral armor brow", m([(.60, .63, .115), (.26, .755, .115), (-.29, .716, .093),
              (-.58, .617, .065), (-.38, .580, .113), (.21, .618, .125)]), .110, armor, .020, trim)
        louvers(-.16, side * .34, .579, .34, .092, P["burnt"], 5)
        pipe("Reactor shoulder seam", m([(.41, .469, .441), (.65, .381, .442), (.78, .326, .372)]),
             .022, light, 7)
        bolts(m([(.38, .434, .467), (-.43, .385, .490), (-.80, .404, .357), (.20, .65, .331)]),
              P["steel"], .023)


def heavy():
    loft("Reinforced deep hull", [(-1.31, 0, -.04, .45, .25), (-.95, 0, -.02, .65, .36),
          (-.38, 0, .015, .66, .42), (.20, 0, .012, .59, .36), (.68, 0, 0, .43, .27),
          (1.15, 0, -.03, .29, .193), (1.36, 0, -.05, .16, .12)], P["graphite"], 12, .62)
    plate("Faceted prow armor", [(1.38, 0, .099), (1.19, .22, .155), (.70, .352, .258), (.44, .24, .349),
          (.44, -.24, .349), (.70, -.352, .258), (1.19, -.22, .155)], .160, P["gunmetal"], .034, P["steel"])
    plate("Central violet face", [(.85, 0, .248), (.63, .20, .326), (.25, .22, .435), (-.17, .16, .477),
          (-.17, -.16, .477), (.25, -.22, .435), (.63, -.20, .326)], .100, P["violet"], .029, P["violet_trim"])
    plate("Aft bridge armor", [(-.27, 0, .470), (-.48, .15, .465), (-.94, .15, .405),
          (-1.16, 0, .36), (-.94, -.15, .405), (-.48, -.15, .465)], .089, P["violet"], .021, P["violet_trim"])
    for side in (-1, 1):
        m = lambda pts: mirrored(pts, side)
        plate("Manta wing spar", m([(.69, .30, .190), (.12, .61, .236), (-.72, .82, .197),
              (-1.27, .925, .206), (-1.16, .53, .275), (-.44, .39, .32)]), .205, P["graphite"], .045, P["steel"])
        plate("Leading armored shoulder", m([(.61, .294, .342), (.27, .490, .355), (-.24, .602, .390),
              (-.43, .49, .413), (-.11, .294, .473), (.25, .235, .438)]), .098, P["violet"], .038, P["violet_trim"])
        plate("Mid flank shield", m([(.05, .54, .367), (-.25, .711, .322), (-.78, .800, .290),
              (-.95, .690, .298), (-.74, .542, .359), (-.32, .478, .420)]),
              .121, P["violet"], .036, P["violet_trim"])
        plate("Aft swept armor", m([(-.56, .527, .423), (-.91, .784, .323), (-1.30, .930, .260),
              (-1.20, .694, .286), (-1.22, .488, .371), (-.87, .418, .448)]),
              .105, P["violet"], .025, P["violet_trim"])
        plate("Ventral segmented vane", m([(-.21, .726, .252), (-.62, .897, .202), (-1.27, .93, .198),
              (-1.10, .805, .217), (-.70, .692, .268)]), .092, P["satin"], .025)
        louvers(-.49, side * .27, .430, .58, .197, P["steel"], 7)
        thruster("Reinforced twin drive", -1.18, side * .37, .016, .227, P["pink"])
        pipe("Magenta edge slit", m([(.55, .264, .332), (.37, .307, .390), (.25, .359, .401)]),
             .015, P["pink"], 6)
        pipe("External coolant line", m([(-1.20, .552, .211), (-.96, .584, .274), (-.76, .578, .309)]),
             .027, P["steel"], 7)
        bolts(m([(.13, .437, .388), (-.15, .548, .414), (-.62, .706, .339), (-1.11, .789, .314)]), radius=.023)


def blade(name, side, sections, mat, edge):
    vertices = []
    for y, front, rear, z, thickness in sections:
        width = rear - front
        shape = [(front, z), (front + .18 * width, z + .42 * thickness),
                 (front + .60 * width, z + .50 * thickness), (rear - .06 * width, z + .28 * thickness),
                 (rear, z - .06 * thickness), (rear - .17 * width, z - .40 * thickness),
                 (front + .44 * width, z - .50 * thickness), (front + .08 * width, z - .28 * thickness)]
        vertices.extend((x, side * y, height) for x, height in shape)
    return mesh(name, vertices, skin(len(sections), 8), mat, .021, edge)


def marker(name, position):
    node = bpy.data.objects.new(name, None)
    node.location = position
    node.empty_display_size = 0.13
    bpy.context.collection.objects.link(node)
    return node


def attach(parts, parent):
    bpy.context.view_layer.update()
    for part in parts:
        world = part.matrix_world.copy()
        part.parent = parent
        part.matrix_world = world


def guardian():
    loft("Dreadnought spine", [(-1.44, 0, .04, .54, .33), (-1.09, 0, .015, .95, .56),
          (-.47, 0, -.01, 1.24, .64), (.23, 0, -.025, 1.32, .62), (.94, 0, -.04, 1.06, .51),
          (1.49, 0, -.09, .56, .37), (1.61, 0, -.11, .23, .24)], P["black_steel"], 14, .63)
    plate("Center rear armor", [(.40, -.46, .578), (1.04, -.39, .495), (1.57, -.16, .288),
          (1.56, .16, .289), (1.05, .39, .495), (.40, .46, .578), (.12, 0, .714)],
          .207, P["plum"], .049, P["plum_trim"])
    plate("Axial raised spine", [(.09, -.14, .726), (.64, -.225, .640), (1.14, -.14, .527),
          (1.35, 0, .433), (1.14, .14, .527), (.64, .225, .640), (.09, .14, .726)],
          .142, P["gunmetal"], .036, P["bronze"])
    thruster("Reactor exhaust", 1.35, 0, -.05, .26, P["amber"], P["black_steel"])
    center = (-.70, 0, .79)
    axis = (-.32, 0, .947)
    lathe("Stepped reactor cradle", center, axis, [(-.28, .68), (-.16, .78), (.00, .79), (.10, .71),
          (.18, .62), (.23, .60), (.22, .51), (.11, .48)], P["black_steel"], 32)
    lathe("Reactor lip", center, axis, [(.070, .713), (.105, .742), (.145, .732), (.166, .694),
          (.161, .638), (.131, .604)], P["bronze"], 32)
    lathe("Inlaid heat band", center, axis, [(.169, .631), (.183, .611), (.189, .590)], P["amber"], 32)
    lathe("Reactor bezel", center, axis, [(.18, .588), (.235, .569), (.276, .520), (.255, .457),
          (.240, .412)], P["steel"], 32)
    lathe("Recessed orange plasma chamber", center, axis, [(.249, .416), (.277, .369), (.309, .292),
          (.34, .203), (.357, .112), (.368, .005)], P["core"], 32, True)
    lathe("Internal cooling aperture", center, axis, [(.283, .338), (.296, .329), (.306, .305), (.305, .289)],
          P["bronze"], 32)
    lathe("Inner ion throat", center, axis, [(.353, .134), (.380, .101), (.387, .044), (.388, .002)],
          P["core_hot"], 24, True)
    marker("CoreTarget", (-.82, 0, 1.15))
    ring_basis = Vector((.947, 0, .32))
    for i in range(16):
        angle = math.tau * i / 16.0
        outward = ring_basis * math.cos(angle) + Vector((0, math.sin(angle), 0))
        latch = [tuple(Vector(center) + outward * r + Vector(axis) * depth)
                 for r, depth in ((.51, .27), (.59, .23), (.64, .19), (.72, .153))]
        pipe("Radial reactor lock", latch, .047 if i % 4 else .059, P["bronze"], 7)
        if i % 2 == 1:
            glow = [tuple(Vector(center) + outward * r + Vector(axis) * d)
                    for r, d in ((.45, .284), (.48, .276), (.51, .265))]
            pipe("Reactor scale marker", glow, .015, P["amber"], 6)
    for side, name in ((-1, "lower"), (1, "upper")):
        m = lambda pts: mirrored(pts, side)
        plate("Overlapping aft armor skirt", m([(.23, .51, .642), (.58, .48, .595), (1.03, .44, .520),
              (1.48, .36, .356), (1.29, .61, .399), (.98, .77, .429), (.51, .76, .533)]),
              .159, P["plum"], .045, P["plum_trim"])
        louvers(.79, side * .514, .586, .42, .133, P["gunmetal"], 6)
        pipe("Reactor aft sensor slit", m([(.72, .674, .475), (.91, .604, .455), (1.15, .534, .437)]),
             .018, P["amber"], 6)
        bolts(m([(.42, .561, .637), (1.02, .475, .538), (1.31, .442, .445)]), P["bronze"], .024)
        wing = marker("Wing_" + name, (.25, side * 1.22, 0))
        previous = set(bpy.context.scene.objects)
        sections = [(0.88, -.71, 1.06, .034, .82), (1.25, -.47, 1.24, .035, .73),
                    (1.66, -.31, .93, .043, .61), (2.05, -.28, .73, .045, .49),
                    (2.44, -.40, .47, .054, .39), (2.79, -.56, .18, .075, .27),
                    (3.12, -.77, -.17, .11, .20), (3.40, -1.02, -.53, .15, .13),
                    (3.63, -1.28, -.95, .18, .08), (3.75, -1.44, -1.38, .20, .025)]
        blade("Curved tungsten wing frame", side, sections, P["black_steel"], P["bronze"])
        rail = [(front + (rear - front) * .13, side * y, z + t * .28)
                for y, front, rear, z, t in sections]
        pipe("Long forward bronze rail", rail, .048, P["bronze"], 8)
        pipe("Exposed secondary spine", m([(.48, 1.04, .45), (.46, 1.50, .39), (.39, 2.02, .29),
             (.20, 2.39, .24), (-.11, 2.81, .23), (-.51, 3.18, .23)]), .066, P["steel"], 9)
        pipe("Protected core feed line", m([(-.48, .63, .65), (-.31, 1.05, .55), (-.22, 1.42, .49),
             (-.16, 1.79, .39), (-.10, 2.15, .33)]), .060, P["bronze"], 9)
        plate("Reactor jaw armor", m([(-.87, .53, .663), (-.62, .84, .648), (-.35, 1.13, .625),
              (.24, 1.23, .553), (.56, 1.04, .515), (.23, .67, .553), (-.18, .56, .678)]),
              .172, P["plum"], .050, P["plum_trim"])
        plate("Shoulder shroud", m([(-.32, 1.10, .547), (-.04, 1.47, .474), (.41, 1.65, .431),
              (1.16, 1.38, .392), (1.38, 1.20, .336), (.91, 1.14, .496), (.28, .86, .614)]),
              .125, P["plum"], .050, P["plum_trim"])
        plate("Brow fin on exposed rib", m([(-.40, 1.55, .405), (-.29, 1.95, .338), (.10, 2.17, .313),
              (.69, 1.96, .311), (.49, 1.71, .407), (-.01, 1.42, .515)]),
              .11, P["gunmetal"], .044, P["bronze"])
        plate("Sickle flank plate", m([(-.23, 1.97, .363), (-.34, 2.39, .316), (-.52, 2.76, .277),
              (-.16, 2.75, .277), (.43, 2.47, .271), (.55, 2.12, .320), (.20, 1.91, .430)]),
              .123, P["plum"], .041, P["plum_trim"])
        plate("Tapered curved blade armor", m([(-.53, 2.65, .278), (-.79, 3.12, .246), (-1.05, 3.43, .229),
              (-1.40, 3.73, .211), (-1.15, 3.65, .229), (-.71, 3.42, .261), (-.27, 3.00, .293),
              (.10, 2.76, .282), (-.16, 2.65, .324)]), .076, P["plum"], .027, P["plum_trim"])
        for i in range(6):
            y = 1.08 + i * .176
            x = .62 - (y - 1.08) * .31
            plate("Exposed rib behind jaw", m([(x - .1, y - .055, .445 - i * .022),
                  (x + .25, y + .07, .407 - i * .017), (x + .22, y + .13, .396 - i * .018),
                  (x - .10, y + .015, .434 - i * .022)]), .10, P["black_steel"], .019, P["steel"])
        louvers(.55, side * .92, .482, .48, .130, P["bronze"], 7)
        pipe("Narrow amber status strips", m([(.37, 1.74, .411), (.29, 1.91, .369)]), .021, P["amber"], 6)
        pipe("Narrow amber status strips", m([(-.19, 2.57, .343), (-.34, 2.76, .319)]), .019, P["amber"], 6)
        bolts(m([(-.58, .88, .650), (.30, 1.22, .592), (.82, 1.30, .456),
                 (.06, 2.14, .399), (-.30, 2.72, .328), (-.73, 3.22, .271)]), P["bronze"], .029)
        attach(set(bpy.context.scene.objects) - previous, wing)


def select_only(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)


def export_optimized(name, parts, path):
    """Batch each assembly by material while keeping its transform node."""
    batches = bpy.data.collections.new("Temporary GLB")
    bpy.context.scene.collection.children.link(batches)
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    clones = {}
    original_names = {}
    groups = {}
    for part in sorted(parts, key=lambda obj: obj.name):
        if part.type == "EMPTY":
            original_names[part] = part.name
            part.name += "_source"
            clone = bpy.data.objects.new(original_names[part], None)
            clone.matrix_world = part.matrix_world.copy()
            batches.objects.link(clone)
            clones[part] = clone
        else:
            groups.setdefault(part.parent, []).append(part)
    for parent, group in groups.items():
        baked = []
        for obj in group:
            data = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph),
                                                 preserve_all_data_layers=True, depsgraph=depsgraph)
            clone = bpy.data.objects.new(obj.name + "_baked", data)
            clone.matrix_world = obj.matrix_world.copy()
            batches.objects.link(clone)
            baked.append(clone)
        select_only(baked)
        bpy.context.view_layer.objects.active = baked[0]
        if len(baked) > 1:
            bpy.ops.object.join()
        assembly = bpy.context.view_layer.objects.active
        assembly.name = name + ("_Shell" if parent is None else "_" + original_names[parent] + "_Shell")
        if parent is not None:
            world = assembly.matrix_world.copy()
            assembly.parent = clones[parent]
            assembly.matrix_world = world
        triangles = assembly.modifiers.new("Export triangles", "TRIANGULATE")
        triangles.keep_custom_normals = True
        bpy.ops.object.modifier_apply(modifier=triangles.name)
    select_only(list(batches.objects))
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True,
                             export_apply=False, export_extras=True, export_tangents=True)
    for obj in list(batches.objects):
        data = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if data and data.users == 0:
            bpy.data.meshes.remove(data)
    bpy.data.collections.remove(batches)
    for obj, original in original_names.items():
        obj.name = original


def build(name, builder, models, display, heading=0.0):
    before = set(bpy.context.scene.objects)
    builder()
    parts = set(bpy.context.scene.objects) - before
    export_optimized(name, parts, models / (name + ".glb"))
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    stand = marker(name + " • editable assembly", (0, 0, 0))
    parts.add(stand)
    attach([part for part in parts if part != stand and part.parent is None], stand)
    stand.location = display
    stand.rotation_euler.z = heading
    for part in parts:
        for source in list(part.users_collection):
            source.objects.unlink(part)
        collection.objects.link(part)


def add_studio():
    """Studio lights and camera for reviewing the source file, outside the GLBs."""
    scene = bpy.context.scene
    studio = bpy.data.collections.new("Studio • preview only")
    scene.collection.children.link(studio)
    surface = material("Studio charcoal", (.013, .023, .039), .12, .62)
    floor = block("Studio floor", 0, 0, -.86, 200, 200, .05, surface, 0)
    for source in list(floor.users_collection):
        source.objects.unlink(floor)
    studio.objects.link(floor)
    camera_data = bpy.data.cameras.new("Fleet review")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 13.0
    camera = bpy.data.objects.new("Fleet review", camera_data)
    studio.objects.link(camera)
    camera.location = (-1.75, -6.1, 16.4)
    camera.rotation_euler = (Vector((-1.25, 0, 0)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    for name, location, target, color, energy, size, size_y in [
        ("Warm hangar key", (-4, 4, 7), (-2, 0, 0), (1, .86, .69), 1750, 6.0, 3.0),
        ("Cool edge softbox", (4, 2, 5), (1, 0, 0), (.43, .62, 1), 1350, 4.0, 1.6),
        ("Front inspection panel", (-4, -4, 4), (-3, -.5, 0), (.77, .89, 1), 1100, 4.8, 2.0),
        ("Reactor rim", (5.0, -3.0, 3.0), (2.8, 0, 0), (1, .56, .29), 450, 2.4, 1.2),
    ]:
        light = bpy.data.lights.new(name, "AREA")
        light.color = color
        light.energy = energy
        light.shape = "RECTANGLE"
        light.size, light.size_y = size, size_y
        obj = bpy.data.objects.new(name, light)
        studio.objects.link(obj)
        obj.location = location
        obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
    scene.world = bpy.data.worlds.new("Cool ambient bounce")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.17, .22, .31, 1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .32
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1540
    scene.render.resolution_y = 940
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "AgX"
    bpy.ops.object.select_all(action="DESELECT")
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                view = area.spaces.active
                view.region_3d.view_location = Vector((-1.25, 0, 0))
                view.region_3d.view_rotation = camera.rotation_euler.to_quaternion()
                view.region_3d.view_distance = 15.0
                view.region_3d.view_perspective = "ORTHO"
                view.shading.color_type = "MATERIAL"
                view.overlay.show_floor = False
                view.overlay.show_extras = False
    studio.hide_viewport = True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=HERE.parent)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    output = args.output.resolve()
    models = output / "assets" / "fleet"
    models.mkdir(parents=True, exist_ok=True)
    (output / "art").mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    METALS["grain"] = metal_textures()
    P.update({
        "pearl": material("Warm silver titanium", (.54, .52, .47), .63, .34, brushed=True),
        "wing_coat": material("Pearl-coated titanium wing", (.65, .61, .54), .42, .32, brushed=True),
        "satin": material("Satin aluminum", (.31, .34, .37), .78, .31, brushed=True),
        "steel": material("Milled silver edge", (.39, .40, .41), .81, .27, brushed=True),
        "graphite": material("Graphite structure", (.035, .040, .046), .59, .39, brushed=True),
        "cavity": material("Recessed carbon", (.009, .012, .016), .12, .65),
        "trim": material("Aged champagne trim", (.35, .24, .12), .80, .34, brushed=True),
        "glass": material("Deep teal optical glass", (.012, .245, .257), .55, .14, .32),
        "cyan": material("Ice cyan ion light", (.03, .77, .83), .15, .24, 2.0),
        "jade": material("Oxidized jade alloy", (.066, .22, .19), .68, .38, brushed=True),
        "teal": material("Muted mint running light", (.05, .54, .41), .10, .25, 1.7),
        "copper": material("Brushed copper armor", (.37, .131, .048), .68, .37, brushed=True),
        "burnt": material("Heat-darkened copper", (.17, .064, .036), .70, .40, brushed=True),
        "violet": material("Smoked amethyst armor", (.14, .066, .194), .66, .35, brushed=True),
        "violet_trim": material("Worn violet edge", (.245, .145, .32), .71, .32, brushed=True),
        "pulse_armor": material("Black cherry shock armor", (.225, .052, .10), .66, .35, brushed=True),
        "pink": material("Magenta reactor light", (.77, .026, .22), .21, .29, 2.25),
        "gunmetal": material("Gray tungsten", (.113, .106, .104), .68, .33, brushed=True),
        "black_steel": material("Forged black steel", (.059, .050, .053), .77, .35, brushed=True),
        "plum": material("Guardian plum armor", (.130, .066, .092), .70, .39, brushed=True),
        "plum_trim": material("Polished plum bevel", (.23, .122, .15), .78, .28, brushed=True),
        "bronze": material("Anodized reactor bronze", (.28, .133, .050), .77, .33, brushed=True),
        "amber": material("Amber status light", (.77, .19, .022), .16, .33, 1.75),
        "core": material("Reactor corona orange", (.84, .074, .004), .12, .27, 1.65),
        "core_hot": material("Reactor amber hot point", (1, .30, .017), .09, .20, 3.1),
    })
    build("Lark", lark, models, (-5.4, 2.15, 0))
    build("Scout", scout, models, (-1.4, 2.15, 0), math.pi)
    build("Striker", striker, models, (-5.4, 0, 0), math.pi)
    build("Heavy", heavy, models, (-1.4, 0, 0), math.pi)
    build("Pulse", lambda: striker(pulse=True), models, (-3.4, -2.20, 0), math.pi)
    build("StarRing", guardian, models, (2.55, 0, 0))
    add_studio()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(output / "art" / "fleet.blend"))


P = {}
main()
