var fbo_scale = 1;
var fbo_enabled = false;
var gl = null;
var texture_ = null;
var texture_fbo = null;
var fbo_ = null;
var prog = null;
var prog2 = null;
var vert_buf = null;
var vert_buf_fbo = null;

function do_resize(scale) {
   var canvas = document.getElementById("test_canvas");
   canvas.width = texture_.image.width * scale;
   canvas.height = texture_.image.height * scale;
   var output = document.getElementById("total_scale_output");
   output.innerHTML = scale + "x";
}

function do_fbo_scale(scale) {
   fbo_enabled = scale != 0;
   fbo_scale = scale;
   var output = document.getElementById("fbo_scale_output");
   if (fbo_enabled) {
      output.innerHTML = fbo_scale + "x</b>";
   } else {
      output.innerHTML = "Off";
   }
}

function set_filter(smooth) {
   if (smooth) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
   } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
   }
}

function do_filter1(smooth) {
   gl.bindTexture(gl.TEXTURE_2D, texture_);
   set_filter(smooth);
   gl.bindTexture(gl.TEXTURE_2D, null);
   var output = document.getElementById("filter1_output");
   if (smooth) {
      output.innerHTML = "Linear";
   } else {
      output.innerHTML = "Point";
   }
}

function do_filter2(smooth) {
   gl.bindTexture(gl.TEXTURE_2D, texture_fbo);
   set_filter(smooth);
   gl.bindTexture(gl.TEXTURE_2D, null);
   var output = document.getElementById("filter2_output");
   if (smooth) {
      output.innerHTML = "Linear";
   } else {
      output.innerHTML = "Point";
   }
}

function initGL(canvas) {
   try {
      gl = canvas.getContext("experimental-webgl");
      gl.viewportWidth = canvas.width;
      gl.viewportHeight = canvas.height;
   } catch (e) {}
   if (!gl) {
      alert("Could not init WebGL ... :(");
   }
}

function getShader(id) {
   var script = document.getElementById(id);
   if (!script) { return null; }

   var str = "";
   var k = script.firstChild;
   while (k) {
      if (k.nodeType == 3) { // Magic number 3, what :v
         str += k.textContent;
      }
      k = k.nextSibling;
   }

   var shader;
   if (script.type == "x-shader/x-fragment") {
      shader = gl.createShader(gl.FRAGMENT_SHADER);
   } else if (script.type == "x-shader/x-vertex") {
      shader = gl.createShader(gl.VERTEX_SHADER);
   } else {
      return null;
   }

   gl.shaderSource(shader, str);
   gl.compileShader(shader);

   if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert(gl.getShaderInfoLog(shader));
      return null;
   }

   return shader;
}


