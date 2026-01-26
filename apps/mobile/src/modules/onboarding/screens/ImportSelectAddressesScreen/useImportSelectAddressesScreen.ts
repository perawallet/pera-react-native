/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useState, useMemo, useCallback } from 'react'
import { RouteProp, useRoute } from '@react-navigation/native'
import { OnboardingStackParamList } from '../../routes/types'
import {
  useAllAccounts,
  useAccountsStore,
  HDWalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useIsOnboarding } from '@modules/onboarding/hooks'


type ImportSelectAddressesRouteProp = RouteProp<
  OnboardingStackParamList,
  'ImportSelectAddresses'
>

export type UseImportSelectAddressesScreenResult = {
  accounts: HDWalletAccount[]
  selectedAddresses: Set<string>
  isAllSelected: boolean
  alreadyImportedAddresses: Set<string>
  toggleSelection: (address: string) => void
  toggleSelectAll: () => void
  handleContinue: () => void
  t: (key: string, options?: Record<string, unknown>) => string
}

export function useImportSelectAddressesScreen(): UseImportSelectAddressesScreenResult {
  const {
    params: { accounts },
  } = useRoute<ImportSelectAddressesRouteProp>()
  const { t } = useLanguage()
  const allAccounts = useAllAccounts()

  const { setIsOnboarding } = useIsOnboarding()

  const alreadyImportedAddresses = useMemo(() => {
    return new Set(allAccounts.map(acc => acc.address))
  }, [allAccounts])

  const newAccounts = useMemo(() => {
    return accounts.filter(acc => !alreadyImportedAddresses.has(acc.address))
  }, [accounts, alreadyImportedAddresses])

  const [selectedAddresses, setSelectedAddresses] = useState<Set<string>>(() =>
    new Set(newAccounts.map(acc => acc.address))
  )

  const isAllSelected = newAccounts.length > 0 && selectedAddresses.size === newAccounts.length

  const toggleSelection = useCallback((address: string) => {
    if (alreadyImportedAddresses.has(address)) return

    setSelectedAddresses(prev => {
      const next = new Set(prev)
      if (next.has(address)) {
        next.delete(address)
      } else {
        next.add(address)
      }
      return next
    })
  }, [alreadyImportedAddresses])

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedAddresses(new Set())
    } else {
      setSelectedAddresses(new Set(newAccounts.map(acc => acc.address)))
    }
  }, [isAllSelected, newAccounts])

  const handleContinue = useCallback(() => {
    const accountsToAdd = accounts.filter(acc => selectedAddresses.has(acc.address))

    if (accountsToAdd.length > 0) {
      const { setAccounts } = useAccountsStore.getState()
      setAccounts([...allAccounts, ...accountsToAdd])
    }

    setIsOnboarding(false)
  }, [accounts, selectedAddresses, allAccounts, setIsOnboarding])

  return {
    accounts,
    selectedAddresses,
    isAllSelected,
    alreadyImportedAddresses,
    toggleSelection,
    toggleSelectAll,
    handleContinue,
    t,
  }
}

