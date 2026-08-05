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

import { useMemo } from 'react'
import { config } from '@perawallet/wallet-core-config'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useAlgodErrorMessage } from '@hooks/useAlgodErrorMessage'
import { resolveErrorCopy } from '@i18n/resolveErrorCopy'

export type UseWalletConnectErrorContentResult = {
    /** Fully resolved, ready-to-render body — never pass this through t() again. */
    errorBody: string
}

const extractDebugCause = (cause: unknown): string | null => {
    if (typeof cause === 'string') return cause
    if (cause instanceof Error) return cause.message
    return null
}

export const useWalletConnectErrorContent = (
    error: Nullable<Error>,
): UseWalletConnectErrorContentResult => {
    const { t } = useLanguage()
    const { getMessage } = useAlgodErrorMessage()

    const errorBody = useMemo(() => {
        if (!error) return t('errors.walletconnect.unknown')

        const resolved = resolveErrorCopy(error, t, undefined, getMessage).body
        if (!config.debugEnabled) return resolved

        const cause = extractDebugCause(error.cause)
        return cause ? `${resolved}\n\nDebug: ${cause}` : resolved
    }, [error, t, getMessage])

    return { errorBody }
}