function set_image(img) {
   gl.bindTexture(gl.TEXTURE_2D, texture_);
   gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

   // Would prefer clamp to border,
   // but GLES only supports CLAMP_TO_EDGE with NPOT textures.
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function load_image(evt) {
   if (!(window.File && window.FileReader && window.FileList && window.Blob)) {
      alert("FileReader API not supported by this browser ...");
      return;
   }

   var file = evt.target.files[0];
   if (!file.type.match("image.*")) {
      alert("This is not an image file! :(");
      return;
   }

   var reader = new FileReader();
   reader.onload = 
      function(e) {
         texture_.old_img = texture_.image;
         texture_.image = new Image();
         texture_.image.onload = function() {
            if (texture_.image.width > 0 && texture_.image.height > 0) {
               try {
                  set_image(texture_.image);
                  do_resize(1);
               } catch (e) {
                  texture_.image = texture_.old_img;
                  alert(e);
               }
            } else {
               texture_.image = texture_.old_img;
            }

            var output = document.getElementById("image_output");
            output.innerHTML = "Enabled";

            var output = document.getElementById("filter1_output");
            output.innerHTML = "Point";
         }
         texture_.image.src = e.target.result;
      }

   reader.readAsDataURL(file);
}

function parse_xml(text) {
   try {
      var vert = null;
      var frag = null;

      var parser = new DOMParser();
      var xmldoc = parser.parseFromString(text, "text/xml");

      var elems;
      elems = xmldoc.getElementsByTagName("vertex");
      if (elems.length > 0) {
         vert = elems[0].childNodes[0].nodeValue;
      }
      elems = xmldoc.getElementsByTagName("fragment");
      if (elems.length > 0) {
         frag = elems[0].childNodes[0].nodeValue;
      }

   } catch (e) {
      alert(e);
   }

   return {
      vert: vert,
      frag: frag
   };
}

// Hacks to conform to GLES 2.0 :)
function transform_vert(vert_) {
   var vert = "const mat4 trans_matrix_ = mat4(1.0, 0.0, 0.0, 0.0,\n";
   vert += "0.0, 1.0, 0.0, 0.0,\n";
   vert += "0.0, 0.0, 1.0, 0.0,\n";
   vert += "0.0, 0.0, 0.0, 1.0);\n";
   vert += "#define gl_ModelViewProjectionMatrix trans_matrix_\n";
   vert += "#define gl_Vertex vec4(rubyVertex, 0.0, 1.0)\n";
   vert += "#define gl_MultiTexCoord0 vec4(rubyTexCoord, 0.0, 0.0)\n";
   vert += "attribute vec2 rubyVertex;\n";
   vert += "attribute vec2 rubyTexCoord;\n";
   vert += "varying vec4 rubyTexCoord_[8];\n";
   vert += "#define gl_TexCoord rubyTexCoord_\n";
   vert += vert_;
   return vert;
}

function transform_frag(frag_) {
   var frag = "precision highp float;\n";
   frag += "varying vec4 rubyTexCoord_[8];\n";
   frag += "#define gl_TexCoord rubyTexCoord_\n";
   frag += frag_;
   return frag;
}

function compile_xml_shader(vert, frag, index) {
   var vert_s = null;
   var frag_s = null;

   var console = document.getElementById("error_console");
   console.innerHTML = "Shader compile was successful!\n";

   if (vert) {
      vert_s = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vert_s, transform_vert(vert));
      gl.compileShader(vert_s);
      if (!gl.getShaderParameter(vert_s, gl.COMPILE_STATUS)) {
         alert("Vertex shader failed to compile!");
         console.innerHTML = "Vertex errors:\n" + gl.getShaderInfoLog(vert_s);
         return;
      }
      var log = gl.getShaderInfoLog(vert_s);
      if (log.length > 0) {
         console.innerHTML = "Vertex warnings:\n" + log;
      }
   } else {
      vert_s = getShader("vertex_shader");
   }

   if (frag) {
      frag_s = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(frag_s, transform_frag(frag));
      gl.compileShader(frag_s);
      if (!gl.getShaderParameter(frag_s, gl.COMPILE_STATUS)) {
         alert("Fragment shader failed to compile!");
         console.innerHTML += "Fragment errors:\n" + gl.getShaderInfoLog(frag_s);
         return;
      }
      var log = gl.getShaderInfoLog(frag_s);
      if (log.length > 0) {
         console.innerHTML += "Fragment warnings:\n" + log;
      }
   } else {
      frag_s = getShader("fragment_shader");
   }

   gl.useProgram(null);
   if (index === 0) {
      gl.deleteProgram(prog);
   } else if (index === 1) {
      gl.deleteProgram(prog2);
   }

   var program = gl.createProgram();
   gl.attachShader(program, vert_s);
   gl.attachShader(program, frag_s);
   gl.linkProgram(program);
   if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.innerHTML = "Linking errors:\n" + gl.getProgramInfoLog(program);
      alert("Failed to link program!");
      return;
   }

   program.vert = vert_s;
   program.frag = frag_s;

   gl.useProgram(program);
   program.vert_attr = gl.getAttribLocation(prog, "rubyVertex");
   program.tex_attr = gl.getAttribLocation(prog, "rubyTexCoord");
   gl.enableVertexAttribArray(program.vert_attr);
   gl.enableVertexAttribArray(program.tex_attr);
   gl.uniform1i(gl.getUniformLocation(program, "rubyTexture"), 0);
   gl.vertexAttribPointer(program.tex_attr,  2, gl.FLOAT, false, 4 * 4, 0 * 4);
   gl.vertexAttribPointer(program.vert_attr, 2, gl.FLOAT, false, 4 * 4, 2 * 4);

   if (index === 0) {
      prog = program;
   } else if (index === 1) {
      prog2 = program;
   }
}

function reset_shader() {
   compile_xml_shader(null, null, 0);
   var output = document.getElementById("text_output");
   output.innerHTML = "";

   output = document.getElementById("shader1_output");
   output.innerHTML = "Default";
}

function reset_shader2() {
   compile_xml_shader(null, null, 1);
   var output = document.getElementById("text_output2");
   output.innerHTML = "";

   output = document.getElementById("shader2_output");
   output.innerHTML = "Default";
}

function reset_image() {
   texture_.image.width = 0;
   texture_.image.height = 0;
   do_resize(1);
   var output = document.getElementById("image_output");
   output.innerHTML = "None";
}

