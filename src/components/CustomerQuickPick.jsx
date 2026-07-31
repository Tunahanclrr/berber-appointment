import { useMemo, useRef, useState } from 'react'
import { Contact, Search, Upload, Users } from 'lucide-react'
import Button from './ui/Button'
import Input from './ui/Input'
import { formatTurkishMobile } from '../lib/phone'
import { uniqueCustomerOptions } from '../lib/customers'

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

function unfoldVCard(text) {
  return String(text || '').replace(/\r?\n[ \t]/g, '')
}

function readVCardField(card, field) {
  const line = card
    .split(/\r?\n/)
    .find(item => item.toUpperCase().startsWith(field))

  return line?.split(':').slice(1).join(':').trim() || ''
}

function parseVCard(text) {
  const cards = unfoldVCard(text)
    .split(/END:VCARD/i)
    .map(card => card.trim())
    .filter(Boolean)

  return cards.map(card => ({
    name: readVCardField(card, 'FN') || readVCardField(card, 'N').replace(/;/g, ' ').trim(),
    phone: formatTurkishMobile(readVCardField(card, 'TEL')),
  })).filter(contact => contact.name && contact.phone)
}

export default function CustomerQuickPick({ customers = [], onSelect, onError }) {
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const fileInputRef = useRef(null)
  const contactPicker = getContactPicker()

  const uniqueCustomers = useMemo(() => uniqueCustomerOptions(customers, 120), [customers])
  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return uniqueCustomers.slice(0, 8)

    const queryDigits = normalizedQuery.replace(/\D/g, '')
    return uniqueCustomers
      .filter(customer =>
        customer.name.toLowerCase().includes(normalizedQuery) ||
        customer.phone.replace(/\D/g, '').includes(queryDigits)
      )
      .slice(0, 12)
  }, [query, uniqueCustomers])

  function selectCustomer(customer) {
    onSelect?.(customer)
    setQuery(customer.name)
    setShowResults(false)
  }

  async function pickFromContacts() {
    if (!contactPicker) {
      fileInputRef.current?.click()
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

      selectCustomer({
        name: getContactName(contact),
        phone,
      })
    } catch (error) {
      if (error?.name === 'AbortError') return
      onError?.(error?.message || 'Rehberden kisi secilemedi.')
    }
  }

  async function importVCard(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const text = await file.text()
      const contacts = parseVCard(text)
      if (contacts.length === 0) {
        onError?.('Secilen kisi dosyasinda telefon numarasi bulunamadi.')
        return
      }
      selectCustomer(contacts[0])
    } catch (error) {
      onError?.(error?.message || 'Kisi dosyasi okunamadi.')
    }
  }

  return (
    <div className="rounded-lg border border-gold/10 bg-gold/5 p-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".vcf,text/vcard,text/x-vcard"
        className="hidden"
        onChange={importVCard}
      />

      <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
        <Button type="button" variant="secondary" onClick={pickFromContacts}>
          {contactPicker ? (
            <Contact className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Upload className="h-4 w-4" aria-hidden="true" />
          )}
          Rehberden Sec
        </Button>

        <div className="relative">
          <Input
            label="Hazir musterilerde ara"
            value={query}
            onFocus={() => setShowResults(true)}
            onChange={event => {
              setQuery(event.target.value)
              setShowResults(true)
            }}
            placeholder="Isim veya telefon ara"
            autoComplete="off"
          />

          {showResults && filteredCustomers.length > 0 && (
            <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gold/10 bg-white shadow-xl">
              {filteredCustomers.map(customer => (
                <button
                  key={customer.phone}
                  type="button"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => selectCustomer(customer)}
                  className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-blue-50"
                >
                  <Users className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-cream">{customer.name}</span>
                    <span className="block font-mono text-xs text-cream-muted">{customer.phone}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {showResults && query && filteredCustomers.length === 0 && (
            <div className="absolute z-30 mt-1 w-full rounded-lg border border-gold/10 bg-white px-3 py-2 text-sm text-cream-muted shadow-xl">
              Musteri bulunamadi.
            </div>
          )}
        </div>
      </div>

      {!contactPicker && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-cream-muted">
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          iPhone/Safari rehbere direkt erisim vermeyebilir; kisi paylasimindan .vcf secerek veya hazir musterilerden arayarak devam edebilirsin.
        </p>
      )}
    </div>
  )
}
