extends CanvasLayer

signal launched
signal beam_pressed
signal music_toggled(on: bool)
signal sound_toggled(on: bool)

const BACKDROP = preload("res://flight_backdrop.gd")
const TOUCH_CONTROLS = preload("res://flight_touch.gd")
const UI_FONT = preload("res://assets/starbreak-ui.ttf")
const ICE := Color("#88f6f2")
const INK := Color("#eef1ff")
const MUTED := Color("#a4add1")
const LINE := Color("#2a3156")
const CABINET := Color("#12172d")
const BOLT := "M13 2 4 14h7l-1 8 10-13h-7z"
const MARK := "M12 1c2 6 5 9 11 11-6 2-9 5-11 11C10 17 7 14 1 12 7 10 10 7 12 1z"
const EXPAND := "M9 4H4v5m11-5h5v5m0 6v5h-5m-6 0H4v-5"

var touch_layout := DisplayServer.is_touchscreen_available() or "--touch-layout" in OS.get_cmdline_user_args()
var cabinet: Panel
var outline: Panel
var identity: Control
var actions: Control
var hud_row: Control
var score_text: Label
var clock: Label
var pips: Array[StyleBoxFlat] = []
var phase: Label
var stage: Control
var margins: TextureRect
var margin_fade: ShaderMaterial
var field: Control
var field_frame: Panel
var sky: Control
var viewport: SubViewport
var viewport_container: SubViewportContainer
var defense: Control
var boss_card: Control
var boss_fill: TextureRect
var warning: Label
var wave_notice: Label
var boss_warning: TextureRect
var weapon: Label
var panel: TextureRect
var tag: Label
var heading: Label
var description: Label
var launch_button: Button
var charge: Control
var energy_text: Label
var energy_fill: TextureRect
var beam: Button
var beam_icon: TextureRect
var beam_icon_idle: ImageTexture
var beam_icon_charged: ImageTexture
var sound: Button
var music: Button
var footer: Control
var touch: Control
var stick := Vector2.ZERO
var finger := -1


func _ready() -> void:
	var page := texture(gradient([Color("#20204a"), Color("#0b0d1e")],
		PackedFloat32Array([0.0, 1.0]), true, Vector2(0.58, 0.07), Vector2(1, 0.85)), self)
	page.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	cabinet = plate(CABINET, LINE, 17, self)
	build_field()
	build_masthead()
	build_controls()
	outline = plate(Color.TRANSPARENT, LINE, 17, cabinet)
	(outline.get_theme_stylebox("panel") as StyleBoxFlat).draw_center = false
	get_viewport().size_changed.connect(layout)
	layout()
	result("星环突围", "躲避敌机，击碎守卫核心，守住防线。", "开始出击", "第 01 航段 · 星环禁区")


