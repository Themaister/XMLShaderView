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
var frame_count = 0;

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
      output.innerHTML = fbo_scale + "x";
   } else {
      output.innerHTML = "Off";
   }
   canvas.width = texture_.image.width * scale;
   canvas.height = texture_.image.height * scale;
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
      gl = canvas.getContext("webgl");
      if (gl == null) {
         gl = canvas.getContext("experimental-webgl");
      }
      gl.viewportWidth = canvas.width;
      gl.viewportHeight = canvas.height;
   } catch (e) {}
   if (gl == null) {
      alert("Could not init WebGL ... :(");
   }
}

function set_image(img) {
   gl.bindTexture(gl.TEXTURE_2D, texture_);
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
   gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

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

   reader.onerror =
      function(err) {
         alert("FileReader error: " + err.getMessage());
      }

   reader.readAsDataURL(file);
}

function getShader(id) {
   return document.getElementById(id).innerHTML;
}

function compile_shader(shader, index) {
   var vert_s = null;
   var frag_s = null;

   var console = document.getElementById("error_console");
   console.innerHTML = "Shader compile was successful!\n";

   if (shader == null)
      shader = getShader("default_shader");

   vert_s = gl.createShader(gl.VERTEX_SHADER);
   gl.shaderSource(vert_s, "#define VERTEX\n" + shader);
   gl.compileShader(vert_s);
   if (!gl.getShaderParameter(vert_s, gl.COMPILE_STATUS)) {
      alert("Vertex shader failed to compile!");
      console.innerHTML = "Vertex errors:\n" + gl.getShaderInfoLog(vert_s);
      return;
   }
   var log = gl.getShaderInfoLog(vert_s);
   if (log.length > 0) {
      console.innerHTML += "Vertex warnings:\n" + log;
   }

   frag_s = gl.createShader(gl.FRAGMENT_SHADER);
   gl.shaderSource(frag_s, "#define FRAGMENT\n" + shader);
   gl.compileShader(frag_s);
   if (!gl.getShaderParameter(frag_s, gl.COMPILE_STATUS)) {
      alert("Fragment shader failed to compile!");
      console.innerHTML = "Fragment errors:\n" + gl.getShaderInfoLog(frag_s);
      return;
   }
   var log = gl.getShaderInfoLog(frag_s);
   if (log.length > 0) {
      console.innerHTML += "Fragment warnings:\n" + log;
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

   program.vert_attr = gl.getAttribLocation(program, "VertexCoord");
   program.tex_attr = gl.getAttribLocation(program, "TexCoord");

   if (index === 0) {
      prog = program;
      var output = document.getElementById("shader1_output");
      output.innerHTML = "Enabled";
   } else if (index === 1) {
      prog2 = program;
      var output = document.getElementById("shader2_output");
      output.innerHTML = "Enabled";
   }
}

function reset_shader() {
   compile_shader(null, 0);
   var output = document.getElementById("text_output");
   output.innerHTML = "";

   output = document.getElementById("shader1_output");
   output.innerHTML = "Default";
}

function reset_shader2() {
   compile_shader(null, 1);
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
   if (!file.name.match("\\.glsl$")) {
      alert("Not a GLSL shader!");
      return;
   }

   var reader = new FileReader();
   reader.onload =
      function(e) {
         try {
            compile_shader(e.target.result, index);
         } catch(e) {
            alert(e);
         }

         var output;
         if (index === 0) {
            output = document.getElementById("text_output");
         } else if (index === 1) {
            output = document.getElementById("text_output2");
         }
         output.innerHTML = "";

         if (e.target.result != null) {
            output.innerHTML += '<h5>Program</h5><textarea readonly cols="50" rows="10">'
               + e.target.result + '</textarea>';
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
   reset_shader();
   reset_shader2();

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
   fbo_.width = 256;
   fbo_.height = 256;

   gl.bindTexture(gl.TEXTURE_2D, texture_fbo);
   gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fbo_.width, fbo_.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
   gl.bindTexture(gl.TEXTURE_2D, null);

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
      1.0, 0.0,    1.0, -1.0 ];

   gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(fbo_coords), gl.STATIC_DRAW);

   vert_buf = gl.createBuffer();
   gl.bindBuffer(gl.ARRAY_BUFFER, vert_buf);

   var coords = [ // Flipped.
      // TEX      // VERT
      0.0, 0.0,   -1.0,  1.0,
      1.0, 0.0,    1.0,  1.0,
      0.0, 1.0,   -1.0, -1.0,
      1.0, 1.0,    1.0, -1.0 ];
   coords.size = 4;

   gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coords), gl.STATIC_DRAW);
   gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

