shader_type sky;

void sky() {
	vec3 direction = EYEDIR;
	float key = pow(max(dot(direction, normalize(vec3(-0.34, 0.44, 0.86))), 0.0), 12.0);
	float rim = pow(max(dot(direction, normalize(vec3(0.72, 0.37, 0.59))), 0.0), 23.0);
	float fill = pow(max(dot(direction, normalize(vec3(0.08, -0.61, 0.87))), 0.0), 9.0);
	COLOR = vec3(0.14, 0.17, 0.23) + key * vec3(1.05, 0.92, 0.73)
		+ rim * vec3(0.38, 0.59, 1.02) + fill * vec3(0.43, 0.51, 0.67);
}
