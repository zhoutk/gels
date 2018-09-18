import foo from './foo'

Object.assign(global, {foo})
// global["foo"] =  foo

import {show} from './bar'

console.log(`hello world! -- ${foo}`)

show()