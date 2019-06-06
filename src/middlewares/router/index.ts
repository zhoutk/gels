import middles from '../../routers'

export default async () => {
  middles.push(async (ctx, next) => {
    ctx.body = G.jsResponse(G.STCODES.NOTFOUNDERR, 'What you request is not found.')
  })
  return middles
}
