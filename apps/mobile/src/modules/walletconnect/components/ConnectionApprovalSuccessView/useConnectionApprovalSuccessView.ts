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

import type { Connection } from '@perawallet/wallet-extension-connections'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useReturnToDapp } from '../../hooks/useReturnToDapp'

export type UseConnectionApprovalSuccessViewResult = {
    dAppName: string
    showReturnCta: boolean
    returnLabel: string
    handleReturnToDapp: () => void
}

/**
 * Drives the post-approval success sheet from the approved `Connection`.
 *
 * The new-stack sibling of `useConnectionSuccessContent`, which reads the
 * one-shot pairing context out of `useReturnToDappStore` keyed by clientId.
 * Here the handler wrote the origin into the record at approval, so the
 * record — not a transient store entry — is the source: it survives a
 * relaunch, and it is the same field the signing flow's hand-off reads.
 */
export const useConnectionApprovalSuccessView = (
    connection: Connection,
): UseConnectionApprovalSuccessViewResult => {
    const { t } = useLanguage()
    const { resolve } = useBottomSheetResult<boolean>()
    const { canReturnToDapp, returnToDapp } = useReturnToDapp()

    const dAppName = connection.peer.name
    const returnArgs = { browserName: connection.origin?.browserName }
    const showReturnCta =
        connection.origin?.source === 'external-browser' &&
        canReturnToDapp(returnArgs)

    const returnLabel = dAppName
        ? t('walletconnect.request.success_sheet_return_to_dapp', {
              name: dAppName,
          })
        : t('walletconnect.request.success_sheet_return_to_dapp_generic')

    const handleReturnToDapp = (): void => {
        void returnToDapp(returnArgs)
        // Overriding onConfirm suppresses ConfirmActionContent's default
        // resolve, so close the sheet ourselves.
        resolve(true)
    }

    return { dAppName, showReturnCta, returnLabel, handleReturnToDapp }
}
