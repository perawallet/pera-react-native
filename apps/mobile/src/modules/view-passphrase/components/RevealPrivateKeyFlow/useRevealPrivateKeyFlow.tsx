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
import { useRevealPrivateKey } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { zeroBytes } from '@perawallet/wallet-core-kms'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useRequirePinVerification } from '@modules/security'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { RevealPrivateKeyContent } from '../RevealPrivateKeyContent'

export type UseRevealPrivateKeyFlowResult = {
    openRevealPrivateKeyFlow: (
        accountId: string,
        chainId: ChainId,
    ) => Promise<void>
}

/** PIN gate (if enabled), then the key in a capture-blocked sheet. */
export const useRevealPrivateKeyFlow = (): UseRevealPrivateKeyFlowResult => {
    const { revealPrivateKey } = useRevealPrivateKey()
    const { requirePinVerification } = useRequirePinVerification()
    const { request: requestBottomSheet } = useBottomSheet()
    const { showError } = useErrorToast()
    const { t } = useLanguage()

    const openRevealPrivateKeyFlow = useCallback(
        async (accountId: string, chainId: ChainId) => {
            let privateKey: Nullable<Uint8Array> = null
            try {
                privateKey = await revealPrivateKey(
                    accountId,
                    requirePinVerification,
                )
                if (!privateKey) return
                await requestBottomSheet<void>({
                    contents: (
                        <RevealPrivateKeyContent
                            privateKey={privateKey}
                            chainId={chainId}
                        />
                    ),
                    options: {
                        size: 'modal',
                        enablePanDownToClose: true,
                        autoCreateContainer: false,
                    },
                })
            } catch (error) {
                showError(error, t('reveal_private_key.error_title'))
            } finally {
                zeroBytes(privateKey)
            }
        },
        [
            revealPrivateKey,
            requirePinVerification,
            requestBottomSheet,
            showError,
            t,
        ],
    )

    return { openRevealPrivateKeyFlow }
}
