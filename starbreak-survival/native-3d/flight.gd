extends Node3D

const HUD = preload("res://flight_hud.gd")
const LARK = preload("res://assets/fleet/Lark.glb")
const FOE_MODELS := [
	preload("res://assets/fleet/Scout.glb"),
	preload("res://assets/fleet/Striker.glb"),
	preload("res://assets/fleet/Heavy.glb"),
	preload("res://assets/fleet/Pulse.glb"),
]
const GUARDIAN = preload("res://assets/fleet/StarRing.glb")
const MUSIC = preload("res://assets/deep-space-echo.mp3")
const SFX := {
	"warning": preload("res://assets/sfx/warning.wav"),
	"charge": preload("res://assets/sfx/charge.wav"),
	"launch": preload("res://assets/sfx/launch.wav"),
	"impact": preload("res://assets/sfx/impact.wav"),
	"core-rupture": preload("res://assets/sfx/core-rupture.wav"),
	"hull-break": preload("res://assets/sfx/hull-break.wav"),
	"destroyed": preload("res://assets/sfx/destroyed.wav"),
	"bullet-hit": preload("res://assets/sfx/bullet-hit.wav"),
	"armor-hit": preload("res://assets/sfx/armor-hit.wav"),
	"enemy-explode": preload("res://assets/sfx/enemy-explode.wav"),
	"enemy-rush": preload("res://assets/sfx/enemy-rush.wav"),
	"heavy-explode": preload("res://assets/sfx/heavy-explode.wav"),
	"spread": preload("res://assets/sfx/spread.wav"),
}
const BEAM_COLOR := Color("#8efcff")
const GOLD := Color("#ff9250")
const BOSS_HP := 46.0
const BOSS_AT := 9.0
const BREAK_TIME := 3.2
const BEAM_WINDUP := 0.4
const BEAM_DURATION := 1.07
const WAVES := [
	[0.75, 0.0, 0], [2.0, 3.7, 1], [3.3, -3.1, 1], [4.8, 0.2, 2],
	[6.5, -2.4, 3], [7.1, 4.0, 1], [8.1, 0.0, 0],
	[11.7, -4.2, 1], [14.8, 3.7, 3], [18.5, -2.2, 2],
]
const DETONATIONS := [0.0, 0.25, 0.47, 0.68, 0.99, 1.19, 1.46]
const DETONATION_CUES := ["core-rupture", "hull-break", "hull-break", "destroyed", "", "hull-break", ""]
const BLAST_OFFSETS := [
	Vector3(-1.0, 0.0, 1.1), Vector3(0.0, 2.8, 0.7), Vector3(0.1, -2.4, 0.8),
	Vector3(0.0, 0.0, 0.6), Vector3(0.6, 3.3, 0.8), Vector3(-0.4, -2.9, 0.7), Vector3(0.9, 1.2, 0.6),
]

enum Mode { READY, FLIGHT, DETONATION, WIN, LOSS }

class Foe:
	var body: Node3D
	var hp: float
	var radius: float
	var speed: float
	var kind: int
	var age := 0.0
	var glow: OmniLight3D

class Shot:
	var node: MeshInstance3D
	var velocity: Vector3
	var damage: float

class Effect:
	var node: Node3D
	var velocity: Vector3
	var spin: Vector3
	var life: float
	var duration: float
	var growth := 0.0
	var light: OmniLight3D
	var start_energy := 0.0

