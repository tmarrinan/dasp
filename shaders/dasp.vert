#version 300 es

precision highp float;

#define M_PI 3.1415926535897932384626433832795
#define EPSILON 0.000000001
#define NEAR 0.01
#define FAR 1000.0
#define LEFT -M_PI
#define RIGHT M_PI
#define BOTTOM (-M_PI / 2.0)
#define TOP (M_PI / 2.0)

const mat4 ortho_projection = mat4(
    vec4(2.0 / (RIGHT - LEFT), 0.0, 0.0, 0.0),
    vec4(0.0, 2.0 / (TOP - BOTTOM), 0.0, 0.0),
    vec4(0.0, 0.0, -2.0 / (FAR - NEAR), 0.0),
    vec4(-(RIGHT + LEFT) / (RIGHT - LEFT), -(RIGHT + LEFT) / (TOP - BOTTOM), -(FAR + NEAR) / (FAR - NEAR), 1.0)
);

uniform float ipd;
uniform float eye; // left: -1.0, right: 1.0
uniform vec3 camera_position;
//uniform mat4 view_matrix;
//uniform mat4 projection_matrix;
uniform sampler2D depths;

in vec2 vertex_position;
in vec2 vertex_texcoord;

out vec2 texcoord;

void main() {
    // Calculate 3D vector from eye to point
    float lat = vertex_position.y;
    float lon = vertex_position.x;
    float vertex_depth = texture(depths, vertex_texcoord).r;
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

    // Backproject to new 360 panorama
    vec3 vertex_direction = pt - camera_position;
    float magnitude = length(vertex_direction);
    float longitude = (abs(vertex_direction.z) < EPSILON) ? sign(vertex_direction.x) * -M_PI * 0.5 : -atan(vertex_direction.x, vertex_direction.z);
    float latitude = asin(vertex_direction.y / magnitude);
    gl_Position = ortho_projection * vec4(longitude, latitude, -magnitude, 1.0);

    // Multiply by view and projections matrices
    //gl_Position = projection_matrix * view_matrix * vec4(pt, 1.0);
    
    // Set point size
    gl_PointSize = 1.0;
    
    // Pass along texture coordinate
    texcoord = vertex_texcoord;
}
