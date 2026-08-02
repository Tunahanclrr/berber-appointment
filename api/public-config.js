// Vercel Serverless Function
// VAPID public key gizli degildir; Push API aboneligi olusturmak icin
// tarayiciya verilmesi gerekir. Private key asla bu endpointten donmez.
export default function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ ok: false, error: 'GET gerekli' })
  }

  return response
    .setHeader('Cache-Control', 'no-store')
    .status(200)
    .json({
      ok: true,
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '',
    })
}
