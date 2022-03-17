let canvas;
let gl;
let app = {};

function init() {
    canvas = document.getElementById('render');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl = canvas.getContext('webgl2');
    if (!gl) {
        alert('Unable to initialize WebGL 2. Your browser may not support it.');
    }
    
    app.glsl_programs = {};
    app.vertex_position_attrib = 0;
    app.vertex_texcoord_attrib = 1;
    
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
}

function render() {
    // Delete previous frame (reset both framebuffer and z-buffer)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
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

function onResize() {
    // Update WebGL canvas and viewport sizes to match new window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
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