function load_text(evt, index) {
   if (!(window.File && window.FileReader && window.FileList && window.Blob)) {
      alert("FileReader API not supported by this browser ...");
      return;
   }

   if (!window.DOMParser) {
      alert("No XML parser found :(");
      return;
   }

   var file = evt.target.files[0];
   if (!file.name.match("\\.shader$")) {
      alert("Not an XML shader!");
      return;
   }

   var reader = new FileReader();
   reader.onload =
      function(e) {
         var xml = parse_xml(e.target.result);
         var output;
         if (index === 0) {
            output = document.getElementById("text_output");
         } else if (index === 1) {
            output = document.getElementById("text_output2");
         }
         output.innerHTML = "";

         if (xml.vert != null) {
            output.innerHTML += '<h5>Vertex</h5><textarea readonly cols="50" rows="10">'
               + xml.vert + '</textarea>';
         }
         if (xml.frag != null) {
            output.innerHTML += '<h5>Fragment</h5><textarea readonly cols="50" rows="10">'
               + xml.frag + '</textarea>';
         }

         try {
            compile_xml_shader(xml.vert, xml.frag, index);
            var output = null;
            if (index === 0) {
               output = document.getElementById("shader1_output");
            } else if (index === 1) {
               output = document.getElementById("shader2_output");
            }
            output.innerHTML = "Enabled";
         } catch (e) {
            alert(e);
         }
      }

   reader.readAsText(file);
}

function load_text0(evt) {
   load_text(evt, 0);
}

function load_text1(evt) {
   load_text(evt, 1);
}

document.getElementById("image_file").addEventListener("change", load_image, false);
document.getElementById("shader_file").addEventListener("change", load_text0, false);
document.getElementById("shader_file2").addEventListener("change", load_text1, false);

function initShaders() {
   prog = gl.createProgram();
   prog2 = gl.createProgram();
   prog.frag = getShader("fragment_shader");
   prog.vertex = getShader("vertex_shader");
   prog2.frag = getShader("fragment_shader");
   prog2.vertex = getShader("vertex_shader");
   gl.attachShader(prog, prog.frag);
   gl.attachShader(prog, prog.vertex);
   gl.attachShader(prog2, prog2.frag);
   gl.attachShader(prog2, prog2.vertex);
   gl.linkProgram(prog);
   gl.linkProgram(prog2);

   if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      alert("Failed to init shader!");
   }
   if (!gl.getProgramParameter(prog2, gl.LINK_STATUS)) {
      alert("Failed to init shader!");
   }

   prog.vert_attr = gl.getAttribLocation(prog, "rubyVertex");
   prog.tex_attr = gl.getAttribLocation(prog, "rubyTexCoord");
   gl.enableVertexAttribArray(prog.vert_attr);
   gl.enableVertexAttribArray(prog.tex_attr);
   gl.uniform1i(gl.getUniformLocation(prog, "rubyTexture"), 0);

   texture_ = gl.createTexture();
   texture_.image = new Image();
   texture_.image.width = 0;
   texture_.image.height = 0;
   gl.bindTexture(gl.TEXTURE_2D, texture_);
}

function initFramebuffer() {
   texture_fbo = gl.createTexture();
   fbo_ = gl.createFramebuffer();
   gl.bindFramebuffer(gl.FRAMEBUFFER, fbo_);
   fbo_.width = 512;
   fbo_.height = 512;

   gl.bindTexture(gl.TEXTURE_2D, texture_fbo);
   gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fbo_.width, fbo_.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
   gl.bindTexture(gl.TEXTURE_2D, texture_);

   gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture_fbo, 0);
   gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function initBuffers() {
   vert_buf_fbo = gl.createBuffer();
   gl.bindBuffer(gl.ARRAY_BUFFER, vert_buf_fbo);

   var fbo_coords = [ // Non-flipped.
      // TEX      // VERT
      0.0, 1.0,   -1.0,  1.0,
      1.0, 1.0,    1.0,  1.0,
      0.0, 0.0,   -1.0, -1.0,
      1.0, 0.0,    1.0, -1.0,
      ];

   gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(fbo_coords), gl.STATIC_DRAW);

   vert_buf = gl.createBuffer();
   gl.bindBuffer(gl.ARRAY_BUFFER, vert_buf);

   var coords = [ // Flipped.
      // TEX      // VERT
      0.0, 0.0,   -1.0,  1.0,
      1.0, 0.0,    1.0,  1.0,
      0.0, 1.0,   -1.0, -1.0,
      1.0, 1.0,    1.0, -1.0,
      ];
   coords.size = 4;

   gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coords), gl.STATIC_DRAW);

   gl.vertexAttribPointer(prog.tex_attr,  2, gl.FLOAT, false, 4 * coords.size, 0 * coords.size);
   gl.vertexAttribPointer(prog.vert_attr, 2, gl.FLOAT, false, 4 * coords.size, 2 * coords.size);
}

