let offset_uniform = 3;

/* globals tex */
const glslTransforms = require('./MSL-composable-glsl-functions.js')

// in progress: implementing multiple renderpasses within a single
// function string
//const renderPassFunctions = require('./renderpass-functions.js')

//const counter = require('./counter.js')
//const shaderManager = require('./shaderManager.js')

var Generator = function (param) {
  return Object.create(Generator.prototype)
}

// Functions that return a new transformation function based on the existing function chain as well
// as the new function passed in.
const compositionFunctions = {
  coord: existingF => newF => x => existingF(newF(x)), // coord transforms added onto beginning of existing function chain
  color: existingF => newF => x => newF(existingF(x)), // color transforms added onto end of existing function chain
  combine: existingF1 => existingF2 => newF => x => newF(existingF1(x))(existingF2(x)), //
  combineCoord: existingF1 => existingF2 => newF => x => existingF1(newF(x)(existingF2(x)))
}
// gl_FragColor = osc(modulate(osc(rotate(st, 10., 0.), 32., 0.1, 0.), st, 0.5), 199., 0.1, 0.);

// hydra code: osc().rotate().color().repeat().out()
// pseudo shader code: gl_FragColor = color(osc(rotate(repeat())))

// hydra code: osc().rotate().add(s0).repeat().out()
// gl_FragColor = osc(rotate(repeat())) + tex(repeat())

// Parses javascript args to use in glsl
function generateGlsl (inputs) {
  var str = ''
  inputs.forEach((input) => {
    str += ', ' + input.name
  })
  return str
}
// timing function that accepts a sequence of values as an array
const seq = (arr = []) => ({time, bpm}) =>
{
   let speed = arr.speed ? arr.speed : 1
   return arr[Math.floor(time * speed * (bpm / 60) % (arr.length))]
}
// when possible, reformats arguments to be the correct type
// creates unique names for variables requiring a uniform to be passed in (i.e. a texture)
// returns an object that contains the type and value of each argument
// to do: add much more type checking, validation, and transformation to this part
function formatArguments (userArgs, defaultArgs) {
  return defaultArgs.map((input, index) => {
    var typedArg = {}

    // if there is a user input at a certain index, create a uniform for this variable so that the value is passed in on each render pass
    // to do (possibly): check whether this is a function in order to only use uniforms when needed

    //counter.increment()
    //typedArg.name = input.name + counter.get()
    typedArg.isUniform = true

    if (userArgs.length > index) {
    //  console.log("arg", userArgs[index])
      typedArg.value = userArgs[index]
      // if argument passed in contains transform property, i.e. is of type generator, do not add uniform
      if (userArgs[index].transform) typedArg.isUniform = false

      if (typeof userArgs[index] === 'function') {
        
        console.log("Not support function");
        process.exit(1);
        typedArg.value = String(userArgs[index]);
      } 
      else if (userArgs[index].constructor === Array) {
        console.log("Not support Array")
        process.exit(1);
        typedArg.value = (context, props, batchId) => seq(userArgs[index])(props)
      }
    } else {
      // use default value for argument
      typedArg.value = input.default
    }
    // if input is a texture, set unique name for uniform
    if (input.type==="texture") {
        
        //console.log(typedArg);
        // typedArg.tex = typedArg.value
        var x = typedArg.value
        typedArg.value = ""
        typedArg.name = x.name;
      } else {
        // if passing in a texture reference, when function asks for vec4, convert to vec4
      if (typedArg.value.getTexture && input.type === 'vec4') {
          
        var x = typedArg.value
        typedArg.value = src(x)
        typedArg.isUniform = false
        typedArg.name = x.name;
      }
      else {
        if(input.name=="time"||input.name=="resolution"||input.name=="tex") {
          typedArg.name = input.name;
        }
        else {
          if(typedArg.isUniform) {
            typedArg.name = input.name +"_"+ (offset_uniform++);
          }
          else {
            typedArg.name = input.name;
          }
        }
      }
    }
    typedArg.type = input.type
    return typedArg
  })
}


var GeneratorFactory = function (defaultOutput) {

  let self = this
  self.functions = {}


  //window.frag = shaderManager(defaultOutput)

  // extend Array prototype
  Array.prototype.fast = function(speed) {
    this.speed = speed
    return this
  }

  Object.keys(glslTransforms).forEach((method) => {
    const transform = glslTransforms[method]

    // if type is a source, create a new global generator function that inherits from Generator object
    if (transform.type === 'src') {
      self.functions[method] = (...args) => {
        var obj = Object.create(Generator.prototype)
        obj.name = method
        const inputs = formatArguments(args, transform.inputs)
        obj.transform = (x) => {
          var glslString = `${method}(${x}`
          glslString += generateGlsl(inputs)
          glslString += ')'
          return glslString
        }
        obj.defaultOutput = defaultOutput
        obj.uniforms = []
        inputs.forEach((input, index) => {
          if (input.isUniform) {
            obj.uniforms.push(input)
          }
        })

        obj.passes = []
        let pass = {
          transform: (x) => {
            var glslString = `${method}(${x}`
            glslString += generateGlsl(inputs)
            glslString += ')'
            return glslString
          },
          uniforms: []
        }
        inputs.forEach((input, index) => {
          if (input.isUniform) {
            pass.uniforms.push(input)
          }
        })
        obj.passes.push(pass)
        return obj
      }
    } else {
      Generator.prototype[method] = function (...args) {
        const inputs = formatArguments(args, transform.inputs)

        if (transform.type === 'combine' || transform.type === 'combineCoord') {
        // composition function to be executed when all transforms have been added
        // c0 and c1 are two inputs.. (explain more)
          var f = (c0) => (c1) => {
            var glslString = `${method}(${c0},${c1}`
            glslString += generateGlsl(inputs.slice(1))
            glslString += ')'
            return glslString
          }
          this.transform = compositionFunctions[glslTransforms[method].type](this.transform)(inputs[0].value.transform)(f)

          this.uniforms = this.uniforms.concat(inputs[0].value.uniforms)

          var pass = this.passes[this.passes.length - 1]
          pass.transform = this.transform
          pass.uniform + this.uniform
        } else {
          var f1 = (x) => {
            var glslString = `${method}(${x}`
            glslString += generateGlsl(inputs)
            glslString += ')'
            return glslString
          }
          this.transform = compositionFunctions[glslTransforms[method].type](this.transform)(f1)
          this.passes[this.passes.length - 1].transform = this.transform
        }

        inputs.forEach((input, index) => {
          if (input.isUniform) {
            this.uniforms.push(input)
          }
        })
        this.passes[this.passes.length - 1].uniforms = this.uniforms
        return this
      }
    }
  })
}

