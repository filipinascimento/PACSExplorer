shader_tex_lut_frag = "\
	precision highp float;      \
    uniform sampler2D input_tex;\
    uniform sampler2D lut_tex;  \
    varying vec2 tex_coord;     \
    void main(){   \
        float val = texture2D( input_tex, tex_coord ).r;\
		vec4 color = texture2D( lut_tex, vec2(val, 0.5) );\
        gl_FragColor = color.rgba;\
    }\
"

shader_tex_lut_vert = "\
    attribute vec2 vertex;   \
    attribute vec2 texCoord; \
    uniform mat4 uMVMatrix;  \
    uniform mat4 uPMatrix;   \
    varying vec2 tex_coord;  \
    void main(){\
        tex_coord = texCoord; \
        gl_Position = uPMatrix * uMVMatrix * vec4( vertex, 0.0, 1.0 ); \
    }\
"
shader_fs = "\
	precision highp float;   \
    varying vec2 quad_coord; \
	uniform float kernel_weight; \
    void main(void) { \
        float len = length( quad_coord ); \
		float nrm = kernel_weight * 0.3989422804014327 * exp( -0.5*25.0*len*len ); \
		gl_FragColor = vec4(nrm,nrm,nrm, nrm );	 \
    }\
"
shader_vs = ' \
  attribute vec3 aVertexPosition; \
  uniform mat4 uMVMatrix; \
  uniform mat4 uPMatrix; \
  uniform float bandwidthScale; \
  uniform vec2 bandwidth; \
  varying vec2 quad_coord; \
  void main(void) { \
    vec2 pos = aVertexPosition.xy; \
    float index = aVertexPosition.z; \
    if ( index < 0.1 ) \
        quad_coord = vec2(-1.0, -1.0); \
    else if ( index < 1.1 ) \
        quad_coord = vec2( 1.0, -1.0); \
    else if ( index < 2.1 ) \
        quad_coord = vec2( 1.0, 1.0); \
    else \
        quad_coord = vec2( -1.0, 1.0); \
    pos += bandwidthScale * bandwidth * quad_coord; \
    gl_Position = uPMatrix * uMVMatrix * vec4( pos, 0.0, 1.0); \
  } \
'

function log_it(what) {
	console.log(what);
	// var ld = $('#log_div').get(0);
	// if (ld) {
	// 	var li = document.createElement('li');
	// 	li.innerHTML = what;
	// 	ld.appendChild(li);
	// }
}

function getShader(gl, code, type) {
	/*
	var shaderScript = document.getElementById(id);
    if (!shaderScript) {
      console.log( "404 on " + id );
      return null;
    }
    var str = "";
    var k = shaderScript.firstChild;
    while (k) {
      if (k.nodeType == 3) {
        str += k.textContent;
      }
      k = k.nextSibling;
    }
    var shader;
    if (shaderScript.type == "x-shader/x-fragment") {
      shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex") {
      shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
      return null;
    }
	*/
	var shader = gl.createShader(type);
	//gl.shaderSource(shader, str);
	gl.shaderSource(shader, code);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.log(gl.getShaderInfoLog(shader));
		return null;
	}
	return shader;
}

function createShader(gl) {
	//var fragmentShader = getShader(gl, "shader-fs");
	//var vertexShader =   getShader(gl,   "shader-vs");
	var fragmentShader = getShader(gl, shader_fs, gl.FRAGMENT_SHADER);
	var vertexShader = getShader(gl, shader_vs, gl.VERTEX_SHADER);

	var program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		alert("Could not initialise shaders");
	}
	gl.useProgram(program);
	program.vertexPositionAttribute = gl.getAttribLocation(program, "aVertexPosition");

	program.pMatrixUniform = gl.getUniformLocation(program, "uPMatrix");
	program.mvMatrixUniform = gl.getUniformLocation(program, "uMVMatrix");
	program.bandwidthUniform = gl.getUniformLocation(program, "bandwidth");
	program.bandwidthScaleUniform = gl.getUniformLocation(program, "bandwidthScale");
	program.kernel_weightUniform = gl.getUniformLocation(program, "kernel_weight");

	return program;
}

function createShader2Dlut(gl) {
	//    var frags = getShader(gl, "shader-tex-lut-frag");
	//    var verts = getShader(gl, "shader-tex-lut-vert");
	var frags = getShader(gl, shader_tex_lut_frag, gl.FRAGMENT_SHADER);
	var verts = getShader(gl, shader_tex_lut_vert, gl.VERTEX_SHADER);

	var program = gl.createProgram();
	gl.attachShader(program, verts);
	gl.attachShader(program, frags);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		alert("Could not initialise shaders");
	}
	gl.useProgram(program);
	program.vertexAttribute = gl.getAttribLocation(program, "vertex");
	program.texCoordAttribute = gl.getAttribLocation(program, "texCoord");
	//gl.enableVertexAttribArray(program.vertexAttribute);
	//gl.enableVertexAttribArray(program.texCoordAttribute);

	program.pMatrixUniform = gl.getUniformLocation(program, "uPMatrix");
	program.mvMatrixUniform = gl.getUniformLocation(program, "uMVMatrix");
	program.input_texUniform = gl.getUniformLocation(program, "input_tex");
	program.lut_texUniform = gl.getUniformLocation(program, "lut_tex");
	return program;
}