var mode := Mode.READY
var hud: CanvasLayer
var camera: Camera3D
var world: Node3D
var arena: Node3D
var player: Node3D
var player_model: Node3D
var boss: Node3D
var boss_model: Node3D
var boss_core: Node3D
var boss_lamp: OmniLight3D
var boss_hp := BOSS_HP
var boss_age := 0.0
var elapsed := 0.0
var wave := 0
var score := 0
var hull := 3
var immune := 0.0
var energy := 66.0
var cooldown := 0.0
var spread := 0.0
var beam_time := 0.0
var beam_contact := 0
var next_hit_sound := 0.0
var beam_mesh: MeshInstance3D
var beam_sleeve: MeshInstance3D
var beam_lamp: OmniLight3D
var defeat_age := 0.0
var blast := 0
var foes: Array[Foe] = []
var shots: Array[Shot] = []
var effects: Array[Effect] = []
var pickups: Array[Node3D] = []
var music: AudioStreamPlayer
var sfx: AudioStreamPlayer
var sfx_playback: AudioStreamPlaybackPolyphonic
var bolt_mesh: BoxMesh
var spark_mesh: BoxMesh
var ring_mesh: TorusMesh
var orb_mesh: SphereMesh
var bolt_material: StandardMaterial3D
var warm_material: StandardMaterial3D
var hot_material: StandardMaterial3D
var pickup_material: StandardMaterial3D
var sky_time := 0.0


func _ready() -> void:
	hud = HUD.new()
	add_child(hud)
	build_space()
	hud.launched.connect(start_flight)
	hud.beam_pressed.connect(fire_beam)
	hud.music_toggled.connect(func(_on: bool) -> void: sync_music())
	hud.sound_toggled.connect(func(on: bool) -> void: sfx.volume_db = 0.0 if on else -80.0)
	music = AudioStreamPlayer.new()
	var track := MUSIC.duplicate() as AudioStreamMP3
	track.loop = true
	music.stream = track
	add_child(music)
	sfx = AudioStreamPlayer.new()
	var effects_stream := AudioStreamPolyphonic.new()
	effects_stream.polyphony = 16
	sfx.stream = effects_stream
	add_child(sfx)
	sfx.play()
	sfx_playback = sfx.get_stream_playback() as AudioStreamPlaybackPolyphonic
	bolt_material = glow_material(BEAM_COLOR, 2.1)
	warm_material = glow_material(GOLD, 2.0)
	hot_material = glow_material(Color("#fff0ab"), 2.9)
	pickup_material = glow_material(Color("#82ddff"), 1.9)
	bolt_mesh = BoxMesh.new()
	bolt_mesh.size = Vector3(0.71, 0.09, 0.11)
	spark_mesh = BoxMesh.new()
	spark_mesh.size = Vector3(0.14, 0.045, 0.05)
	ring_mesh = TorusMesh.new()
	ring_mesh.inner_radius = 0.94
	ring_mesh.outer_radius = 1.01
	ring_mesh.rings = 32
	ring_mesh.ring_segments = 6
	orb_mesh = SphereMesh.new()
	orb_mesh.radial_segments = 12
	orb_mesh.rings = 6
	make_arena()
	player.position = Vector3(3.5, -2.6, 0)
	make_boss()
	boss.position = Vector3(10.4, 0.7, 0)
	update_hud()


func _unhandled_key_input(event: InputEvent) -> void:
	if not event.is_pressed() or event.is_echo():
		return
	if event.physical_keycode == KEY_SPACE:
		fire_beam()
	elif event.physical_keycode in [KEY_ENTER, KEY_R]:
		start_flight()


func _physics_process(dt: float) -> void:
	sky_time += dt
	match mode:
		Mode.READY:
			player_model.rotation.x = 0.20 + sin(sky_time * 1.1) * 0.21
			player_model.rotation.y = -0.22
			boss_model.rotation.y = 0.31 + sin(sky_time * 0.73) * 0.19
		Mode.FLIGHT:
			update_flight(dt)
		Mode.DETONATION:
			update_detonation(dt)
	update_effects(dt)
	var shake := maxf(0.0, 1.0 - (defeat_age - 0.68) / 0.72) if mode == Mode.DETONATION and defeat_age >= 0.68 else 0.0
	camera.position.x = sin(sky_time * 57.0) * shake * 0.19
	camera.position.y = cos(sky_time * 43.0) * shake * 0.11
	var drift := Vector2(-10.6 - player.position.x, player.position.y) * 0.75
	hud.sky.advance(dt, drift if mode != Mode.READY else Vector2.ZERO)
	update_hud()


