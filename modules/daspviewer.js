import {OpenExrReader} from './openexrreader.mjs';
const {mat4, vec3} = glMatrix;

let canvas;
let gl;
let app = {};


function init() {
    canvas = document.getElementById('render');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl = canvas.getContext('webgl2');//, {antialias: false});
    if (!gl) {
        alert('Unable to initialize WebGL 2. Your browser may not support it.');
    }
    
    app.glsl_programs = {};
    app.dasp_resolution = {width: 1, height: 1};
    app.points_vertex_array = {left: null, right: null};
    app.vertex_position_attrib = 0;
    app.vertex_texcoord_attrib = 1;
    app.camera_position = vec3.create();
    app.view_matrix = mat4.create();
    app.projection_matrix = mat4.create();
    app.dasp_textures = {left: {color: null, depth: null}, right: {color: null, depth: null}};
    app.previous_time = 0;
    app.frame_count = 0;
    
    // Download and compile shaders into GPU programs
    let dasp_vs = getTextFile('shaders/dasp.vert');
    let dasp_fs = getTextFile('shaders/dasp.frag');
    let texture_vs = getTextFile('shaders/texture.vert');
    let texture_fs = getTextFile('shaders/texture.frag');
    
    
    // TEST CODE for unzipping depth files
    //getDepthZip('images/Depth0001_L.exr').then((data) => {
    //    console.log(new Uint8Array(data));
    //}).catch((error) => {
    //    console.log('Error getDepthZip():', error);
    //});
    
    
    Promise.all([dasp_vs, dasp_fs, texture_vs, texture_fs])
    .then((shaders) => {
        let dasp_program = createShaderProgram(shaders[0], shaders[1]);
        let texture_program = createShaderProgram(shaders[2], shaders[3]);
        
        gl.bindAttribLocation(dasp_program, app.vertex_position_attrib, 'vertex_position');
        gl.bindAttribLocation(dasp_program, app.vertex_texcoord_attrib, 'vertex_texcoord');
        
        gl.bindAttribLocation(texture_program, app.vertex_position_attrib, 'vertex_position');
        gl.bindAttribLocation(texture_program, app.vertex_texcoord_attrib, 'vertex_texcoord');
        
        linkShaderProgram(dasp_program);
        linkShaderProgram(texture_program);
        
        let dasp_uniforms = getShaderProgramUniforms(dasp_program);
        let texture_uniforms = getShaderProgramUniforms(texture_program);
        
        app.glsl_programs['dasp'] = {program: dasp_program, uniforms: dasp_uniforms};
        app.glsl_programs['texture'] = {program: texture_program, uniforms: texture_uniforms};
        
        console.log('GL Errors:', gl.getError());
        
        initializeGlApp();
        render();
    })
    .catch((error) => {
        console.log('Error:', error);
    });
        
    window.addEventListener('resize', onResize);
    
}

function initializeGlApp() {
    // Set drawing area to be the entire framebuffer
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    // Set the background color to black
    //gl.clearColor(0.533, 0.745, 0.922, 1.0);  // rgb(136, 190, 235)
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    // Enable z-buffer for visible surface determination
    gl.enable(gl.DEPTH_TEST);
    
    // Load DASP image
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    initializeDaspTexture('images/example_dasp_2k_zip.exr');
    
    // Set camera position
    vec3.set(app.camera_position, 0.0, 0.0, 0.0);
    
    // Set view and projection matrix
    mat4.lookAt(app.view_matrix, app.camera_position, vec3.fromValues(-10.0, -0.8, 3.0), vec3.fromValues(0.0, 1.0, 0.0));
    mat4.perspective(app.projection_matrix, 60.0 * Math.PI / 180.0, canvas.width / canvas.height, 0.1, 1000.0);
    
    app.previous_time = Date.now();
}

function idle() {
    let now = Date.now();
    let elapsed_time = now - app.previous_time;
    
    if (elapsed_time >= 2000) {
        console.log('FPS:', 1000.0 *  app.frame_count / elapsed_time);
        app.previous_time = now;
        app.frame_count = 0;
    }

    render();
    app.frame_count += 1;

    //requestAnimationFrame(idle);
}

