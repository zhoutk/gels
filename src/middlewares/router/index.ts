import middles from '../../routers'

export default () => {
  middles.push((ctx) => {
    ctx.body = G.jsResponse(G.STCODES.NOTFOUNDERR, 'What you request is not found.')
  })
  return middles
}