function do_render_regular() {
   gl.clear(gl.COLOR_BUFFER_BIT);
   var canvas = document.getElementById("test_canvas");

   var output = document.getElementById("geometry");
   output.innerHTML = "<b>Geometry</b> " +
      "Canvas @ " + canvas.width + "x" + canvas.height;

   gl.bindFramebuffer(gl.FRAMEBUFFER, null);
   gl.useProgram(prog);
   gl.bindTexture(gl.TEXTURE_2D, texture_);

   gl.viewportWidth = canvas.width;
   gl.viewportHeight = canvas.height;

   gl.bindBuffer(gl.ARRAY_BUFFER, vert_buf);
   gl.vertexAttribPointer(prog.tex_attr,  2, gl.FLOAT, false, 4 * 4, 0 * 4);
   gl.vertexAttribPointer(prog.vert_attr, 2, gl.FLOAT, false, 4 * 4, 2 * 4);
   gl.enableVertexAttribArray(prog.tex_attr);
   gl.enableVertexAttribArray(prog.vert_attr);

   gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
   gl.uniform2f(gl.getUniformLocation(prog, "TextureSize"),
         texture_.image.width, texture_.image.height);
   gl.uniform2f(gl.getUniformLocation(prog, "InputSize"),
         texture_.image.width, texture_.image.height);
   gl.uniform2f(gl.getUniformLocation(prog, "OutputSize"),
         gl.viewportWidth, gl.viewportHeight);
   gl.uniform1i(gl.getUniformLocation(prog, "FrameCount"),
         frame_count);

   var identity_raw = [
      1.0, 0.0, 0.0, 0.0,
      0.0, 1.0, 0.0, 0.0,
      0.0, 0.0, 1.0, 0.0,
      0.0, 0.0, 0.0, 1.0 ];
   var identity = new Float32Array(identity_raw);
   gl.uniformMatrix4fv(gl.getUniformLocation(prog, "MVPMatrix"),
         false, identity);

   gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
   gl.disableVertexAttribArray(prog.tex_attr);
   gl.disableVertexAttribArray(prog.vert_attr);
   gl.useProgram(null);
   gl.bindTexture(gl.TEXTURE_2D, null);
}