////////////////////////////////////////////////////////////////////
/////// KDE ////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////
function KDE(canvas) {
	this.gl = null;
	this.BUFFER_LIST = [];
	this.FBO;
	this.lutShader;
	this.shaderProgram;
	this.mvMatrix;
	this.pMatrix;

	this.webgl_canvas = canvas;
	this.WIDTH = parseInt(canvas.width);
	this.HEIGHT = parseInt(canvas.height);
	this.bandwidth = [20.0, 20.0];
	this.bandwidthScale = 5.0;
	this.kernel_weight = 0.5;
	this.triangleVertexPositionBuffer;
	this.squareVertexPositionBuffer;

	this.PANEL_TEX_COORDS = [0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0];
	this.PANEL_TEX_POS = [0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0];
	this.QUAD_POS_BUFFER;
	this.QUAD_COORD_BUFFER;
	this.LUT_TEX;

	// DATASET Related:
	this.DATA = null;

	this.initGL(this.webgl_canvas);
	this.FBO = this.create_FBO();

	this.shaderProgram = createShader(this.gl);
	this.lutShader = createShader2Dlut(this.gl);
	this.initBuffers();

	this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
	this.gl.clearDepth(1.0)
	this.gl.disable(this.gl.DEPTH_TEST);

	self = this;

	this.setColormap();
}
KDE.prototype.initGL = function(canvas) {
	var context_name = "experimental-webgl"
	try {
		attributes = {
			antialias: false,
			alpha: false
		};
		this.gl = canvas.getContext(context_name, attributes);
	} catch (e) {}
	if (!this.gl) {
		log_it('[FAIL] No "' + context_name + '" available');
	}
}

KDE.prototype.loadIdentity = function() {
	this.mvMatrix = Matrix.I(4);
}
KDE.prototype.multMatrix = function(m) {
	this.mvMatrix = this.mvMatrix.x(m);
}
KDE.prototype.mvScale = function(s) {
	this.mvMatrix.elements[0][0] *= s[0];
	this.mvMatrix.elements[0][1] *= s[0];
	this.mvMatrix.elements[0][2] *= s[0];
	this.mvMatrix.elements[0][3] *= s[0];

	this.mvMatrix.elements[1][0] *= s[1];
	this.mvMatrix.elements[1][1] *= s[1];
	this.mvMatrix.elements[1][2] *= s[1];
	this.mvMatrix.elements[1][3] *= s[1];

	this.mvMatrix.elements[2][0] *= s[2];
	this.mvMatrix.elements[2][1] *= s[2];
	this.mvMatrix.elements[2][2] *= s[2];
	this.mvMatrix.elements[2][3] *= s[2];
}
KDE.prototype.mvTranslate = function(v) {
	var m = Matrix.Translation($V([v[0], v[1], v[2]])).ensure4x4();
	this.multMatrix(m);
}
KDE.prototype.perspective = function(fovy, aspect, znear, zfar) {
	this.pMatrix = makePerspective(fovy, aspect, znear, zfar);
}
KDE.prototype.ortho = function(xmin, xmax, ymin, ymax) {
	this.pMatrix = makeOrtho(xmin, xmax, ymin, ymax, -1, 1);
}
KDE.prototype.setMatrixUniforms = function(program) {
	this.gl.uniformMatrix4fv(program.pMatrixUniform, false, new Float32Array(this.pMatrix.flatten()));
	this.gl.uniformMatrix4fv(program.mvMatrixUniform, false, new Float32Array(this.mvMatrix.flatten()));
}
KDE.prototype.initBuffers = function() {
	gl = this.gl;
	this.triangleVertexPositionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, this.triangleVertexPositionBuffer);
	var vertices = [
		0.0, 1.0, 0.0, -1.0, -1.0, 0.0,
		1.0, -1.0, 0.0
	];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	this.triangleVertexPositionBuffer.itemSize = 3;
	this.triangleVertexPositionBuffer.numItems = 3;

	this.squareVertexPositionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, this.squareVertexPositionBuffer);
	vertices = [
		1.0, 1.0, 0.0, -1.0, 1.0, 0.0,
		1.0, -1.0, 0.0, -1.0, -1.0, 0.0
	];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	this.squareVertexPositionBuffer.itemSize = 3;
	this.squareVertexPositionBuffer.numItems = 4;

	this.QUAD_POS_BUFFER = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, this.QUAD_POS_BUFFER);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.PANEL_TEX_POS), gl.STATIC_DRAW);
	this.QUAD_POS_BUFFER.itemSize = 2;
	this.QUAD_POS_BUFFER.numItems = 6;

	this.QUAD_COORD_BUFFER = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, this.QUAD_COORD_BUFFER);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.PANEL_TEX_COORDS), gl.STATIC_DRAW);
	this.QUAD_COORD_BUFFER.itemSize = 2;
	this.QUAD_COORD_BUFFER.numItems = 6;
}


