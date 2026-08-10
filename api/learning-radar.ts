import {
  getLearningRadarStory,
  getLearningRadarSummary,
  listLearningRadarDigests,
  listLearningRadarItems,
} from '../lib/learning-radar/repository.js'
import { createLearningRadarHandler } from '../lib/learning-radar/http-handlers.js'
import {
  allowMethods,
  clampInteger,
  preparePublicResponse,
  queryValue,
  sendPublicError,
} from '../lib/market-radar/http.js'
import { parseLearningRadarCursor } from '../src/learning-radar/contracts.js'

export default createLearningRadarHandler({
  getSummary: getLearningRadarSummary,
  listItems: listLearningRadarItems,
  listDigests: listLearningRadarDigests,
  getStory: getLearningRadarStory,
  parseCursor: parseLearningRadarCursor,
  allowMethods,
  clampInteger,
  preparePublicResponse,
  queryValue,
  sendPublicError,
})
