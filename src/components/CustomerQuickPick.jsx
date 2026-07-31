import { useMemo, useState } from 'react'
import { Contact, Users } from 'lucide-react'
import Button from './ui/Button'
import Select from './ui/Select'
import { formatTurkishMobile } from '../lib/phone'

function getContactPicker() {
  if (typeof navigator === 'undefined') return null
  return typeof navigator.contacts?.select === 'function' ? navigator.contacts : null
}

function getContactName(contact) {
  const name = Array.isArray(contact?.name) ? contact.name[0] : contact?.name
  return String(name || '').trim()
}

function getContactPhone(contact) {
  const phone = Array.isArray(contact?.tel) ? contact.tel[0] : contact?.tel
  return formatTurkishMobile(phone || '')
}

export default function CustomerQuickPick({ customers = [], onSelect, onError }) {
  const [selectedPhone, setSelectedPhone] = useState('')
  const contactPicker = getContactPicker()

  const uniqueCustomers = useMemo(() => {
    const seen = new Set()
    return customers
      .map(customer => ({
        name: String(customer.name || '').trim(),
        phone: formatTurkishMobile(customer.phone || ''),
      }))
      .filter(customer => customer.name && customer.phone)
      .filter(customer => {
        const key = customer.phone.replace(/\D/g, '')
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 80)
  }, [customers])

  async function pickFromContacts() {
    if (!contactPicker) {
      onError?.('Bu cihaz veya tarayici rehber secimini desteklemiyor.')
      return
    }

    try {
      const contacts = await contactPicker.select(['name', 'tel'], { multiple: false })
      const contact = contacts?.[0]
      const phone = getContactPhone(contact)

      if (!phone) {
        onError?.('Secilen kiside telefon numarasi bulunamadi.')
        return
      }

      onSelect?.({
        name: getContactName(contact),
        phone,
      })
      setSelectedPhone('')
    } catch (error) {
      if (error?.name === 'AbortError') return
      onError?.(error?.message || 'Rehberden kisi secilemedi.')
    }
  }

  function pickSavedCustomer(phone) {
    setSelectedPhone(phone)
    const customer = uniqueCustomers.find(item => item.phone === phone)
    if (!customer) return
    onSelect?.(customer)
  }

  if (!contactPicker && uniqueCustomers.length === 0) return null

  return (
    <div className="rounded-lg border border-gold/10 bg-gold/5 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {contactPicker && (
          <Button type="button" variant="secondary" onClick={pickFromContacts}>
            <Contact className="h-4 w-4" aria-hidden="true" />
            Rehberden Sec
          </Button>
        )}

        {uniqueCustomers.length > 0 && (
          <Select
            label="Kayitli musteriler"
            value={selectedPhone}
            onChange={event => pickSavedCustomer(event.target.value)}
          >
            <option value="">Musteri sec</option>
            {uniqueCustomers.map(customer => (
              <option key={customer.phone} value={customer.phone}>
                {customer.name} - {customer.phone}
              </option>
            ))}
          </Select>
        )}
      </div>

      {!contactPicker && uniqueCustomers.length > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-cream-muted">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          Rehber secimi desteklenmeyen cihazlarda kayitli musterilerden devam edebilirsin.
        </p>
      )}
    </div>
  )
}