KDE.prototype.drawScene = function() {
	w = this.WIDTH;
	h = this.HEIGHT;
	gl = this.gl;

	this.ortho(0, w, h, 0);
	this.loadIdentity();


	gl.bindFramebuffer(gl.FRAMEBUFFER, this.FBO.id);
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.ONE, gl.ONE);

	gl.useProgram(this.shaderProgram);
	this.setMatrixUniforms(this.shaderProgram);
	//gl.uniform2f(shaderProgram.bandwidthUniform, bandwidth );
	gl.uniform1f(this.shaderProgram.bandwidthScaleUniform, this.bandwidthScale);
	gl.uniform2f(this.shaderProgram.bandwidthUniform, this.bandwidth[0], this.bandwidth[1]);
	gl.uniform1f(this.shaderProgram.kernel_weightUniform, this.kernel_weight);
	gl.enableVertexAttribArray(this.shaderProgram.vertexPositionAttribute);
	for (i = 0; i < this.BUFFER_LIST.length; i += 1) {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.BUFFER_LIST[i]);
		gl.vertexAttribPointer(this.shaderProgram.vertexPositionAttribute, this.BUFFER_LIST[i].itemSize, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLES, 0, this.BUFFER_LIST[i].numItems);
	}
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.disableVertexAttribArray(this.shaderProgram.vertexPositionAttribute);
	gl.disable(gl.BLEND);

	//*
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, this.FBO.tex);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, this.LUT_TEX);

	gl.useProgram(this.lutShader);
	gl.enableVertexAttribArray(this.lutShader.vertexAttribute);
	gl.enableVertexAttribArray(this.lutShader.texCoordAttribute);
	gl.uniform1i(this.lutShader.input_texUniform, 0);
	gl.uniform1i(this.lutShader.lut_texUniform, 1);
	this.ortho(0, 1, 0, 1);
	this.loadIdentity();
	this.setMatrixUniforms(this.lutShader);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.QUAD_POS_BUFFER);
	gl.vertexAttribPointer(this.lutShader.vertexAttribute, this.QUAD_POS_BUFFER.itemSize, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ARRAY_BUFFER, this.QUAD_COORD_BUFFER);
	gl.vertexAttribPointer(this.lutShader.texCoordAttribute, this.QUAD_COORD_BUFFER.itemSize, gl.FLOAT, false, 0, 0);

	gl.drawArrays(gl.TRIANGLES, 0, this.QUAD_POS_BUFFER.numItems);
	gl.disableVertexAttribArray(this.lutShader.vertexAttribute);
	gl.disableVertexAttribArray(this.lutShader.texCoordAttribute);
	//*/
}


KDE.prototype.create_FBO =
	function() {
		var w = this.WIDTH;
		var h = this.HEIGHT;
		gl = this.gl;

		try {
			var FloatingPointTextureExtensionSupported = gl.getExtension("OES_texture_float");
			var FloatingPointTextureExtensionSupportedLinear = gl.getExtension("OES_texture_float_linear");
		} catch (err) {
			var FloatingPointTextureExtensionSupported = false;
			var FloatingPointTextureExtensionSupportedLinear = false;
		}

		var FBO = {};
		FBO.id = gl.createFramebuffer();
		FBO.tex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, FBO.tex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		//FloatingPointTextureExtensionSupported = false;
		if (FloatingPointTextureExtensionSupported && FloatingPointTextureExtensionSupportedLinear) {
			log_it("[ OK ] Floating point textures (OES_texture_float) is supported");
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.FLOAT, null);
		} else {
			log_it("[FAIL] Floating point textures (OES_texture_float) is <B>NOT</B> supported, falling back to 8 bit blending. OES_texture_float is supported in Chrome dev version.");
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		}
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, FBO.id);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, FBO.tex, 0);

		var res = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
		if (res == gl.FRAMEBUFFER_COMPLETE)
			log_it("[ OK ] Framebuffer Initialization");
		else if (res == gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT)
			log_it("[FAIL] Framebuffer Creation FAIL GL_FRAMEBUFFER_INCOMPLETE_ATTACHMENT <br/> \
              Not all framebuffer attachment points are framebuffer attachment complete.");
		else if (res == gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS)
			log_it("[FAIL] Framebuffer Creation FAIL GL_FRAMEBUFFER_INCOMPLETE_DIMENSIONS <br/> \
              Not all attached images have the same width and height. ");
		else if (res == gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT)
			log_it("[FAIL] Framebuffer Creation FAIL GL_FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT <br/> No images are attached to the framebuffer. ");
		else if (res == gl.FRAMEBUFFER_INCOMPLETE_UNSUPPORTED)
			log_it("[FAIL] Framebuffer Creation FAIL GL_FRAMEBUFFER_INCOMPLETE_UNSUPPORTED <br/> The combination of internal formats of the attached images violates an implementation-dependent set of restrictions.");
		else if (res == gl.FRAMEBUFFER_UNSUPPORTED)
			log_it("[FAIL] Framebuffer Creation FAIL GL_FRAMEBUFFER_UNSUPPORTED <br/> \
            The combination of internal formats of the attached images violates an implementation-dependent set of restrictions.");
		else log_it("[FAIL] Framebuffer Creation FAIL Unknown Error");

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		return FBO;
	}