func make_arena() -> void:
	if is_instance_valid(arena):
		world.remove_child(arena)
		arena.queue_free()
	arena = Node3D.new()
	world.add_child(arena)
	boss = null
	foes.clear()
	shots.clear()
	effects.clear()
	pickups.clear()
	player = Node3D.new()
	arena.add_child(player)
	player.position = Vector3(-10.6, 0, 0)
	player_model = put_model(LARK, player)
	var tube := CylinderMesh.new()
	tube.top_radius = 0.55
	tube.bottom_radius = 0.38
	tube.height = 1.0
	tube.radial_segments = 12
	tube.rings = 1
	beam_mesh = mesh_at(tube, glow_material(Color("#d5fffd"), 4.1), Vector3.ZERO, arena)
	var sleeve_material := glow_material(Color(0.21, 0.76, 1.0, 0.18), 2.0)
	sleeve_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	sleeve_material.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	beam_sleeve = mesh_at(tube, sleeve_material, Vector3.ZERO, arena)
	beam_mesh.hide()
	beam_sleeve.hide()
	beam_lamp = light_at(arena, Vector3.ZERO, BEAM_COLOR, 0.0, 8.0)


func start_flight() -> void:
	if mode in [Mode.FLIGHT, Mode.DETONATION]:
		return
	make_arena()
	mode = Mode.FLIGHT
	elapsed = 0.0
	wave = 0
	score = 0
	hull = 3
	immune = 0.0
	energy = 66.0
	spread = 0.0
	cooldown = 0.0
	beam_time = 0.0
	beam_contact = 0
	next_hit_sound = 0.0
	defeat_age = 0.0
	hud.panel.hide()
	hud.reset_stick()
	sync_music()


func update_flight(dt: float) -> void:
	elapsed += dt
	immune = maxf(0.0, immune - dt)
	spread = maxf(0.0, spread - dt)
	var axis: Vector2 = hud.stick
	axis.x += float(Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT))
	axis.x -= float(Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT))
	axis.y += float(Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN))
	axis.y -= float(Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP))
	axis = axis.limit_length(1.0)
	player.position.x = clampf(player.position.x + axis.x * dt * 10.5, -13.4, 6.0)
	player.position.y = clampf(player.position.y - axis.y * dt * 10.5, -6.0, 5.55)
	player_model.rotation.x = lerpf(player_model.rotation.x, 0.13 - axis.y * 0.44, dt * 9.0)
	player_model.rotation.y = lerpf(player_model.rotation.y, -0.15 + axis.x * 0.19, dt * 8.0)
	player.visible = immune <= 0.0 or int(immune * 13.0) % 2 == 0
	if elapsed >= BOSS_AT and boss == null:
		make_boss()
		play_sound("warning")
	while wave < WAVES.size() and elapsed >= WAVES[wave][0]:
		spawn_foe(WAVES[wave][1], WAVES[wave][2])
		wave += 1
	if boss != null:
		boss_age += dt
		boss.position.x = 10.8 + 7.7 * pow(maxf(0.0, 1.0 - boss_age / 1.5), 2.0) - maxf(0.0, boss_age - 1.5) * 1.07
		boss.position.y = sin(boss_age * 0.97) * 2.25
		boss_model.rotation.y = 0.17 + sin(boss_age * 1.17) * 0.18
		boss_lamp.light_energy = 1.8 + sin(boss_age * 8.0) * 0.52
		if boss.position.x < -12.4:
			end_flight(false, "防线失守")
			return
		if boss_age > 0.5 and armor_at(player.position):
			hit_player()
			if mode != Mode.FLIGHT:
				return
	for i in range(foes.size() - 1, -1, -1):
		var foe := foes[i]
		var age_before := foe.age
		foe.age += dt
		var speed := foe.speed
		if foe.kind == 3:
			foe.glow.light_energy = pow(maxf(0.0, sin(foe.age * 17.0)), 3.0) * 4.0
			speed = lerpf(speed, speed * 2.3, smoothstep(1.8, 2.06, foe.age))
			if age_before < 1.8 and foe.age >= 1.8:
				play_sound("enemy-rush")
		foe.body.position.x -= dt * speed
		if foe.body.position.distance_squared_to(player.position) < pow(foe.radius + 0.58, 2.0):
			burst(foe.body.position, false)
			foe.body.queue_free()
			foes.remove_at(i)
			hit_player()
			if mode != Mode.FLIGHT:
				return
		elif foe.body.position.x < -17.0:
			foe.body.queue_free()
			foes.remove_at(i)
	cooldown -= dt
	if cooldown <= 0.0:
		cooldown = 0.22
		fire_bolt(0.0)
		if spread > 0.0:
			fire_bolt(-0.20)
			fire_bolt(0.20)
	update_pickups(dt)
	update_shots(dt)
	update_beam(dt)
	if boss != null and boss_hp <= 0.0:
		mode = Mode.DETONATION
		sync_music()
		defeat_age = 0.0
		blast = 0
		score += 1500
		player.show()
		beam_mesh.hide()
		beam_sleeve.hide()
		beam_lamp.light_energy = 0.0
		for shot in shots:
			shot.node.queue_free()
		shots.clear()
		update_detonation(0.0)


