import { allowMethods, preparePrivateResponse, type MarketRadarRequest, type MarketRadarResponse } from '../../../lib/market-radar/http.js'
export default function handler(req: MarketRadarRequest,res: MarketRadarResponse){preparePrivateResponse(res);if(!allowMethods(req,res,['POST']))return;return res.status(404).json({code:'route_not_found',error:'Hermes acknowledgement is loopback-only.'})}