func build_masthead() -> void:
	identity = group(cabinet)
	var emblem := plate(Color("#192541"), Color("#45618b"), 12, identity)
	place(emblem, Rect2(0, 0, 43, 43))
	var star := texture(icon(MARK, ICE, 23), emblem)
	place(star, Rect2(10, 10, 23, 23))
	if not touch_layout:
		caption("S T A R B R E A K   /   F L I G H T  0 1", Rect2(55, 0, 220, 16), 10, Color("#95b6eb"), identity)
	caption("飞机大战", Rect2(55, 0 if touch_layout else 15, 132, 37 if touch_layout else 29), 25 if touch_layout else 23, INK, identity)

	hud_row = group(cabinet)
	var score_x := 0.0
	var hull_x := 180.0 if touch_layout else 425.0
	var time_x := 320.0 if touch_layout else 802.0
	var font_size := 19 if touch_layout else 12
	var numbers := 23 if touch_layout else 16
	caption("得分", Rect2(score_x, 0, 48, 30), font_size, MUTED, hud_row)
	score_text = caption("00000", Rect2(score_x + (46 if touch_layout else 34), 0, 100, 30), numbers, INK, hud_row)
	caption("机体", Rect2(hull_x, 0, 48, 30), font_size, MUTED, hud_row)
	var diamond_size := 16.0 if touch_layout else 9.0
	for i in range(3):
		var pip := plate(Color("#f6a0ce"), Color("#ee9cc9"), 3 if touch_layout else 2, hud_row)
		var where := Rect2(hull_x + (52 if touch_layout else 35) + i * (24 if touch_layout else 15),
			15.0 - diamond_size / 2.0, diamond_size, diamond_size)
		place(pip, where)
		pip.pivot_offset = pip.size / 2.0
		pip.rotation = PI / 4.0
		pips.append(pip.get_theme_stylebox("panel") as StyleBoxFlat)
	caption("飞行时间", Rect2(time_x, 0, 90, 30), font_size, MUTED, hud_row)
	clock = caption("00:00", Rect2(time_x + (88 if touch_layout else 54), 0, 78, 30), numbers, INK, hud_row)

	actions = group(cabinet)
	var button_w := 82.0 if touch_layout else 56.0
	var button_h := 74.0 if touch_layout else 34.0
	var gap := 8.0
	var button_font := 19 if touch_layout else 12
	sound = action("音效开", Rect2(0, 0, button_w, button_h), button_font, actions)
	music = action("音乐开", Rect2(button_w + gap, 0, button_w, button_h), button_font, actions)
	var full_w := 94.0 if touch_layout else 64.0
	var full := action("全屏", Rect2((button_w + gap) * 2, 0, full_w, button_h), button_font, actions)
	full.icon = icon(EXPAND, INK, 23 if touch_layout else 14, true)
	full.add_theme_color_override("font_color", Color("#e5f4ff"))
	full.pressed.connect(func() -> void:
		var is_full := DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if is_full else DisplayServer.WINDOW_MODE_FULLSCREEN)
		full.text = "全屏" if is_full or touch_layout else "退出全屏")
	bind_toggle(sound, "音效", sound_toggled)
	bind_toggle(music, "音乐", music_toggled)
	var phase_x := (button_w + gap) * 2 + full_w + gap
	var phase_h := 41.0 if touch_layout else 29.0
	var pill := plate(Color("#131830"), LINE, 28, actions)
	place(pill, Rect2(phase_x, (button_h - phase_h) / 2.0, 125 if touch_layout else 91, phase_h))
	var dot := plate(ICE, ICE, 10, pill)
	place(dot, Rect2(11, (phase_h - 8.0) / 2.0, 8, 8))
	phase = caption("待命", Rect2(27, 0, pill.size.x - 32, phase_h), 17 if touch_layout else 12, Color("#c0cafa"), pill)
	actions.size.x = phase_x + pill.size.x