func make_boss() -> void:
	boss = Node3D.new()
	arena.add_child(boss)
	boss.position.x = 18.5
	boss_model = put_model(GUARDIAN, boss)
	boss_model.scale *= 1.22
	boss_core = boss_model.find_child("CoreTarget", true, false) as Node3D
	boss_lamp = light_at(boss, Vector3(-1.0, 0.0, 1.45), GOLD, 2.0, 5.8)
	boss_hp = BOSS_HP
	boss_age = 0.0


func spawn_foe(y: float, kind: int) -> void:
	var foe := Foe.new()
	foe.body = Node3D.new()
	arena.add_child(foe.body)
	foe.body.position = Vector3(17.5, y, 0)
	foe.body.rotation.z = PI
	var model := put_model(FOE_MODELS[kind], foe.body)
	foe.hp = [1.0, 5.0, 9.0, 5.0][kind]
	foe.radius = [0.58, 0.86, 1.17, 0.86][kind]
	foe.speed = [8.0, 6.3, 4.6, 6.3][kind]
	foe.kind = kind
	model.scale *= [0.56, 0.78, 1.03, 0.81][kind]
	if kind == 3:
		foe.glow = light_at(foe.body, Vector3(0, 0, 0.55), Color("#ff558e"), 2.0, 3.0)
	foes.append(foe)


func hit_player() -> void:
	if immune > 0.0:
		return
	hull -= 1
	immune = 1.0
	play_sound("enemy-explode" if hull > 0 else "heavy-explode")
	if hull == 0:
		burst(player.position, true)
		player.hide()
		end_flight(false, "战机坠毁")


func fire_bolt(angle: float) -> void:
	var shot := Shot.new()
	shot.node = mesh_at(bolt_mesh, bolt_material, player.position + Vector3(1.42, 0, 0.2), arena)
	shot.node.rotation.z = angle
	shot.velocity = Vector3(cos(angle), sin(angle), 0) * 28.0
	shot.damage = 1.0 if angle == 0.0 else 0.5
	shots.append(shot)


func core_position() -> Vector3:
	return boss_core.global_position


func armor_at(at: Vector3) -> bool:
	var d := at - boss.position
	return Vector2((d.x - 0.09) / 1.75, d.y / 4.05).length_squared() < 1.0


func near_segment(at: Vector3, from: Vector3, to: Vector3, radius: float) -> bool:
	var a := Vector2(from.x, from.y)
	var b := Vector2(to.x, to.y)
	var p := Vector2(at.x, at.y)
	return Geometry2D.get_closest_point_to_segment(p, a, b).distance_squared_to(p) < radius * radius


