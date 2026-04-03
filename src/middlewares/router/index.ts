import middles from '../../routers'
import { jsResponse } from '../../inits/global'
import { STCODES } from '../../inits/enums'

export default () => {
  middles.push((ctx: any) => {
    if (ctx.body == null) {
      ctx.body = jsResponse(STCODES.NOTFOUNDERR, 'What you request is not found.')
    }
  })
  return middles
}
