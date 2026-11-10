extends Control

var stick := Vector2.ZERO
var charge := 0.0
var ready_to_fire := false
var stick_center := Vector2.ZERO
var beam_center := Vector2.ZERO
const STICK_RADIUS := 100.0
const BEAM_RADIUS := 83.0


func update_controls(axis: Vector2, level: float, ready: bool) -> void:
	if stick == axis and charge == level and ready_to_fire == ready:
		return
	stick = axis
	charge = level
	ready_to_fire = ready
	queue_redraw()


func _draw() -> void:
	var c := stick_center
	draw_circle(c, STICK_RADIUS, Color("#14213de6"), true, -1.0, true)
	draw_circle(c, STICK_RADIUS - 2.0, Color("#96c8ecad"), false, 2.0, true)
	draw_circle(c, STICK_RADIUS * 0.68, Color("#8bbfe677"), false, 2.0, true)
	draw_circle(c, STICK_RADIUS * 0.32, Color("#28466688"), true, -1.0, true)
	var mark := STICK_RADIUS * 0.76
	var tick := Color("#8eb7d464")
	draw_line(c - Vector2(mark, 0), c + Vector2(mark, 0), tick, 1.0, true)
	draw_line(c - Vector2(0, mark), c + Vector2(0, mark), tick, 1.0, true)
	var knob := c + stick * 48.0
	radial(knob, STICK_RADIUS * 0.44, Color("#26496e"), Color("#a8e8f2"), Vector2(-7, -7))
	draw_circle(knob, STICK_RADIUS * 0.44, Color("#b5effa"), false, 2.0, true)
	c = beam_center
	var edge := Color("#174365") if ready_to_fire else Color("#121e37")
	var inner := Color("#347e9e") if ready_to_fire else Color("#283c60")
	radial(c, BEAM_RADIUS, edge, inner)
	draw_circle(c, BEAM_RADIUS - 1.0, Color("#83dded") if ready_to_fire else Color("#6c91bd"), false, 2.0, true)
	draw_circle(c, BEAM_RADIUS - 7.0, Color("#486584"), false, 6.0, true)
	if charge > 0.0:
		draw_arc(c, BEAM_RADIUS - 7.0, -PI / 2.0, TAU * charge - PI / 2.0, 76, Color("#8dfcf4"), 6.0, true)


func radial(center: Vector2, radius: float, edge: Color, inner: Color, shift := Vector2.ZERO) -> void:
	for i in range(18, 0, -1):
		var fraction := i / 18.0
		draw_circle(center + shift * (1.0 - fraction), radius * fraction,
			inner.lerp(edge, smoothstep(0.0, 1.0, fraction)), true, -1.0, true)
