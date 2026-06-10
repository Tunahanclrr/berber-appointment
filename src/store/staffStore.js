import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useStaffStore = create(
  persist(
    (set) => ({
      token: null,
      employeeId: null,
      employeeName: null,
      shopId: null,
      shopName: null,
      role: null,
      expiresAt: null,

      setSession: (data) => set({
        token: data.session_token,
        employeeId: data.employee_id,
        employeeName: data.employee_name,
        shopId: data.shop_id,
        shopName: data.shop_name,
        role: data.role,
        expiresAt: data.expires_at,
      }),

      clearSession: () => set({
        token: null,
        employeeId: null,
        employeeName: null,
        shopId: null,
        shopName: null,
        role: null,
        expiresAt: null,
      }),

      isValid: () => {
        const state = useStaffStore.getState()
        return Boolean(state.token)
      },
    }),
    { name: 'berber-staff-session' }
  )
)