//
//   iterate through transform types and create a function for each
//
Generator.prototype.compile = function (pass) {
//  console.log("compiling", pass)
  const frag = `#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wunused-variable"
#include <metal_stdlib>
using namespace metal;

#define vec2 float2
#define vec3 float3
#define vec4 float4
#define ivec2 int2
#define ivec3 int3
#define ivec4 int4
#define mat2 float2x2
#define mat3 float3x3
#define mat4 float4x4

#define mod fmod
#define atan 6.28318530718-atan2
       
constexpr sampler _sampler(coord::normalized, address::clamp_to_edge, filter::nearest);

struct FragmentShaderArguments {
  device float *time[[id(0)]];
  device float2 *resolution[[id(1)]];
  device float2 *mouse[[id(2)]];
${pass.uniforms.map((uniform) => {
  if(uniform.type=="texture") {
    return '';
  }
  else if(uniform.name.indexOf("time")==0) {
    return '';
  }
  else if(uniform.name.indexOf("resolution")==0) {
    return '';
  }
  else {
    return `  device float *${uniform.name}[[id(${uniform.name.split("_")[1]})]];
`
  }
}).join('')+'};'}
         
${Object.values(glslTransforms).map((transform) => {
  return `${transform.glsl}`
}).join('')}
kernel void processimage(
  texture2d<float,access::write> out[[texture(0)]],
  texture2d<float,access::sample> o0[[texture(1)]],
  texture2d<float,access::sample> s0[[texture(2)]],
  texture2d<float,access::sample> s1[[texture(3)]],
  texture2d<float,access::sample> s2[[texture(4)]],
  texture2d<float,access::sample> s3[[texture(5)]],
  constant FragmentShaderArguments &args[[buffer(0)]],
  uint2 gid[[thread_position_in_grid]]) {
             
  float time = args.time[0];
  float2 resolution = args.resolution[0];
  float2 mouse = args.mouse[0];
  float2 gl_FragCoord = float2(gid)+0.5;
  vec4 c = vec4(1, 0, 0, 1);
  vec2 st = gl_FragCoord.xy/resolution.xy;
${pass.uniforms.map((uniform) => {
  if(uniform.type=="texture") {
    return '';
  }
  else if(uniform.name.indexOf("time")==0) {
    return '';
  }
  else if(uniform.name.indexOf("resolution")==0) {
    return '';
  }
  else {
    return `
float ${uniform.name} = args.${uniform.name}[0];`
  }
}).join('')}
         
  out.write(
    ${pass.transform('st')}
  ,gid);
}
#pragma clang diagnostic pop`
         
  return frag
}


// creates a fragment shader from an object containing uniforms and a snippet of
// fragment shader code
Generator.prototype.compileRenderPass = function (pass) {
  var frag = `
      precision highp float;
      ${pass.uniforms.map((uniform) => {
        let type = ''
        switch (uniform.type) {
          case 'float':
            type = 'float'
            break
          case 'texture':
            type = 'sampler2D'
            break
        }
        return `
          uniform ${type} ${uniform.name};`
      }).join('')}
      uniform float time;
      uniform vec2 resolution;
      uniform sampler2D prevBuffer;
      varying vec2 uv;

      ${Object.values(renderPassFunctions).filter(transform => transform.type === 'renderpass_util')
      .map((transform) => {
      //  console.log(transform.glsl)
        return `
                ${transform.glsl}
              `
      }).join('')}

      ${pass.glsl}
  `
  return frag
}


Generator.prototype.glsl = function () {
  var output = this.defaultOutput

  var passes = this.passes.map((pass) => {
    var uniforms = {}
    pass.uniforms.forEach((uniform) => { uniforms[uniform.name] = uniform.value })
    if(pass.hasOwnProperty('transform')){
    //  console.log(" rendering pass", pass)

      return {
        frag: this.compile(pass),
        uniforms: Object.assign(output.uniforms, uniforms)
      }
    } else {
    //  console.log(" not rendering pass", pass)
      return {
        frag: pass.frag,
        uniforms:  Object.assign(output.uniforms, uniforms)
      }
    }
  })
  return passes
}



Generator.prototype.out = function () {
//  console.log('UNIFORMS', this.uniforms, output)
  var output = this.defaultOutput
       
  var tmp = this.glsl(output);

  delete tmp[0].uniforms["o0"];
  delete tmp[0].uniforms["s0"];
  delete tmp[0].uniforms["s1"];
  delete tmp[0].uniforms["s2"];
  delete tmp[0].uniforms["s3"];
  delete tmp[0].uniforms.time;
  delete tmp[0].uniforms.resolution;

  output.renderPasses(tmp);

}

module.exports = GeneratorFactory

