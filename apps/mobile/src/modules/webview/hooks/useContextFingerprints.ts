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

import { useMemo } from 'react'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import type { ContextFingerprints } from './useNotifyWebViewOnContextChange'

/**
 * Computes fingerprints of the current settings and accounts state.
 * Used with `useNotifyWebViewOnContextChange` (via PWWebView's `contextFingerprints` prop)
 * to notify webviews only when values actually change.
 */
export function useContextFingerprints(): ContextFingerprints {
    const isDarkMode = useIsDarkMode()
    const { preferredCurrency } = useCurrency()
    const { network } = useNetwork()
    const { currentLanguage } = useLanguage()
    const accounts = useAllAccounts()

    return useMemo(
        () => ({
            settings: `${isDarkMode}-${preferredCurrency}-${network}-${currentLanguage}`,
            accounts: accounts.map(a => a.address).join(','),
        }),
        [isDarkMode, preferredCurrency, network, currentLanguage, accounts],
    )
}