func update_shots(dt: float) -> void:
	for i in range(shots.size() - 1, -1, -1):
		var shot := shots[i]
		var from := shot.node.position
		shot.node.position += shot.velocity * dt
		var at := shot.node.position
		var impact := false
		for j in range(foes.size() - 1, -1, -1):
			if near_segment(foes[j].body.position, from, at, foes[j].radius):
				damage_foe(j, shot.damage)
				impact = true
				break
		if not impact and boss != null:
			var core := core_position()
			if near_segment(core, from, at, 0.66):
				boss_hp -= shot.damage
				energy = minf(100.0, energy + 1.5)
				play_hit("bullet-hit")
				burst(at, false, 5)
				impact = true
			elif armor_at(at) and (at.x >= core.x or absf(at.y - core.y) >= 0.66):
				play_hit("armor-hit")
				burst(at, false, 4)
				impact = true
		if impact or absf(at.y) > 10.0 or at.x > 18.0:
			shot.node.queue_free()
			shots.remove_at(i)


func damage_foe(index: int, damage: float, feedback := true) -> void:
	var foe := foes[index]
	foe.hp -= damage
	if foe.hp > 0.0:
		if feedback:
			burst(foe.body.position, false, 4)
			play_hit("bullet-hit")
		return
	var heavy := foe.kind == 2
	var at := foe.body.position
	burst(at, heavy, 0, true)
	play_sound("heavy-explode" if heavy else "enemy-explode")
	score += 180 if heavy else 100
	energy = minf(100.0, energy + (23.0 if heavy else 14.0))
	if heavy:
		var timer := get_tree().create_timer(0.48)
		timer.timeout.connect(drop_module.bind(at, arena.get_instance_id()))
	foe.body.queue_free()
	foes.remove_at(index)


func drop_module(at: Vector3, flight_id: int) -> void:
	if flight_id != arena.get_instance_id() or mode != Mode.FLIGHT:
		return
	var module := BoxMesh.new()
	module.size = Vector3(0.52, 0.52, 0.52)
	var node := mesh_at(module, pickup_material, at + Vector3(0, 0, 0.42), arena)
	pickups.append(node)


func update_pickups(dt: float) -> void:
	for i in range(pickups.size() - 1, -1, -1):
		var module := pickups[i]
		module.position.x -= dt * 3.5
		module.rotation += Vector3(1.6, 2.3, 0.7) * dt
		if module.position.distance_to(player.position) < 1.22:
			spread = 8.0
			play_sound("spread")
			module.queue_free()
			pickups.remove_at(i)
		elif module.position.x < -17.0:
			module.queue_free()
			pickups.remove_at(i)


func fire_beam() -> void:
	if mode != Mode.FLIGHT or energy < 100.0 or beam_time > 0.0:
		return
	energy = 0.0
	beam_time = BEAM_WINDUP + BEAM_DURATION
	beam_contact = 0
	play_sound("charge")


func update_beam(dt: float) -> void:
	if beam_time <= 0.0:
		return
	var previous := beam_time
	beam_time = maxf(0.0, beam_time - dt)
	if previous > BEAM_DURATION and beam_time <= BEAM_DURATION:
		play_sound("launch")
	var start := player.position + Vector3(1.55, 0, 0.38)
	if beam_time > BEAM_DURATION:
		beam_lamp.position = start
		beam_lamp.light_energy = (BEAM_WINDUP + BEAM_DURATION - beam_time) * 6.2
		return
	var end := Vector3(17.0, start.y, start.z)
	var contact := 0
	if boss != null and boss.position.x > start.x and absf(boss.position.y - start.y) < 3.8:
		var core := core_position()
		end.x = boss.position.x - 1.4
		contact = 1
		if absf(core.y - start.y) < 0.88:
			end = core
			contact = 2
			boss_hp -= 24.0 * dt
			if randf() < 0.42:
				burst(core, false, 4)
	if contact != beam_contact and contact != 0:
		play_sound("impact" if contact == 2 else "armor-hit")
	beam_contact = contact
	for i in range(foes.size() - 1, -1, -1):
		var at := foes[i].body.position
		if at.x > start.x and at.x < end.x and absf(at.y - start.y) < 0.85:
			damage_foe(i, 28.0 * dt, randf() < 0.09)
	end.x = maxf(start.x + 0.2, end.x)
	var path := end - start
	var direction := Basis(Quaternion(Vector3.UP, path.normalized()))
	var thickness := 0.07 + sqrt(beam_time) * 0.26
	beam_mesh.position = start.lerp(end, 0.5)
	beam_mesh.basis = direction
	beam_mesh.scale = Vector3(thickness, path.length(), thickness)
	beam_mesh.visible = beam_time > 0.0
	beam_sleeve.position = beam_mesh.position
	beam_sleeve.basis = direction
	beam_sleeve.scale = Vector3(thickness * 2.7, path.length(), thickness * 2.7)
	beam_sleeve.visible = beam_mesh.visible
	beam_lamp.position = start
	beam_lamp.light_energy = beam_time * 4.2