function render() {
    // Delete previous frame (reset both framebuffer and z-buffer)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    if (app.points_vertex_array.left !== null) {
        gl.useProgram(app.glsl_programs['dasp'].program);
        
        gl.uniform1f(app.glsl_programs['dasp'].uniforms.ipd, 0.315);
        gl.uniform3fv(app.glsl_programs['dasp'].uniforms.camera_position, app.camera_position);
        //gl.uniformMatrix4fv(app.glsl_programs['dasp'].uniforms.view_matrix, false, app.view_matrix);
        //gl.uniformMatrix4fv(app.glsl_programs['dasp'].uniforms.projection_matrix, false, app.projection_matrix);
        
        // Left eye
        gl.uniform1f(app.glsl_programs['dasp'].uniforms.eye, -1.0);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, app.dasp_textures.left.color);
        gl.uniform1i(app.glsl_programs['dasp'].uniforms.image, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, app.dasp_textures.left.depth);
        gl.uniform1i(app.glsl_programs['dasp'].uniforms.depths, 1);
        
        gl.bindVertexArray(app.points_vertex_array.left.vertex_array);
        gl.drawElements(gl.POINTS, app.points_vertex_array.left.num_points, gl.UNSIGNED_INT, 0);
        //gl.drawElements(gl.TRIANGLE_STRIP, app.points_vertex_array.left.num_points, gl.UNSIGNED_INT, 0);
        gl.bindVertexArray(null);
        
        // Right eye
        gl.uniform1f(app.glsl_programs['dasp'].uniforms.eye, 1.0);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, app.dasp_textures.right.color);
        gl.uniform1i(app.glsl_programs['dasp'].uniforms.image, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, app.dasp_textures.right.depth);
        gl.uniform1i(app.glsl_programs['dasp'].uniforms.depths, 1);
        
        gl.bindVertexArray(app.points_vertex_array.right.vertex_array);
        gl.drawElements(gl.POINTS, app.points_vertex_array.right.num_points, gl.UNSIGNED_INT, 0);
        //gl.drawElements(gl.TRIANGLE_STRIP, app.points_vertex_array.right.num_points, gl.UNSIGNED_INT, 0);
        gl.bindVertexArray(null);
        
        gl.useProgram(null);
    }
}

function createShaderProgram(vert_source, frag_source) {
    // Compile vetex shader
    let vertex_shader = compileShader(vert_source, gl.VERTEX_SHADER);
    // Compile fragment shader
    let fragment_shader = compileShader(frag_source, gl.FRAGMENT_SHADER);
    
    // Create GPU program from the compiled vertex and fragment shaders
    let shaders = [vertex_shader, fragment_shader];
    let program = attachShaders(shaders);
    
    return program;
}

function compileShader(source, type) {
    // Create a shader object
    let shader = gl.createShader(type);

    // Send the source to the shader object
    gl.shaderSource(shader, source);

    // Compile the shader program
    gl.compileShader(shader);

    // Check to see if it compiled successfully
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.log(source);
        alert("An error occurred compiling the shader: " + gl.getShaderInfoLog(shader));
    }

    return shader;
}

function attachShaders(shaders) {
    // Create a GPU program
    let program = gl.createProgram();

    // Attach all shaders to that program
    let i;
    for (i = 0; i < shaders.length; i++) {
        gl.attachShader(program, shaders[i]);
    }

    return program;
}

function linkShaderProgram(program) {
    // Link GPU program
    gl.linkProgram(program);

    // Check to see if it linked successfully
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        alert("An error occurred linking the shader program.");
    }
}

function getShaderProgramUniforms(program) {
    // Get handles to uniform variables defined in the shaders
    let num_uniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    let uniforms = {};
    let i;
    for (i = 0; i < num_uniforms; i++) {
        let info = gl.getActiveUniform(program, i);
        uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }
    
    return uniforms;
}

function initializeDaspTexture(address) {
    let pixels = new Uint8Array([255, 255, 255, 255]);
    let depths = new Float32Array([10000000000.0]);
    
    // check for linear interpolation of float texture support
    let float_linear = gl.getExtension('OES_texture_float_linear');
    let float_tex_filter = (float_linear === null) ? gl.NEAREST : gl.LINEAR;
    let ubyte_tex_filter = gl.LINEAR;
    
    // Create color texture and temporarily fill it with a 1x1 white image
    app.dasp_textures.left.color = gl.createTexture();
    
    gl.bindTexture(gl.TEXTURE_2D, app.dasp_textures.left.color);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, ubyte_tex_filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, ubyte_tex_filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    
    // Create depth texture and temporarily fill it with a 1x1 far distance value
    app.dasp_textures.left.depth = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, app.dasp_textures.left.depth);
    if (float_linear)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, float_tex_filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, float_tex_filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 1, 1, 0, gl.RED, gl.FLOAT, depths);
    
    // Create color texture and temporarily fill it with a 1x1 white image
    app.dasp_textures.right.color = gl.createTexture();
    
    gl.bindTexture(gl.TEXTURE_2D, app.dasp_textures.right.color);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, ubyte_tex_filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, ubyte_tex_filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    
    // Create depth texture and temporarily fill it with a 1x1 far distance value
    app.dasp_textures.right.depth = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, app.dasp_textures.right.depth);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, float_tex_filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, float_tex_filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 1, 1, 0, gl.RED, gl.FLOAT, depths);
    
    gl.bindTexture(gl.TEXTURE_2D, null);
    
    // Download the actual image
    getDepthExr(address).then(updateDaspTexture).catch((error) => {
        console.log('Error getDepthExr():', error);
    });
}