KDE.prototype.setBandwidth =
	function(value) {
		this.bandwidthScale = value;
	}
KDE.prototype.setKernelWeight =
	function(value) {
		this.kernel_weight = value;
	}

KDE.prototype.setColormap =
	function(interpolateFunction, colorCount = 0) {
		self = this;
		let colormapTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, colormapTexture);
		if (colorCount <= 0) {
			colorCount = 1024;
		}
		if (!interpolateFunction) {
			interpolateFunction = d3.interpolatePlasma;
		}
		var colormapValues = new Uint8Array(colorCount * 4);
		for (i = 0; i < colorCount; i++) {
			let scale = i / (colorCount - 1);
			let rgbColor = d3.rgb(interpolateFunction(scale));

			colormapValues[i * 4 + 0] = rgbColor.r;
			colormapValues[i * 4 + 1] = rgbColor.g;
			colormapValues[i * 4 + 2] = rgbColor.b;
			colormapValues[i * 4 + 3] = 0.1;
		}

		//gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, colorCount, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, colormapValues);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.bindTexture(gl.TEXTURE_2D, null);
		this.LUT_TEX = colormapTexture;
	}


KDE.prototype.setData =
	function(newData) {
		this.DATA = newData;
		this.updateTheDatabuffer();
		this.drawScene();

	}

KDE.prototype.update_span =
	function() {
		var xmin = ymin = 9999999999999;
		var xmax = ymax = -9999999999999;
		for (i = 0; i < this.DATA.length; i += 1) {
			x = this.DATA[i][0];
			y = this.DATA[i][1];
			xmin = Math.min(xmin, x);
			xmax = Math.max(xmax, x);
			ymin = Math.min(ymin, y);
			ymax = Math.max(ymax, y);
		}
		//this.bandwidth[0] = (xmax - xmin) * 0.075;
		//this.bandwidth[1] = (ymax - ymin) * 0.075;
		// Please excuse this magic 100
		//this.kernel_weight = 100.0 / this.DATA.length;
	}
KDE.prototype.updateTheDatabuffer =
	function() {
		gl = this.gl;

		var flat_array = [];
		for (i = 0; i < this.DATA.length; i += 1) {
			var offset = i * 18;
			flat_array[offset + 0] = this.DATA[i][0];
			flat_array[offset + 1] = this.DATA[i][1];
			flat_array[offset + 2] = 0.0;

			flat_array[offset + 3] = this.DATA[i][0];
			flat_array[offset + 4] = this.DATA[i][1];
			flat_array[offset + 5] = 1.0;

			flat_array[offset + 6] = this.DATA[i][0];
			flat_array[offset + 7] = this.DATA[i][1];
			flat_array[offset + 8] = 3.0;


			flat_array[offset + 9] = this.DATA[i][0];
			flat_array[offset + 10] = this.DATA[i][1];
			flat_array[offset + 11] = 1.0;

			flat_array[offset + 12] = this.DATA[i][0];
			flat_array[offset + 13] = this.DATA[i][1];
			flat_array[offset + 14] = 2.0;

			flat_array[offset + 15] = this.DATA[i][0];
			flat_array[offset + 16] = this.DATA[i][1];
			flat_array[offset + 17] = 3.0;
		}
		var scatter_vertices = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, scatter_vertices);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(flat_array), gl.STATIC_DRAW);
		scatter_vertices.itemSize = 3;
		scatter_vertices.numItems = flat_array.length / 3;
		this.BUFFER_LIST.pop();
		this.BUFFER_LIST.push(scatter_vertices);
		this.update_span();
	}