func build_field() -> void:
	stage = group(cabinet)
	stage.clip_contents = true
	field = group(stage)
	field.clip_contents = true
	sky = BACKDROP.new()
	sky.mouse_filter = Control.MOUSE_FILTER_IGNORE
	field.add_child(sky)
	viewport_container = SubViewportContainer.new()
	viewport_container.stretch = true
	viewport_container.mouse_filter = Control.MOUSE_FILTER_IGNORE
	field.add_child(viewport_container)
	viewport = SubViewport.new()
	viewport.transparent_bg = true
	viewport.own_world_3d = true
	viewport.handle_input_locally = false
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	viewport.msaa_3d = Viewport.MSAA_2X
	viewport_container.add_child(viewport)
	defense = group(field)
	for i in range(28):
		var dash := ColorRect.new()
		dash.color = Color("#98c1f0")
		dash.mouse_filter = Control.MOUSE_FILTER_IGNORE
		defense.add_child(dash)
		place(dash, Rect2(0, i * 22.0, 1.5, 10))
	defense.hide()

	boss_card = group(field)
	caption("星环守卫 · 瞄准发光核心", Rect2(0, 0, 480, 22), 16 if touch_layout else 13,
		Color("#ffe2ef"), boss_card).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	boss_fill = meter(Rect2(0, 25, 480, 6), Color("#dc4898"), Color("#ffa579"), boss_card)
	boss_warning = texture(gradient([Color("#451c3b00"), Color("#451c3bea"), Color("#451c3bea"), Color("#451c3b00")],
		PackedFloat32Array([0, 0.21, 0.79, 1])), field)
	place(boss_warning, Rect2(0, 0, 442, 54))
	warning = caption("", Rect2(0, 0, 442, 54), 25 if touch_layout else 22, Color("#ffe6d9"), boss_warning)
	warning.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	wave_notice = caption("", Rect2(0, 0, 480, 46), 28, Color("#ffe5f1"), field)
	wave_notice.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	wave_notice.add_theme_color_override("font_shadow_color", Color("#f660a8"))
	wave_notice.add_theme_constant_override("shadow_offset_y", 1)
	weapon = caption("", Rect2(0, 0, 155, 32), 16 if touch_layout else 13, Color("#b8fff6"), field)
	weapon.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var badge := style(Color("#122943e8"), Color("#40778e"), 6)
	weapon.add_theme_stylebox_override("normal", badge)
	field_frame = plate(Color.TRANSPARENT, Color("#333c65"), 0, field)
	(field_frame.get_theme_stylebox("panel") as StyleBoxFlat).draw_center = false
	field_frame.visible = not touch_layout

	panel = texture(gradient([Color("#080c21ed"), Color("#0d102aa1"), Color("#080a1908")],
		PackedFloat32Array([0.0, 0.48, 0.84])), field)
	tag = caption("", Rect2(0, 0, 400, 24), 16 if touch_layout else 12, ICE, panel)
	heading = caption("", Rect2(0, 0, 630, 94), 78 if touch_layout else 73, Color("#f7f7ff"), panel)
	heading.add_theme_constant_override("outline_size", 2)
	heading.add_theme_color_override("font_outline_color", Color("#f7f7ff"))
	description = caption("", Rect2(0, 0, 635, 36), 23 if touch_layout else 16, Color("#d5defc"), panel)
	launch_button = action("", Rect2(0, 0, 196 if touch_layout else 137, 72 if touch_layout else 44), 24 if touch_layout else 14, panel)
	button_style(launch_button, ICE, Color("#a8ffff"), Color("#0c2330"), Color("#c1fffc"), 8)
	launch_button.pressed.connect(func() -> void: launched.emit())
	if touch_layout:
		margins = texture(BACKDROP.SKY, stage)
		margin_fade = ShaderMaterial.new()
		margin_fade.shader = preload("res://flight_edges.gdshader")
		margins.material = margin_fade


