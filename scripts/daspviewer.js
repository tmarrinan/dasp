let canvas;
let gl;
let app = {};
const {mat4, vec3} = glMatrix;

function init() {
    canvas = document.getElementById('render');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl = canvas.getContext('webgl2', {antialias: false});
    if (!gl) {
        alert('Unable to initialize WebGL 2. Your browser may not support it.');
    }
    
    app.glsl_programs = {};
    app.dasp_resolution = {width: 1, height: 1};
    app.points_vertex_array = null;
    app.vertex_position_attrib = 0;
    app.vertex_texcoord_attrib = 1;
    app.vertex_depth_attrib = 2;
    app.view_matrix = mat4.create();
    app.projection_matrix = mat4.create();
    app.previous_time = 0;
    app.frame_count = 0;
    
    // Download and compile shaders into GPU programs
    let dasp_vs = getTextFile('shaders/dasp.vert');
    let dasp_fs = getTextFile('shaders/dasp.frag');
    let texture_vs = getTextFile('shaders/texture.vert');
    let texture_fs = getTextFile('shaders/texture.frag');
    
    Promise.all([dasp_vs, dasp_fs, texture_vs, texture_fs])
    .then((shaders) => {
        let dasp_program = createShaderProgram(shaders[0], shaders[1]);
        let texture_program = createShaderProgram(shaders[2], shaders[3]);
        
        gl.bindAttribLocation(dasp_program, app.vertex_position_attrib, 'vertex_position');
        gl.bindAttribLocation(dasp_program, app.vertex_depth_attrib, 'vertex_depth');
        
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
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    // Enable z-buffer for visible surface determination
    gl.enable(gl.DEPTH_TEST);
    
    // Load DASP image
    initializeDaspTexture('images/bloodflow_sample.jpg');
    
    // Set projection matrix
    mat4.perspective(app.projection_matrix, 60.0 * Math.PI / 180.0, canvas.width / canvas.height, 0.1, 1000.0);
    
    app.previous_time = Date.now();
}

function idle() {
    let now = Date.now();
    elapsed_time = now - app.previous_time;
    
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
    
    if (app.points_vertex_array !== null) {
        gl.useProgram(app.glsl_programs['dasp'].program);
        
        gl.uniformMatrix4fv(app.glsl_programs['dasp'].uniforms.view_matrix, false, app.view_matrix);
        gl.uniformMatrix4fv(app.glsl_programs['dasp'].uniforms.projection_matrix, false, app.projection_matrix);
        
        gl.bindVertexArray(app.points_vertex_array);
        gl.drawElements(gl.POINTS, app.dasp_resolution.width * app.dasp_resolution.height, gl.UNSIGNED_INT, 0);
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
    // Create texture and temporarily fill it with a 1x1 white image
    let texture = gl.createTexture();
    
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    let pixels = new Uint8Array([255, 255, 255, 255]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindTexture(gl.TEXTURE_2D, null);
    
    // Download the actual image
    let img = new Image();
    img.crossOrigin = 'anonymous';
    img.addEventListener('load', (event) => {
        updateDaspTexture(texture, img);
    });
    img.src = address;
    
    return texture;
}

function updateDaspTexture(texture, img_element) {
    // Check if resolution has changed
    if (app.dasp_resolution.width !== img_element.naturalWidth || app.dasp_resolution.height !== img_element.naturalHeight) {
        app.dasp_resolution.width = img_element.naturalWidth;
        app.dasp_resolution.height = img_element.naturalHeight / 2;
        // TODO destroy old one if exists?
        app.points_vertex_array = createPointData();
    }
        
    // Update texture content
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, img_element);
    gl.bindTexture(gl.TEXTURE_2D, null);
    
    // Start render loop - TODO: change this
    idle();
}

function createPointData() {
    let i, j;
    
    // Create a new Vertex Array Object
    let vertex_array = gl.createVertexArray();
    // Set newly created Vertex Array Object as the active one we are modifying
    gl.bindVertexArray(vertex_array);
    
    // Create buffer to store vertex positions (3D points)
    let vertex_position_buffer = gl.createBuffer();
    // Set newly created buffer as the active one we are modifying
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_position_buffer);
    // Create array of 2D vertex values (each set of 3 values specifies a vertex: x, y)
    // and vertex indices (flat 1D array)
    let vertices = [];
    let indices = []
    for (i = 0; i < app.dasp_resolution.height; i++) {
        for (j = 0; j < app.dasp_resolution.width; j++) {
            let lat = Math.PI * ((i / app.dasp_resolution.height) - 0.5);
            let lon = 2 * Math.PI * ((j / app.dasp_resolution.width) - 0.5);
            vertices.push(lon);
            vertices.push(lat);
            indices.push(i * app.dasp_resolution.width + j);
        }
    }
    // Store array of vertex positions in the vertex_position_buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    // Enable vertex_position_attrib in our GPU program
    gl.enableVertexAttribArray(app.vertex_position_attrib);
    // Attach vertex_position_buffer to the position_attrib
    // (as 2-component floating point values)
    gl.vertexAttribPointer(app.vertex_position_attrib, 2, gl.FLOAT, false, 0, 0);
    
    // Create buffer to store Indices of each point
    let vertex_index_buffer = gl.createBuffer();
    // Set newly created buffer as the active one we are modifying
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertex_index_buffer);
    // Store array of vertex indices in the vertex_index_buffer
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);
    
    // No longer modifying our Vertex Array Object, so deselect
    gl.bindVertexArray(null);
    
    return vertex_array;
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
                resolve(req.response);
            }
            else if (req.readyState === 4) {
                reject({url: req.responseURL, status: req.status});
            }
        };
        req.open('GET', address, true);
        req.send();
    });
}
