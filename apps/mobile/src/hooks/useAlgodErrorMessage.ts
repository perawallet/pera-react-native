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

import { useCallback } from 'react'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    describeNodeError,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { ErrorCopy } from '@i18n/resolveErrorCopy'
import { useLanguage } from './useLanguage'

type UseAlgodErrorMessageResult = {
    getMessage: (err: unknown) => Optional<ErrorCopy>
}

// i18n interpolation doesn't accept bigint — convert to string at the boundary.
const toInterpolationParams = (
    params: Readonly<Record<string, unknown>>,
): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(params)) {
        out[k] = typeof v === 'bigint' ? v.toString() : v
    }
    return out
}

/**
 * Maps a node error to a localized `{ title, body }` pair suitable for the
 * toast system, or `undefined` when the chain has no copy for it.
 */
export const useAlgodErrorMessage = (): UseAlgodErrorMessageResult => {
    const { t } = useLanguage()

    const getMessage = useCallback(
        (err: unknown): Optional<ErrorCopy> => {
            const copy = describeNodeError(LEGACY_CHAIN_ID, err)
            if (!copy) return undefined
            return {
                title: t(copy.titleKey),
                body: t(copy.bodyKey, toInterpolationParams(copy.params)),
            }
        },
        [t],
    )

    return { getMessage }
}
