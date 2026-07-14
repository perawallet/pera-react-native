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

import { useCallback } from 'react'
import { AlgodError, toAlgodError } from '@perawallet/wallet-core-blockchain'
import { useLanguage } from './useLanguage'

type UseAlgodErrorMessageResult = {
    getMessage: (err: unknown) => { title: string; body: string }
}

// i18n interpolation doesn't accept bigint — convert to string at the boundary.
const toInterpolationParams = (
    params: Record<string, unknown>,
): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(params)) {
        out[k] = typeof v === 'bigint' ? v.toString() : v
    }
    return out
}

/**
 * Maps an algod/indexer error to a localized `{ title, body }` pair suitable
 * for the toast system. Accepts anything — raw Errors are routed through
 * `toAlgodError` first.
 */
export const useAlgodErrorMessage = (): UseAlgodErrorMessageResult => {
    const { t } = useLanguage()

    const getMessage = useCallback(
        (err: unknown): { title: string; body: string } => {
            const algodError =
                err instanceof AlgodError ? err : toAlgodError(err)

            // Offline is a single source of truth — algod's
            // network_unavailable and the PeraNetworkError 'offline' kind
            // share the same copy.
            if (algodError.code === 'network_unavailable') {
                return {
                    title: t('errors.network.no_connection.title'),
                    body: t('errors.network.no_connection.body'),
                }
            }

            const params = toInterpolationParams(algodError.params)
            return {
                title: t(`errors.algod.${algodError.code}.title`),
                body: t(`errors.algod.${algodError.code}.body`, params),
            }
        },
        [t],
    )

    return { getMessage }
}
