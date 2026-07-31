import { useEffect } from 'react'

const defaultDescription = 'Randevu Zamani; berberler, kuaforler ve randevulu calisan isletmeler icin online randevu, personel ve hizmet takip sistemidir.'

function upsertMeta(selector, create, attrs) {
  let node = document.head.querySelector(selector)
  if (!node) {
    node = document.createElement(create)
    document.head.appendChild(node)
  }

  Object.entries(attrs).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      node.removeAttribute(key)
      return
    }
    node.setAttribute(key, value)
  })
}

export default function SEO({
  title = 'Randevu Zamani | Online Randevu ve Personel Takip Sistemi',
  description = defaultDescription,
  image = '/berber-logo-png.png',
  type = 'website',
  noIndex = false,
  structuredData,
}) {
  useEffect(() => {
    const absoluteUrl = new URL(window.location.pathname, window.location.origin).toString()
    const absoluteImage = new URL(image, window.location.origin).toString()

    document.title = title

    upsertMeta('meta[name="description"]', 'meta', { name: 'description', content: description })
    upsertMeta('meta[name="robots"]', 'meta', { name: 'robots', content: noIndex ? 'noindex,nofollow' : 'index,follow' })
    upsertMeta('link[rel="canonical"]', 'link', { rel: 'canonical', href: absoluteUrl })
    upsertMeta('meta[property="og:type"]', 'meta', { property: 'og:type', content: type })
    upsertMeta('meta[property="og:title"]', 'meta', { property: 'og:title', content: title })
    upsertMeta('meta[property="og:description"]', 'meta', { property: 'og:description', content: description })
    upsertMeta('meta[property="og:url"]', 'meta', { property: 'og:url', content: absoluteUrl })
    upsertMeta('meta[property="og:image"]', 'meta', { property: 'og:image', content: absoluteImage })
    upsertMeta('meta[name="twitter:card"]', 'meta', { name: 'twitter:card', content: 'summary_large_image' })
    upsertMeta('meta[name="twitter:title"]', 'meta', { name: 'twitter:title', content: title })
    upsertMeta('meta[name="twitter:description"]', 'meta', { name: 'twitter:description', content: description })
    upsertMeta('meta[name="twitter:image"]', 'meta', { name: 'twitter:image', content: absoluteImage })

    const scriptId = 'seo-structured-data'
    document.getElementById(scriptId)?.remove()

    if (structuredData) {
      const script = document.createElement('script')
      script.id = scriptId
      script.type = 'application/ld+json'
      script.textContent = JSON.stringify(structuredData)
      document.head.appendChild(script)
    }
  }, [description, image, noIndex, structuredData, title, type])

  return null
}
