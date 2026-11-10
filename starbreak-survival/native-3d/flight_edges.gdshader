shader_type canvas_item;
render_mode unshaded;

uniform float field_inset = 0.0;
uniform float fade_width = 0.05;
uniform float cover_scale = 1.0;

void fragment() {
	float distance_to_edge = min(UV.x, 1.0 - UV.x);
	float opacity = 1.0 - smoothstep(field_inset, field_inset + fade_width, distance_to_edge);
	if (opacity <= 0.0) {
		discard;
	}
	vec2 uv = vec2(UV.x, 0.5 + (UV.y - 0.5) * cover_scale);
	vec2 blur = vec2(0.009, 0.015);
	vec3 color = texture(TEXTURE, uv).rgb * 4.0;
	color += 2.0 * (texture(TEXTURE, uv + vec2(blur.x, 0.0)).rgb + texture(TEXTURE, uv - vec2(blur.x, 0.0)).rgb);
	color += 2.0 * (texture(TEXTURE, uv + vec2(0.0, blur.y)).rgb + texture(TEXTURE, uv - vec2(0.0, blur.y)).rgb);
	color += texture(TEXTURE, uv + blur).rgb + texture(TEXTURE, uv - blur).rgb;
	color += texture(TEXTURE, uv + vec2(blur.x, -blur.y)).rgb + texture(TEXTURE, uv + vec2(-blur.x, blur.y)).rgb;
	COLOR = vec4(mix(vec3(0.063, 0.086, 0.169), color / 16.0, 0.48), opacity);
}
