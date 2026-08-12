export function qiuMarketEnabled(env = process.env) {
  if (env.RADAR_LOCAL_BACKEND === 'true') {
    if (env.RADAR_ENABLE_QIU_MARKET === 'true') throw new Error('Qiu Market is forbidden in local radar backend mode.')
    return false
  }
  return env.RADAR_DISABLE_QIU_MARKET !== 'true'
}
