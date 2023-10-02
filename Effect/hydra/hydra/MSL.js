const BUILD = true;
if(!global["PLUGIN"]) global["PLUGIN"] = "hydra"
const VERSION = "Ae";

slider=(value,min,max)=>"slider("+value+","+min+","+max+")";

const stringifyWithFunctions = function(object) {
	return JSON.stringify(object,(k,v) => {
		if(typeof(v)==="function") return "(${v})";
		return v;
	});
};

global["o0"] = {
	name:"o0",
	uniforms:{},
	getTexture:function() {},
	renderPasses:function(glsl) {
		const verion = (typeof(VERSION)==="string")?"\""+VERSION+"\"":VERSION.toFixed(1);
		require("fs").writeFileSync(PLUGIN+".json","{\n\t\"version\":"+verion+",\n\t\"metallib\":\""+PLUGIN+".metallib\",\n\t\"uniforms\":"+stringifyWithFunctions(glsl[0].uniforms)+"\n}");
		require("fs").writeFileSync(PLUGIN+".metal",glsl[0].frag);
		if(BUILD) {
			require("child_process").execSync("xcrun -sdk macosx metal -c ./"+PLUGIN+".metal -o ./"+PLUGIN+".air; xcrun -sdk macosx metallib ./"+PLUGIN+".air -o ./"+PLUGIN+".metallib");
			require("child_process").execSync("rm ./*.air");
			require("child_process").execSync("rm ./*.metal");
		}
	}
};

for(let k=0; k<4; k++) {
	global["s"+k] = {
		name:"s"+k,
		uniforms:{},
		getTexture:function(){},
	};
}

const gen = new (require('./MSLGeneratorFactory.js'))(o0)
global.generator = gen
Object.keys(gen.functions).forEach((key)=>{
	global[key] = gen.functions[key];  
})

module.exports = {}
