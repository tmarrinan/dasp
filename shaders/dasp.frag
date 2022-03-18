#version 300 es

precision mediump float;

uniform sampler2D image;

in vec2 texcoord;

out vec4 FragColor;

void main() {
    FragColor = texture(image, texcoord);
}
