### hydra-Ae

Based on [hydra-synth 1.0.25](https://github.com/ojack/hydra-synth/tree/7eb0dde5175e2a6ce417e9f16d7e88fe1d750133).
Please see more about [ojack](https://github.com/ojack) / [hydra-synth](https://github.com/ojack/hydra-synth).

#### Extension

`slider(value,min,max)`

Defining as follows to maintain compatibility with [hydra-synth](https://hydra.ojack.xyz/).

```
if(typeof(slider)==="undefined") slider=(value,min,max)=>value
```

#### Build

##### Note:

output buffers cannot be used.