func update_detonation(dt: float) -> void:
	defeat_age += dt
	while blast < DETONATIONS.size() and defeat_age >= DETONATIONS[blast]:
		var main := blast == 3
		burst(boss.position + BLAST_OFFSETS[blast], main, 0, true)
		var cue: String = DETONATION_CUES[blast]
		if not cue.is_empty():
			play_sound(cue)
		if main:
			for side in ["upper", "lower"]:
				var wing := boss_model.find_child("Wing_" + side, true, false) as Node3D
				if wing != null:
					wing.reparent(arena)
					var sign_y := 1.0 if side == "upper" else -1.0
					add_effect(wing, Vector3(2.1, sign_y * 2.1, -1.9), Vector3(0.56, 0.9, sign_y), 2.46)
			boss_lamp.light_energy = 0.0
			boss_model.hide()
		blast += 1
	if defeat_age >= BREAK_TIME:
		end_flight(true, "突围成功")


func end_flight(won: bool, title: String) -> void:
	mode = Mode.WIN if won else Mode.LOSS
	beam_mesh.hide()
	beam_sleeve.hide()
	beam_lamp.light_energy = 0.0
	sync_music()
	var copy := "得分 %d · 飞行 %d 秒" % [score, int(elapsed)]
	if title == "防线失守":
		copy = "守卫突破防线 · 得分 %d" % score
	hud.result(title, copy, "再飞一局" if won else "重新出击", "任务完成" if won else "任务中断")


func update_hud() -> void:
	var label: String = ["待命", "第一波", "守卫解体", "任务完成", "任务中断"][mode]
	var ratio := -1.0
	var defense_fraction := -1.0
	var danger := false
	if mode == Mode.FLIGHT and boss != null:
		label = "Boss 战"
		ratio = maxf(0.0, boss_hp / BOSS_HP)
		defense_fraction = camera.unproject_position(Vector3(-12.4, 0, 0)).x / maxf(1.0, hud.viewport.size.x)
		danger = boss.position.x < -6.3
	elif mode == Mode.FLIGHT and elapsed >= 4.8:
		label = "第二波"
	hud.show_defense_line(defense_fraction, danger)
	hud.set_status(label, elapsed, hull, score, 0.0 if mode == Mode.READY else energy,
		ratio, ratio >= 0.0 and boss_age < 1.65, spread if mode == Mode.FLIGHT else 0.0, beam_time > 0.0)


func put_model(scene: PackedScene, parent: Node3D) -> Node3D:
	var pivot := Node3D.new()
	parent.add_child(pivot)
	var model := scene.instantiate() as Node3D
	model.rotation.x = PI * 0.5
	pivot.add_child(model)
	return pivot


func build_space() -> void:
	world = Node3D.new()
	hud.viewport.add_child(world)
	camera = Camera3D.new()
	camera.position.z = 25.0
	camera.fov = 39.0
	world.add_child(camera)
	camera.make_current()
	var ambient := WorldEnvironment.new()
	var env := Environment.new()
	var reflection := ShaderMaterial.new()
	reflection.shader = preload("res://fleet_reflection.gdshader")
	var sky := Sky.new()
	sky.radiance_size = Sky.RADIANCE_SIZE_128
	sky.sky_material = reflection
	env.sky = sky
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#c1c9d8")
	env.ambient_light_energy = 0.39
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.glow_enabled = true
	env.glow_intensity = 0.78
	ambient.environment = env
	world.add_child(ambient)
	sun(Vector3(-24, -28, 0), Color("#fff0dc"), 1.45)
	sun(Vector3(26, 36, 0), Color("#a8bfff"), 0.68)


