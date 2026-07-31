import { formatTurkishMobile, normalizeTurkishMobile } from './phone'

function isMissingCustomerTable(error) {
  return error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    error?.message?.toLowerCase().includes('customers')
}

export function normalizeCustomerOption(customer) {
  return {
    name: String(customer?.name || customer?.customer_name || '').trim(),
    phone: formatTurkishMobile(customer?.phone || customer?.customer_phone || ''),
  }
}

export function uniqueCustomerOptions(customers, limit = 100) {
  const seen = new Set()
  return (customers || [])
    .map(normalizeCustomerOption)
    .filter(customer => customer.name && customer.phone)
    .filter(customer => {
      const key = normalizeTurkishMobile(customer.phone)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
}

export async function loadCustomerOptions({ supabase, shopId, employeeId, limit = 200 }) {
  if (!shopId) return []

  const { data: savedCustomers, error: customersError } = await supabase
    .from('customers')
    .select('name, phone, updated_at')
    .eq('shop_id', shopId)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (!customersError) return uniqueCustomerOptions(savedCustomers, limit)
  if (!isMissingCustomerTable(customersError)) throw customersError

  let query = supabase
    .from('appointments')
    .select('customer_name, customer_phone, created_at')
    .eq('shop_id', shopId)
    .not('customer_phone', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (employeeId) query = query.eq('employee_id', employeeId)

  const { data, error } = await query
  if (error) throw error
  return uniqueCustomerOptions(data, limit)
}

export async function upsertCustomer({ supabase, shopId, name, phone }) {
  const normalizedName = String(name || '').trim()
  const normalizedPhone = normalizeTurkishMobile(phone)

  if (!shopId || !normalizedName || !normalizedPhone) return

  const { error } = await supabase
    .from('customers')
    .upsert({
      shop_id: shopId,
      name: normalizedName,
      phone: normalizedPhone,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'shop_id,phone' })

  if (error && !isMissingCustomerTable(error)) throw error
}
