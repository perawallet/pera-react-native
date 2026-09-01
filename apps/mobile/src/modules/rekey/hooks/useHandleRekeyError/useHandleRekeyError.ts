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
import { useToast } from '@hooks/useToast'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import {
    RekeyError,
    type RekeyErrorReason,
} from '@perawallet/wallet-core-transactions'

type UseHandleRekeyErrorResult = (error: unknown) => void

const FALLBACK_TITLE_KEYS: Record<
    Exclude<RekeyErrorReason, 'user_rejected'>,
    string
> = {
    build_failed: 'rekey.errors.build_failed.title',
    signing_failed: 'rekey.errors.signing_failed.title',
    submission_failed: 'rekey.errors.submission_failed.title',
}

/**
 * Shared catch handler for the four rekey confirm screens. Branches on the
 * {@link RekeyError} reason so each failure stage gets its own copy:
 *
 *  - `user_rejected` is a non-fatal cancellation → dedicated toast.
 *  - every other reason → error toast with a stage-specific fallback title.
 *    The raw `originalError` is passed through so a recognized algod node
 *    error still gets its precise translation from `showError`.
 *
 * Anything that is not a RekeyError falls back to the generic error toast.
 */
export const useHandleRekeyError = (): UseHandleRekeyErrorResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const { showError } = useErrorToast()

    return useCallback(
        (error: unknown) => {
            if (!(error instanceof RekeyError)) {
                showError(error)
                return
            }

            if (error.reason === 'user_rejected') {
                showToast({
                    title: t('rekey.signing.user_rejected_title'),
                    body: t('rekey.signing.user_rejected_body'),
                    type: 'error',
                })
                return
            }

            showError(
                error.originalError ?? error,
                t(FALLBACK_TITLE_KEYS[error.reason]),
            )
        },
        [t, showToast, showError],
    )
}
