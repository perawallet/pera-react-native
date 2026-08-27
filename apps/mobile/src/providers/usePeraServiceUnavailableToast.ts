/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useEffect, useRef } from 'react'
import { type Network } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { setOnPeraBackendUnavailable } from './queryClient'

/**
 * Surfaces a single "not available on this network" toast the first time a
 * `backend: 'pera'` request raises `PeraServiceUnavailableError` (i.e. a Pera
 * request was made on BetaNet or a custom node) for a given network.
 *
 * Deduped per network because an ungated Pera query — `useCurrenciesQuery`
 * mounts on any screen with a fiat value — fires the error once per mount,
 * which would otherwise toast on every screen change.
 */
export const usePeraServiceUnavailableToast = (): void => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const lastNotifiedRef = useRef<Network | null>(null)

    useEffect(() => {
        return setOnPeraBackendUnavailable(network => {
            if (lastNotifiedRef.current === network) {
                return
            }
            lastNotifiedRef.current = network
            showToast({
                title: t('common.network_unavailable.title'),
                body: t('common.network_unavailable.body'),
                type: 'info',
            })
        })
    }, [showToast, t])
}
