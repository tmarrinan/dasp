#version 300 es

precision highp float;

#define M_PI 3.1415926535897932384626433832795
#define EPSILON 0.000001
#define NEAR 0.01
#define FAR 1000.0
//#define LEFT -M_PI
//#define RIGHT M_PI
//#define BOTTOM (-M_PI / 2.0)
//#define TOP (M_PI / 2.0)
#define LEFT 0.0
#define RIGHT (2.0 * M_PI)
#define BOTTOM M_PI
#define TOP 0.0

const mat4 ortho_projection = mat4(
    vec4(2.0 / (RIGHT - LEFT), 0.0, 0.0, 0.0),
    vec4(0.0, 2.0 / (TOP - BOTTOM), 0.0, 0.0),
    vec4(0.0, 0.0, -2.0 / (FAR - NEAR), 0.0),
    vec4(-(RIGHT + LEFT) / (RIGHT - LEFT), -(TOP + BOTTOM) / (TOP - BOTTOM), -(FAR + NEAR) / (FAR - NEAR), 1.0)
);

uniform float ipd;
uniform float eye; // left: -1.0, right: 1.0
uniform vec3 camera_position;
uniform sampler2D depths;

in vec2 vertex_position;
in vec2 vertex_texcoord;

out vec2 texcoord;

void main() {
    // Calculate 3D vector from eye to point
    float azimuth = vertex_position.x;
    float inclination = vertex_position.y;
    float vertex_depth = texture(depths, vertex_texcoord).r;
    vec3 pt_dir = vec3(vertex_depth * cos(azimuth) * sin(inclination),
                       vertex_depth * sin(azimuth) * sin(inclination),
                       vertex_depth * cos(inclination));

    // Calculate 3D vector from eye to point
    float eye_radius = 0.5 * ipd;
    float eye_azimuth = azimuth + (eye * 0.5 * M_PI);
    vec3 eye_dir = vec3(eye_radius * cos(eye_azimuth),
                        eye_radius * sin(eye_azimuth),
                        0);
    
    // Calculate 3D position of point
    vec3 pt = eye_dir + pt_dir;
    
    // Backproject to new 360 panorama
    vec3 cam = vec3(camera_position.z, -camera_position.x, camera_position.y);
    vec3 vertex_direction = pt - cam;
    float magnitude = length(vertex_direction);
    float theta = acos(vertex_direction.z / magnitude);
    float phi = ((abs(vertex_direction.x) < EPSILON) ? sign(vertex_direction.y) * M_PI * 0.5 : atan(-vertex_direction.y, -vertex_direction.x)) + M_PI;
    gl_Position = ortho_projection * vec4(phi, theta, -magnitude, 1.0);
    
    // Set point size
    gl_PointSize = 1.0;
    
    // Pass along texture coordinate
    texcoord = vertex_texcoord;
}
