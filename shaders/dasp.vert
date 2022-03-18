#version 300 es

precision highp float;

#define M_PI 3.1415926535897932384626433832795

uniform float ipd;
uniform float eye; // left: 1.0, right: -1.0
uniform mat4 view_matrix;
uniform mat4 projection_matrix;

in vec2 vertex_position;
in float vertex_depth;
in vec2 vertex_texcoord;

out vec2 texcoord;

void main() {
    // Calculate 3D vector from eye to point
    float lat = vertex_position.y;
    float lon = vertex_position.x;
    vec3 pt_dir = vec3(-vertex_depth * cos(lat) * sin(lon),
                    vertex_depth * sin(lat),
                   -vertex_depth * cos(lat) * cos(lon));
    
    // Calculate 3D vector from camera location (center of two eyes) to eye
    float eye_radius = ipd / 2.0;
    float eye_theta = lon + eye * 0.5 * M_PI;
    vec3 eye_dir = vec3(-eye_radius * sin(eye_theta),
                     0,
                    -eye_radius * cos(eye_theta));
    
    // Calculate 3D position of point
    vec3 pt = eye_dir + pt_dir;

    // Multiply by view and projections matrices
    gl_Position = projection_matrix * view_matrix * vec4(pt, 1.0);
    //gl_Position = vec4(0.3 * vertex_position, 0.0, 1.0);
    gl_PointSize = 1.0;
    texcoord = vertex_texcoord;
}
