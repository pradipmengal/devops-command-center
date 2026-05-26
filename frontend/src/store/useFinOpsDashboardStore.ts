import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FinOpsDashboardState {
  dashboardMode: string;
  setDashboardMode: (mode: string) => void;
}

/**
 * useFinOpsDashboardStore — persisted UI preferences for the FinOps Dashboard.
 * Only dashboardMode is persisted; all other state lives in CloudCostPage.jsx.
 */
const useFinOpsDashboardStore = create<FinOpsDashboardState>()(
  persist(
    (set) => ({
      dashboardMode: 'expanded', // 'expanded' | 'compact'
      setDashboardMode: (mode: string) => set({ dashboardMode: mode }),
    }),
    {
      name: 'finops-dashboard-store',
      partialize: (state: FinOpsDashboardState) => ({ dashboardMode: state.dashboardMode }),
    }
  )
)

export default useFinOpsDashboardStore
