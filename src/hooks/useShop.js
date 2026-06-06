import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useShop() {
  const { user } = useAuth()
  const [shop, setShop] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchShop = useCallback(async () => {
    if (!user) {
      setShop(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('shops')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (err) {
      setError(err.message)
      setShop(null)
    } else {
      setShop(data)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchShop()
  }, [fetchShop])

  async function createShop(name) {
    if (!user) throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.')

    const { data, error: err } = await supabase
      .from('shops')
      .insert({ name: name.trim(), owner_id: user.id })
      .select()
      .single()

    if (err) throw new Error(err.message)
    setShop(data)
    return data
  }

  async function updateShop(name) {
    if (!shop) throw new Error('Dükkan bulunamadı')

    const { data, error: err } = await supabase
      .from('shops')
      .update({ name: name.trim() })
      .eq('id', shop.id)
      .select()
      .single()

    if (err) throw new Error(err.message)
    setShop(data)
    return data
  }

  return { shop, loading, error, fetchShop, createShop, updateShop }
}