func build_controls() -> void:
	charge = group(cabinet)
	if touch_layout:
		var chip := plate(Color("#102341e0"), Color("#517aa07d"), 8, charge)
		place(chip, Rect2(0, 0, 76, 39))
		energy_text = caption("0%", Rect2(0, 0, 76, 39), 20, ICE, chip)
		energy_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		touch = TOUCH_CONTROLS.new()
		touch.mouse_filter = Control.MOUSE_FILTER_IGNORE
		cabinet.add_child(touch)
		var diameter := TOUCH_CONTROLS.BEAM_RADIUS * 2.0
		beam = action("发射光束", Rect2(0, 0, diameter, diameter), 22, cabinet)
		for state in ["normal", "hover", "pressed", "hover_pressed", "disabled"]:
			beam.add_theme_stylebox_override(state, StyleBoxEmpty.new())
		for state in ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color", "font_disabled_color"]:
			beam.add_theme_color_override(state, Color.TRANSPARENT)
		var nameplate := caption("发射光束", Rect2(0, 86, diameter, 44), 22, Color("#e5ffff"), beam)
		nameplate.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		beam_icon = texture(icon(BOLT, Color("#d3e5fc"), 33), beam)
		place(beam_icon, Rect2((diameter - 33.0) / 2.0, 43, 33, 33))
	else:
		caption("光束能量", Rect2(0, 0, 112, 19), 12, Color("#c8d4fb"), charge)
		energy_text = caption("0%", Rect2(308, 0, 57, 19), 12, ICE, charge)
		energy_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		energy_fill = meter(Rect2(0, 22, 365, 8), Color("#6265ec"), ICE, charge)
		beam = action("发射光束   Space", Rect2(0, 0, 148, 44), 13, cabinet)
		button_style(beam, Color("#80eee5"), Color("#8ef7ef"), Color("#0a2433"), Color("#b0fff6"), 8)
		beam.add_theme_stylebox_override("disabled", style(Color("#212a4a"), Color("#414d76"), 8))
		beam.add_theme_color_override("font_disabled_color", Color("#a4b4df"))
		beam_icon_idle = icon(BOLT, Color("#a4b4df"), 16)
		beam_icon_charged = icon(BOLT, Color("#0a2433"), 16)
		beam.icon = beam_icon_idle
		footer = group(self)
		caption("方向键 / WASD 移动 · 自动射击", Rect2(0, 0, 420, 21), 12, MUTED, footer)
		var tip := caption("击毁敌机为光束充能 · 重型敌机会掉落蓝色三路射击道具", Rect2(420, 0, 538, 21), 12, MUTED, footer)
		tip.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	beam.pressed.connect(func() -> void: beam_pressed.emit())


func layout() -> void:
	var screen := get_viewport().get_visible_rect().size
	var width := screen.x - 18.0 if touch_layout else 958.0
	var total_height := screen.y - 16.0 if touch_layout else 688.0
	var header := 84.0 if touch_layout else 85.0
	var top := 8.0 if touch_layout else maxf(8.0, (screen.y - 712.0) / 2.0)
	place(cabinet, Rect2((screen.x - width) / 2.0, top, width, total_height))
	place(outline, Rect2(Vector2.ZERO, cabinet.size))
	identity.position = Vector2(16, 20 if touch_layout else 10)
	actions.position = Vector2(width - actions.size.x - 16, 5 if touch_layout else 13)
	hud_row.position = Vector2((width - 440) / 2.0 - 94, 27) if touch_layout else Vector2(17, 53)
	var field_height := total_height - header if touch_layout else 539.0
	place(stage, Rect2(1.0, header, width - 2.0, field_height - 1.0))
	var inner := minf(stage.size.x, stage.size.y * 16.0 / 9.0)
	place(field, Rect2((stage.size.x - inner) / 2.0, 0.0, inner, stage.size.y))
	if touch_layout:
		place(margins, Rect2(Vector2.ZERO, stage.size))
		margin_fade.set_shader_parameter("field_inset", field.position.x / stage.size.x)
		margin_fade.set_shader_parameter("fade_width", inner * 0.05 / stage.size.x)
		margin_fade.set_shader_parameter("cover_scale", inner / stage.size.x)
	var field_rect := Rect2(Vector2.ZERO, field.size)
	for child in [sky, viewport_container, panel, field_frame]:
		place(child, field_rect)
	boss_card.position = Vector2((inner - 480.0) / 2.0, field.size.y * 0.05)
	boss_warning.position = Vector2((inner - boss_warning.size.x) / 2.0, field.size.y * 0.23)
	wave_notice.position = Vector2((inner - wave_notice.size.x) / 2.0, field.size.y * 0.37)
	weapon.position = Vector2((inner - weapon.size.x) / 2.0 if touch_layout else 18.0, field.size.y - 52)
	var text_x := inner * 0.06
	var text_y := field.size.y * 0.50 - (130 if touch_layout else 112)
	tag.position = Vector2(text_x, text_y)
	heading.position = Vector2(text_x, text_y + 22)
	description.position = Vector2(text_x, text_y + 113)
	launch_button.position = Vector2(text_x, text_y + 160)
	if touch_layout:
		touch.stick_center = Vector2(32 + touch.STICK_RADIUS, total_height - 23 - touch.STICK_RADIUS)
		touch.beam_center = Vector2(width - 32 - touch.BEAM_RADIUS, total_height - 23 - touch.BEAM_RADIUS)
		touch.queue_redraw()
		charge.position = touch.beam_center - Vector2(38, touch.BEAM_RADIUS + 48)
		beam.position = touch.beam_center - beam.size / 2.0
	else:
		charge.position = Vector2(17, header + field_height + 15)
		beam.position = Vector2(width - 165, header + field_height + 10)
		footer.position = cabinet.position + Vector2(0, total_height + 3)


