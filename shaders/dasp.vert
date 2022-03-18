#version 300 es

precision highp float;

in vec2 vertex_position;

uniform mat4 view_matrix;
uniform mat4 projection_matrix;

void main() {
    //gl_Position = projection_matrix * view_matrix * vec4(vertex_position, 0.0, 1.0);
    gl_Position = vec4(0.31831 * vertex_position, 0.0, 1.0);
    gl_PointSize = 1.0;
}