function updateDaspTexture(exr) {
    console.log(exr);
    // TODO: recreate (and delete old) only if width / height has changed
    app.dasp_resolution.width = exr.width;
    app.dasp_resolution.height = exr.height;
    
    // Update texture content - left eye
    app.points_vertex_array.left = createPointData(exr.image_buffers['Depth.left.V'].buffer, 0.1);
    let options_left = {
        red_buffer: 'Image.left.R',
        green_buffer: 'Image.left.G',
        blue_buffer: 'Image.left.B',
        alpha_buffer: 'Image.left.A',
        gamma_correct: true
    }
    let pixels_left = exr.generateRgbaUint8Buffer(options_left);
    
    gl.bindTexture(gl.TEXTURE_2D, app.dasp_textures.left.color);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, app.dasp_resolution.width, app.dasp_resolution.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels_left);
    
    gl.bindTexture(gl.TEXTURE_2D, app.dasp_textures.left.depth);
    if (exr.image_buffers['Depth.left.V'].type === 'half') {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, app.dasp_resolution.width, app.dasp_resolution.height, 0, gl.RED, gl.HALF_FLOAT, new Uint16Array(exr.image_buffers['Depth.left.V'].buffer.buffer));
    }
    else { // 'float'
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, app.dasp_resolution.width, app.dasp_resolution.height, 0, gl.RED, gl.FLOAT, exr.image_buffers['Depth.left.V'].buffer);
    }
    
    // Update texture content - right eye
    app.points_vertex_array.right = createPointData(exr.image_buffers['Depth.right.V'].buffer, 0.1);
    let options_right = {
        red_buffer: 'Image.right.R',
        green_buffer: 'Image.right.G',
        blue_buffer: 'Image.right.B',
        alpha_buffer: 'Image.right.A',
        gamma_correct: true
    }
    let pixels_right = exr.generateRgbaUint8Buffer(options_right);
    
    gl.bindTexture(gl.TEXTURE_2D, app.dasp_textures.right.color);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, app.dasp_resolution.width, app.dasp_resolution.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels_right);
    
    gl.bindTexture(gl.TEXTURE_2D, app.dasp_textures.right.depth);
    if (exr.image_buffers['Depth.right.V'].type === 'half') {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, app.dasp_resolution.width, app.dasp_resolution.height, 0, gl.RED, gl.HALF_FLOAT, new Uint16Array(exr.image_buffers['Depth.right.V'].buffer.buffer));
    }
    else { // 'float'
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, app.dasp_resolution.width, app.dasp_resolution.height, 0, gl.RED, gl.FLOAT, exr.image_buffers['Depth.right.V'].buffer);
    }
    
    gl.bindTexture(gl.TEXTURE_2D, null);
    
    // Start render loop - TODO: change this
    idle();
}