func result(title: String, copy: String, action_text: String, caption_text: String) -> void:
	tag.text = caption_text
	heading.text = title
	description.text = copy
	launch_button.text = action_text + "   ↗"
	panel.show()
	reset_stick()


func set_status(mode: String, elapsed: float, hp: int, points: int, energy: float,
		boss: float, alert: bool, spread: float, beam_busy: bool) -> void:
	score_text.text = "%05d" % points
	clock.text = "%02d:%02d" % [floori(elapsed / 60.0), int(elapsed) % 60]
	for i in range(pips.size()):
		pips[i].bg_color = Color("#f6a0ce") if i < hp else Color("#292640")
		pips[i].border_color = Color("#ee9cc9") if i < hp else Color("#574564")
	phase.text = mode
	boss_card.visible = boss >= 0.0
	boss_fill.size.x = 480.0 * maxf(0.0, boss)
	boss_warning.visible = alert
	warning.text = "警报 · 星环守卫" if alert else ""
	wave_notice.text = "第一波 · 侦察机" if mode == "第一波" and elapsed < 1.65 else ""
	if mode == "第二波" and elapsed < 6.3:
		wave_notice.text = "第二波 · 拦截机"
	weapon.visible = spread > 0.0 and not panel.visible
	weapon.text = "三路射击  %d 秒" % ceili(spread)
	energy_text.text = "%d%%" % int(energy)
	beam.disabled = energy < 100.0 or beam_busy or mode not in ["第一波", "第二波", "Boss 战"]
	if touch_layout:
		touch.update_controls(stick, energy / 100.0, not beam.disabled)
	else:
		energy_fill.size.x = 365.0 * energy / 100.0
		beam.icon = beam_icon_idle if beam.disabled else beam_icon_charged


func show_defense_line(fraction: float, in_danger: bool) -> void:
	defense.visible = fraction >= 0.0
	defense.position.x = field.size.x * maxf(fraction, 0.0)
	defense.modulate = Color("#ffa07e") if in_danger else Color(1, 1, 1, 0.65)


func _input(event: InputEvent) -> void:
	if panel.visible or not touch_layout:
		return
	if event is InputEventScreenTouch:
		var at: Vector2 = event.position - cabinet.position
		if event.pressed and not beam.disabled and at.distance_to(touch.beam_center) <= touch.BEAM_RADIUS:
			beam_pressed.emit()
			get_viewport().set_input_as_handled()
		elif event.pressed and finger < 0 and at.distance_to(touch.stick_center) <= touch.STICK_RADIUS + 10.0:
			finger = event.index
			update_stick(at)
			get_viewport().set_input_as_handled()
		elif not event.pressed and event.index == finger:
			reset_stick()
	elif event is InputEventScreenDrag and event.index == finger:
		update_stick(event.position - cabinet.position)


func update_stick(at: Vector2) -> void:
	stick = ((at - touch.stick_center) / 58.0).limit_length(1.0)


func reset_stick() -> void:
	finger = -1
	stick = Vector2.ZERO


func bind_toggle(button: Button, label: String, changed: Signal) -> void:
	button.toggle_mode = true
	button.set_pressed_no_signal(true)
	button.toggled.connect(func(on: bool) -> void:
		button.text = label + ("开" if on else "关")
		var fill := Color("#192541") if on else Color("#131830")
		var border := Color("#45618b") if on else LINE
		button_style(button, fill, border, ICE if on else Color("#c0cafa"), fill.lightened(0.10), 7)
		changed.emit(on))