function do_render_regular() {
   gl.clear(gl.COLOR_BUFFER_BIT);
   var canvas = document.getElementById("test_canvas");

   gl.bindFramebuffer(gl.FRAMEBUFFER, null);

   gl.viewportWidth = canvas.width;
   gl.viewportHeight = canvas.height;

   gl.bindBuffer(gl.ARRAY_BUFFER, vert_buf);
   gl.vertexAttribPointer(prog.tex_attr,  2, gl.FLOAT, false, 4 * 4, 0 * 4);
   gl.vertexAttribPointer(prog.vert_attr, 2, gl.FLOAT, false, 4 * 4, 2 * 4);

   gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
   gl.uniform2f(gl.getUniformLocation(prog, "rubyTextureSize"),
         texture_.image.width, texture_.image.height);
   gl.uniform2f(gl.getUniformLocation(prog, "rubyInputSize"),
         texture_.image.width, texture_.image.height);
   gl.uniform2f(gl.getUniformLocation(prog, "rubyOutputSize"),
         gl.viewportWidth, gl.viewportHeight);

   gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function do_render_fbo() {
   var out_width = texture_.image.width * fbo_scale;
   var out_height = texture_.image.width * fbo_scale;

   if ((out_width != fbo_.width) || (out_height != fbo_.height)) {
      gl.bindTexture(gl.TEXTURE_2D, texture_fbo);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, out_width, out_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      fbo_.width = out_width;
      fbo_.height = out_height;
   }

   gl.bindBuffer(gl.ARRAY_BUFFER, vert_buf_fbo);
   prog.vert_attr = gl.getAttribLocation(prog, "rubyVertex");
   prog.tex_attr = gl.getAttribLocation(prog, "rubyTexCoord");
   gl.enableVertexAttribArray(prog.vert_attr);
   gl.enableVertexAttribArray(prog.tex_attr);
   gl.vertexAttribPointer(prog.tex_attr,  2, gl.FLOAT, false, 4 * 4, 0 * 4);
   gl.vertexAttribPointer(prog.vert_attr, 2, gl.FLOAT, false, 4 * 4, 2 * 4);

   gl.bindTexture(gl.TEXTURE_2D, texture_);
   gl.bindFramebuffer(gl.FRAMEBUFFER, fbo_);
   gl.viewport(0, 0, fbo_.width, fbo_.height);
   gl.clear(gl.COLOR_BUFFER_BIT);

   gl.uniform2f(gl.getUniformLocation(prog, "rubyTextureSize"),
         texture_.image.width, texture_.image.height);
   gl.uniform2f(gl.getUniformLocation(prog, "rubyInputSize"),
         texture_.image.width, texture_.image.height);
   gl.uniform2f(gl.getUniformLocation(prog, "rubyOutputSize"),
         fbo_.width, fbo_.height);

   gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

   gl.useProgram(prog2);

   gl.bindFramebuffer(gl.FRAMEBUFFER, null);
   gl.bindTexture(gl.TEXTURE_2D, texture_fbo);

   var canvas = document.getElementById("test_canvas");
   gl.viewportWidth = canvas.width;
   gl.viewportHeight = canvas.height;
   gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
   gl.clear(gl.COLOR_BUFFER_BIT);

   gl.bindBuffer(gl.ARRAY_BUFFER, vert_buf);

   prog2.vert_attr = gl.getAttribLocation(prog2, "rubyVertex");
   prog2.tex_attr = gl.getAttribLocation(prog2, "rubyTexCoord");
   gl.enableVertexAttribArray(prog2.vert_attr);
   gl.enableVertexAttribArray(prog2.tex_attr);
   gl.vertexAttribPointer(prog2.tex_attr,  2, gl.FLOAT, false, 4 * 4, 0 * 4);
   gl.vertexAttribPointer(prog2.vert_attr, 2, gl.FLOAT, false, 4 * 4, 2 * 4);
   gl.uniform1i(gl.getUniformLocation(prog2, "rubyTexture"), 0);

   gl.uniform2f(gl.getUniformLocation(prog2, "rubyTextureSize"),
         fbo_.width, fbo_.height);
   gl.uniform2f(gl.getUniformLocation(prog2, "rubyInputSize"),
         fbo_.width, fbo_.height);
   gl.uniform2f(gl.getUniformLocation(prog2, "rubyOutputSize"),
         gl.viewportWidth, gl.viewportHeight);

   gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function do_render() {
   try {
      if (texture_.image.width == 0 && texture_.image.height == 0)
         return;

      gl.useProgram(prog);
      gl.bindTexture(gl.TEXTURE_2D, texture_);

      if (fbo_enabled) {
         do_render_fbo();
      } else {
         do_render_regular();
      }

      gl.flush();
   } catch (e) {
      alert(e);
   }
}

function webGLStart() {
   try {
      var canvas = document.getElementById("test_canvas");
      initGL(canvas);

      gl.enable(gl.TEXTURE_2D);
      initFramebuffer();
      initShaders();
      initBuffers();

      gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
      gl.clearColor(0.0, 0.0, 0.0, 0.0);

      var f = function() {
         window.setTimeout(f, 100);
         do_render();
      };
      f();

   } catch (e) {
      alert(e);
   }
}

