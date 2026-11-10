extends Control

const SKY = preload("res://assets/background.webp")
const FIELD := Vector2(960.0, 540.0)

var flight_time := 0.0
var offset := Vector2.ZERO


func advance(dt: float, target: Vector2) -> void:
	flight_time += dt
	offset = offset.lerp(target, 1.0 - exp(-dt * 4.0))
	queue_redraw()


func _draw() -> void:
	draw_set_transform(Vector2.ZERO, 0.0, size / FIELD)
	var overscan := FIELD * 0.036
	draw_texture_rect(SKY, Rect2(offset - overscan / 2.0, FIELD + overscan), false)
	for i in range(72):
		var speed := 14.0 + (i % 4) * 24.0
		var x := fposmod((i * 269 + i * i * 13) % 960 - flight_time * speed + offset.x * 1.5, FIELD.x)
		var y := (i * 131 + i * i * 19) % 540 + offset.y * (1.7 if speed > 60.0 else 1.1)
		var big := i % 17 == 0
		var width := 2.0 if big else (1.5 if i % 3 == 0 else 1.0)
		var tint := Color("#e1faff") if big else Color("#a6b1f1")
		tint.a = 0.19 + (i * 7 % 17) / 33.0
		draw_rect(Rect2(x, y, width * (2.7 if speed > 60.0 else 1.2), width), tint)
		if big:
			draw_rect(Rect2(x + 2.0, y - 2.0, 1.0, 6.0), tint)
