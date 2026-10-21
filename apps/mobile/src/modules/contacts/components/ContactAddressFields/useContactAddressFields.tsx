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

import { useCallback, useEffect, useMemo } from 'react'
import { Keyboard } from 'react-native'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { AddressFamilyMatch } from '@perawallet/wallet-core-contacts'
import type { Optional } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet } from '@modules/bottom-sheet'
import { chainFamilyDisplay } from '@modules/chain-ui'

export type UseContactAddressFieldsParams = {
    pendingReplacement: Optional<AddressFamilyMatch>
    onAddressInputChange: (text: string) => void
    confirmReplacement: () => void
    cancelReplacement: () => void
}

export type UseContactAddressFieldsResult = {
    /** Every registered chain, so a scan of any of them is taken. */
    scanChainIds: readonly ChainId[]
    handlePaste: () => Promise<void>
}

export const useContactAddressFields = ({
    pendingReplacement,
    onAddressInputChange,
    confirmReplacement,
    cancelReplacement,
}: UseContactAddressFieldsParams): UseContactAddressFieldsResult => {
    const { t } = useLanguage()
    const { readText } = useClipboard()
    const { request } = useBottomSheet()

    const scanChainIds = useMemo(
        () =>
            getProvider()
                .chains.list()
                .map(({ id }) => id),
        [],
    )

    const handlePaste = useCallback(async () => {
        onAddressInputChange(await readText())
    }, [onAddressInputChange, readText])

    useEffect(() => {
        if (!pendingReplacement) return
        // Presenting a sheet isn't a nav blur, so the keyboard stays over it.
        Keyboard.dismiss()
        const network = chainFamilyDisplay(pendingReplacement.family, t).label
        void (async () => {
            const isConfirmed = await request<boolean>({
                contents: (
                    <ConfirmActionContent
                        icon='swap'
                        title={t('contacts.edit_contact.replace_title', {
                            network,
                        })}
                        message={t('contacts.edit_contact.replace_message', {
                            network,
                        })}
                        confirmLabel={t(
                            'contacts.edit_contact.replace_confirm',
                        )}
                        cancelLabel={t('contacts.edit_contact.replace_cancel')}
                        confirmTestID='contact_replace_confirm_button'
                        cancelTestID='contact_replace_cancel_button'
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (isConfirmed) confirmReplacement()
            else cancelReplacement()
        })()
    }, [pendingReplacement, request, t, confirmReplacement, cancelReplacement])

    return { scanChainIds, handlePaste }
}
