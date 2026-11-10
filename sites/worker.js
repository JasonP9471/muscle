import { createNutritionApi } from './nutrition-api.js'

const STATIC_ASSET = /\.[a-z0-9]+$/i
const handleNutritionApi = createNutritionApi()

export default {
  async fetch(request, environment) {
    const url = new URL(request.url)
    if (url.pathname === '/api/analyze-nutrition') return handleNutritionApi(request, environment)
    if (request.method === 'GET' && !STATIC_ASSET.test(url.pathname)) {
      url.pathname = '/'
      return environment.ASSETS.fetch(new Request(url, request))
    }

    return environment.ASSETS.fetch(request)
  },
}