function createPointData(depth_data, delta_depth_threshold) {
    let i, j;
    const PRIMITIVE_RESTART = 4294967295;
    
    // Create a new Vertex Array Object
    let vertex_array = gl.createVertexArray();
    // Set newly created Vertex Array Object as the active one we are modifying
    gl.bindVertexArray(vertex_array);
    
    // Create buffer to store vertex positions (2D lat/lon points)
    let vertex_position_buffer = gl.createBuffer();
    // Set newly created buffer as the active one we are modifying
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_position_buffer);
    // Create array of 2D vertex values (each set of 2 values specifies a vertex: x, y),
    // texcoords (normalized coords), and vertex indices (flat 1D array)
    let width = app.dasp_resolution.width;
    let height = app.dasp_resolution.height;
    let vertices = new Float32Array(2 * width * height);
    let texcoords = new Float32Array(2 * width * height);
    let indices = new Uint32Array(width * height);
    //let indices = new Uint32Array((3 * width * (height - 1)) + (3 * (height - 1)));
    let face_idx = 0;
    for (i = 0; i < height; i++) {
        for (j = 0; j < width; j++) {
            let idx = i * width + j;
            let inclination = Math.PI * (1.0 - ((i + 0.5) / height));
            let azimuth = 2 * Math.PI * ((j + 0.5) / width);
            //let lat = Math.PI * (((i + 0.5) / height) - 0.5);
            //let lon = 2 * Math.PI * (((j + 0.5) / width) - 0.5);
            vertices[2 * idx + 0] = azimuth;
            vertices[2 * idx + 1] = inclination;
            texcoords[2 * idx + 0] = (j + 0.5) / width;
            texcoords[2 * idx + 1] = (i + 0.5) / height;
            // points
            indices[idx] = idx;
            // triangle strip mesh
            /*
            if (i < height - 1) {
                indices[face_idx] = i * width + j;
                face_idx++;
                indices[face_idx] = (i + 1) * width + j;
                face_idx++;
                
                let depth_1 = depth_data[(height - i - 1) * width + j];
                let depth_2 = depth_data[(height - i - 1) * width + ((j + 1) % width)];
                //console.log(depth_1, depth_2);
                if (Math.abs(depth_1 - depth_2) > delta_depth_threshold) {
                    indices[face_idx] = PRIMITIVE_RESTART;
                    face_idx++;
                }
                
            }
            */
        }
        /*
        if (i < height - 1) {
            indices[face_idx] = i * width;
            face_idx++;
            indices[face_idx] = (i + 1) * width;
            face_idx++;
            indices[face_idx] = PRIMITIVE_RESTART;
            face_idx++;
        }
        */
    }
    //indices = indices.subarray(0, face_idx);
    
    // Store array of vertex positions in the vertex_position_buffer
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    // Enable vertex_position_attrib in our GPU program
    gl.enableVertexAttribArray(app.vertex_position_attrib);
    // Attach vertex_position_buffer to the position_attrib
    // (as 2-component floating point values)
    gl.vertexAttribPointer(app.vertex_position_attrib, 2, gl.FLOAT, false, 0, 0);
    
    // Create buffer to store vertex texcoords
    let vertex_texcoord_buffer = gl.createBuffer();
    // Set newly created buffer as the active one we are modifying
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_texcoord_buffer);
    // Store array of vertex texcoords in the vertex_texcoord_buffer
    gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.STATIC_DRAW);
    // Enable vertex_texcoord_attrib in our GPU program
    gl.enableVertexAttribArray(app.vertex_texcoord_attrib);
    // Attach vertex_texcoord_buffer to the texcoord_attrib
    // (as 2-component floating point values)
    gl.vertexAttribPointer(app.vertex_texcoord_attrib, 2, gl.FLOAT, false, 0, 0);
    
    // Create buffer to store Indices of each point
    let vertex_index_buffer = gl.createBuffer();
    // Set newly created buffer as the active one we are modifying
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertex_index_buffer);
    // Store array of vertex indices in the vertex_index_buffer
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    
    // No longer modifying our Vertex Array Object, so deselect
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    
    return {vertex_array: vertex_array, num_points: indices.length};
}

function onResize() {
    // Update WebGL canvas and viewport sizes to match new window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    
    // Set projection matrix
    mat4.perspective(app.projection_matrix, 60.0 * Math.PI / 180.0, canvas.width / canvas.height, 0.1, 1000.0);
}

function getTextFile(address) {
    return new Promise((resolve, reject) => {
        let req = new XMLHttpRequest();
        req.onreadystatechange = () => {
            if (req.readyState === 4 && req.status === 200) {
                resolve(req.responseText);
            }
            else if (req.readyState === 4) {
                reject({url: req.responseURL, status: req.status});
            }
        };
        req.open('GET', address, true);
        req.send();
    });
}

function getBinaryFile(address) {
    return new Promise((resolve, reject) => {
        let req = new XMLHttpRequest();
        req.onreadystatechange = () => {
            if (req.readyState === 4 && req.status === 200) {
                resolve(req.response);
            }
            else if (req.readyState === 4) {
                reject({url: req.responseURL, status: req.status});
            }
        };
        req.open('GET', address, true);
        req.responseType = 'arraybuffer';
        req.send();
    });
}

function getDepthExr(address) {
    return new Promise((resolve, reject) => {
        getBinaryFile(address).then((data) => {
            let exr_reader = new OpenExrReader(data);
            resolve(exr_reader);
        }).catch((error) => {
            reject(error);
        });
    });
}

function getDepthZip(address) {
    return new Promise((resolve, reject) => {
        getBinaryFile(address).then((data) => {
            JSZip.loadAsync(data).then((content) => {
                let depth_file = Object.entries(content.files).filter((file_name) => {
                   return file_name[0].endsWith('.depth');
                });
                content.file(depth_file[0][0]).async('arraybuffer').then((buffer) => {
                    resolve(buffer);
                }).catch((error) => {
                    reject(error);
                });
            });
        }).catch((error) => {
            reject(error);
        });
    });
}

window.init = init;