func group(parent: Node) -> Control:
	var control := Control.new()
	control.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(control)
	return control


func place(control: Control, bounds: Rect2) -> void:
	control.position = bounds.position
	control.size = bounds.size


func style(fill: Color, border: Color, radius: int) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = fill
	box.border_color = border
	box.set_border_width_all(1)
	box.set_corner_radius_all(radius)
	return box


func plate(fill: Color, border: Color, radius: int, parent: Node) -> Panel:
	var control := Panel.new()
	control.mouse_filter = Control.MOUSE_FILTER_IGNORE
	control.add_theme_stylebox_override("panel", style(fill, border, radius))
	parent.add_child(control)
	return control


func caption(text: String, bounds: Rect2, font_size: int, color: Color, parent: Node) -> Label:
	var label := Label.new()
	label.text = text
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_override("font", UI_FONT)
	label.add_theme_font_size_override("font_size", font_size)
	parent.add_child(label)
	place(label, bounds)
	return label


func action(text: String, bounds: Rect2, font_size: int, parent: Node) -> Button:
	var button := Button.new()
	button.text = text
	button.add_theme_font_override("font", UI_FONT)
	button.add_theme_font_size_override("font_size", font_size)
	button_style(button, Color("#192541"), Color("#45618b"), ICE, Color("#253756"), 7)
	button.add_theme_stylebox_override("focus", style(Color.TRANSPARENT, ICE, 8))
	button.focus_mode = Control.FOCUS_NONE
	parent.add_child(button)
	place(button, bounds)
	return button


func button_style(button: Button, fill: Color, border: Color, text: Color, hover: Color, radius: int) -> void:
	button.add_theme_stylebox_override("normal", style(fill, border, radius))
	button.add_theme_stylebox_override("pressed", style(fill, border, radius))
	button.add_theme_stylebox_override("hover", style(hover, border, radius))
	button.add_theme_stylebox_override("hover_pressed", style(hover, border, radius))
	for state in ["font_color", "font_pressed_color", "font_hover_color", "font_hover_pressed_color"]:
		button.add_theme_color_override(state, text)


func texture(image: Texture2D, parent: Node) -> TextureRect:
	var control := TextureRect.new()
	control.mouse_filter = Control.MOUSE_FILTER_IGNORE
	control.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	control.texture = image
	parent.add_child(control)
	return control


func gradient(colors: Array[Color], stops: PackedFloat32Array, radial := false,
		from := Vector2.ZERO, to := Vector2.RIGHT) -> GradientTexture2D:
	var palette := Gradient.new()
	palette.colors = PackedColorArray(colors)
	palette.offsets = stops
	var ramp := GradientTexture2D.new()
	ramp.gradient = palette
	ramp.width = 256
	ramp.height = 256 if radial else 4
	ramp.fill = GradientTexture2D.FILL_RADIAL if radial else GradientTexture2D.FILL_LINEAR
	ramp.fill_from = from
	ramp.fill_to = to
	return ramp


func meter(bounds: Rect2, start: Color, end: Color, parent: Node) -> TextureRect:
	var bar := plate(Color("#30385e"), Color("#30385e"), 5, parent)
	place(bar, bounds)
	var fill := texture(gradient([start, end], PackedFloat32Array([0, 1])), bar)
	place(fill, Rect2(Vector2.ZERO, bounds.size))
	return fill


func icon(path: String, color: Color, pixels: int, stroked := false) -> ImageTexture:
	var rgb := "#" + color.to_html(false)
	var paint := 'fill="none" stroke="%s" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"' % rgb if stroked else 'fill="%s"' % rgb
	var svg := '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 24 24"><path %s d="%s"/></svg>' % [pixels, pixels, paint, path]
	var image := Image.new()
	image.load_svg_from_string(svg)
	return ImageTexture.create_from_image(image)
