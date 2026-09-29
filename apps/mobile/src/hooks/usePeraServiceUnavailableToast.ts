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
import { useLanguage } from '@hooks/useLanguage'
import { useErrorToast } from '@hooks/useErrorToast'
import { setOnPeraBackendUnavailable } from '@providers/queryClient'

/**
 * Surfaces one "not available on this network" toast the first time a
 * `backend: 'pera'` request raises `PeraServiceUnavailableError` (a Pera
 * request made on BetaNet or a custom node) for a given scope.
 *
 * Deduped per scope because an ungated Pera query — the preferred-currency
 * price query behind every fiat value — fires the error once per mount, which
 * would otherwise toast on every screen change.
 */
export const usePeraServiceUnavailableToast = (): void => {
    const { t } = useLanguage()
    const { showError } = useErrorToast()

    // Register once and always call the latest callbacks: `showError`'s
    // identity changes on every render (makeStyles memoizes on a fresh
    // topInset literal), so re-registering per render would churn the
    // singleton handler needlessly.
    const showErrorRef = useRef(showError)
    const tRef = useRef(t)
    useEffect(() => {
        showErrorRef.current = showError
        tRef.current = t
    })

    const notifiedScopesRef = useRef<Set<string>>(new Set())

    useEffect(() => {
        return setOnPeraBackendUnavailable(error => {
            const scopeKey = `${error.scope.chainId}/${error.scope.networkId}`
            if (notifiedScopesRef.current.has(scopeKey)) {
                return
            }
            notifiedScopesRef.current.add(scopeKey)
            showErrorRef.current(
                error,
                tRef.current('common.network_unavailable.title'),
            )
        })
    }, [])
}