func sun(angles: Vector3, color: Color, strength: float) -> void:
	var node := DirectionalLight3D.new()
	node.rotation_degrees = angles
	node.light_color = color
	node.light_energy = strength
	world.add_child(node)


func glow_material(color: Color, strength: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.emission_enabled = true
	material.emission = color
	material.emission_energy_multiplier = strength
	return material


func mesh_at(shape: Mesh, material: Material, at: Vector3, parent: Node3D) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	node.mesh = shape
	node.material_override = material
	node.position = at
	parent.add_child(node)
	return node


func light_at(parent: Node3D, at: Vector3, color: Color, strength: float, reach: float) -> OmniLight3D:
	var light := OmniLight3D.new()
	light.position = at
	light.light_color = color
	light.light_energy = strength
	light.omni_range = reach
	parent.add_child(light)
	return light


func burst(at: Vector3, big: bool, count := 0, wavefront := false) -> void:
	if count == 0:
		count = 72 if big else 20
	for i in range(count):
		var direction := Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-0.5, 1.0)).normalized()
		var node := mesh_at(spark_mesh, hot_material if i % 4 == 0 else warm_material, at, arena)
		node.scale = Vector3.ONE * randf_range(0.52, 1.75)
		node.rotation.z = atan2(direction.y, direction.x)
		add_effect(node, direction * randf_range(1.8, 12.0 if big else 5.3),
			Vector3(2.0, 1.8, 0.0), randf_range(0.55, 2.10) if big else randf_range(0.12, 0.68))
	if not wavefront:
		return
	var core := mesh_at(orb_mesh, hot_material, at, arena)
	add_effect(core, Vector3.ZERO, Vector3.ZERO, 0.31 if big else 0.23, 3.4 if big else 1.7)
	var wave_node := mesh_at(ring_mesh, warm_material, at, arena)
	wave_node.rotation.x = PI * 0.5
	wave_node.scale = Vector3.ONE * 0.25
	add_effect(wave_node, Vector3(0, 0, 0.7), Vector3(0.14, 0.08, 0), 1.03 if big else 0.44, 7.2 if big else 2.4)
	var effect := effects.back() as Effect
	effect.light = light_at(arena, at + Vector3(0, 0, 1), GOLD, 11.0 if big else 4.0, 10.0 if big else 4.5)
	effect.start_energy = effect.light.light_energy


func add_effect(node: Node3D, velocity: Vector3, spin: Vector3, life: float, growth := 0.0) -> void:
	var effect := Effect.new()
	effect.node = node
	effect.velocity = velocity
	effect.spin = spin
	effect.life = life
	effect.duration = life
	effect.growth = growth
	effects.append(effect)


func update_effects(dt: float) -> void:
	for i in range(effects.size() - 1, -1, -1):
		var effect := effects[i]
		effect.life -= dt
		if effect.life <= 0.0:
			effect.node.queue_free()
			if effect.light != null:
				effect.light.queue_free()
			effects.remove_at(i)
			continue
		var fade := effect.life / effect.duration
		effect.node.position += effect.velocity * dt
		effect.node.rotation += effect.spin * dt
		effect.node.scale += Vector3.ONE * (effect.growth * fade - 0.26 * (1.0 - fade)) * dt
		if effect.light != null:
			effect.light.light_energy = effect.start_energy * fade * fade


func sync_music() -> void:
	music.volume_db = linear_to_db(0.43 if mode == Mode.DETONATION else 0.73)
	var active: bool = hud.music.button_pressed and mode in [Mode.FLIGHT, Mode.DETONATION]
	if active and not music.playing:
		music.play()
	music.stream_paused = not active


func play_hit(cue: String) -> void:
	if elapsed >= next_hit_sound:
		next_hit_sound = elapsed + 0.09
		play_sound(cue)


func play_sound(cue: String) -> void:
	if hud.sound.button_pressed and sfx_playback != null:
		sfx_playback.play_stream(SFX[cue])