function do_render_fbo() {
   var out_width = texture_.image.width * fbo_scale;
   var out_height = texture_.image.height * fbo_scale;

   if ((out_width != fbo_.width) || (out_height != fbo_.height)) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo_);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D, null, 0);
      gl.bindTexture(gl.TEXTURE_2D, texture_fbo);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, out_width, out_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D, texture_fbo, 0);
      fbo_.width = out_width;
      fbo_.height = out_height;
   }

   var canvas = document.getElementById("test_canvas");
   var output = document.getElementById("geometry");
   output.innerHTML = "<b>Geometry</b> " + "FBO @ " + fbo_.width + "x" + fbo_.height +
      ", Canvas @ " + canvas.width + "x" + canvas.height;

   gl.useProgram(prog);
   gl.bindTexture(gl.TEXTURE_2D, texture_);

   gl.bindBuffer(gl.ARRAY_BUFFER, vert_buf_fbo);
   prog.vert_attr = gl.getAttribLocation(prog, "VertexCoord");
   prog.tex_attr = gl.getAttribLocation(prog, "TexCoord");
   gl.enableVertexAttribArray(prog.tex_attr);
   gl.enableVertexAttribArray(prog.vert_attr);
   gl.vertexAttribPointer(prog.tex_attr,  2, gl.FLOAT, false, 4 * 4, 0 * 4);
   gl.vertexAttribPointer(prog.vert_attr, 2, gl.FLOAT, false, 4 * 4, 2 * 4);

   gl.bindTexture(gl.TEXTURE_2D, texture_);
   gl.bindFramebuffer(gl.FRAMEBUFFER, fbo_);
   gl.viewport(0, 0, fbo_.width, fbo_.height);
   gl.clear(gl.COLOR_BUFFER_BIT);

   gl.uniform1i(gl.getUniformLocation(prog, "Texture"), 0);
   gl.uniform2f(gl.getUniformLocation(prog, "TextureSize"),
         texture_.image.width, texture_.image.height);
   gl.uniform2f(gl.getUniformLocation(prog, "InputSize"),
         texture_.image.width, texture_.image.height);
   gl.uniform2f(gl.getUniformLocation(prog, "OutputSize"),
         fbo_.width, fbo_.height);
   gl.uniform1i(gl.getUniformLocation(prog, "FrameCount"),
         frame_count);

   var identity_raw = [
      1.0, 0.0, 0.0, 0.0,
      0.0, 1.0, 0.0, 0.0,
      0.0, 0.0, 1.0, 0.0,
      0.0, 0.0, 0.0, 1.0 ];
   var identity = new Float32Array(identity_raw);
   gl.uniformMatrix4fv(gl.getUniformLocation(prog, "MVPMatrix"),
         false, identity);

   gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
   gl.disableVertexAttribArray(prog.vert_attr);
   gl.disableVertexAttribArray(prog.tex_attr);

   gl.useProgram(prog2);

   gl.bindFramebuffer(gl.FRAMEBUFFER, null);
   gl.bindTexture(gl.TEXTURE_2D, texture_fbo);

   gl.viewportWidth = canvas.width;
   gl.viewportHeight = canvas.height;
   gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
   gl.clear(gl.COLOR_BUFFER_BIT);

   gl.bindBuffer(gl.ARRAY_BUFFER, vert_buf);

   prog2.vert_attr = gl.getAttribLocation(prog2, "VertexCoord");
   prog2.tex_attr = gl.getAttribLocation(prog2, "TexCoord");
   gl.enableVertexAttribArray(prog2.vert_attr);
   gl.enableVertexAttribArray(prog2.tex_attr);
   gl.vertexAttribPointer(prog2.tex_attr,  2, gl.FLOAT, false, 4 * 4, 0 * 4);
   gl.vertexAttribPointer(prog2.vert_attr, 2, gl.FLOAT, false, 4 * 4, 2 * 4);

   gl.uniform1i(gl.getUniformLocation(prog2, "Texture"), 0);
   gl.uniform2f(gl.getUniformLocation(prog2, "TextureSize"),
         fbo_.width, fbo_.height);
   gl.uniform2f(gl.getUniformLocation(prog2, "InputSize"),
         fbo_.width, fbo_.height);
   gl.uniform2f(gl.getUniformLocation(prog2, "OutputSize"),
         gl.viewportWidth, gl.viewportHeight);
   gl.uniformMatrix4fv(gl.getUniformLocation(prog2, "MVPMatrix"),
         false, identity);
   gl.uniform1i(gl.getUniformLocation(prog2, "FrameCount"),
         frame_count);

   gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
   gl.disableVertexAttribArray(prog2.vert_attr);
   gl.disableVertexAttribArray(prog2.tex_attr);

   gl.useProgram(null);
   gl.bindTexture(gl.TEXTURE_2D, null);
}

function do_render() {
   window.requestAnimFrame(do_render);
   try {
      if (texture_.image.width == 0 && texture_.image.height == 0)
         return;

      frame_count += 1;
      if (fbo_enabled) {
         do_render_fbo();
      } else {
         do_render_regular();
      }

      var output = document.getElementById("frame_count");
      output.innerHTML = "<b>Frames</b> " + frame_count;

      gl.flush();
   } catch (e) {
      alert(e);
   }
}

function webGLStart() {
   try {
      var canvas = document.getElementById("test_canvas");
      initGL(canvas);

      initFramebuffer();
      initShaders();
      initBuffers();

      gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
      gl.clearColor(0.0, 0.0, 0.0, 1.0);

      window.requestAnimFrame = (function() {
         return window.requestAnimationFrame ||
         window.webkitRequestAnimationFrame  ||
         window.mozRequestAnimationFrame     ||
         window.oRequestAnimationFrame       ||
         window.msRequestAnimationFrame      ||
         function(callback) {
            window.setTimeout(callback, 1000 / 60);
         };
      })();

      do_render();

   } catch (e) {
      alert(e);
   }
}

