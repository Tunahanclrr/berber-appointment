// Netlify fonksiyonundaki dogrulama ve cakisma kontrollerini Vercel'de de
// aynen kullan. Boylece iki deploy saglayicisi farkli davranmaz.
import { handler as netlifyHandler } from '../netlify/functions/create-public-appointment.js'

export default async function handler(request, response) {
  const result = await netlifyHandler({
    httpMethod: request.method,
    body: JSON.stringify(request.body || {}),
  })

  for (const [name, value] of Object.entries(result.headers || {})) {
    response.setHeader(name, value)
  }
  return response.status(result.statusCode).send(result.body)
}
