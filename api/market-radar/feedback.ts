import { allowMethods, preparePrivateResponse, type MarketRadarRequest, type MarketRadarResponse } from '../../lib/market-radar/http.js'
export default function handler(req: MarketRadarRequest,res: MarketRadarResponse){preparePrivateResponse(res);if(!allowMethods(req,res,['POST']))return;return res.status(503).json({code:'feedback_unavailable',error:'本地雷达拓扑当前只开放受保护的只读数据。'})}
