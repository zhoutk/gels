import middles from '../../routers'

export default async () => {
  middles.push(async (ctx, next) => {
    ctx.body = G.jsReponse(G.STCODES.NOTFOUND, 'What you request is not found.')
  })
  return middles
}
