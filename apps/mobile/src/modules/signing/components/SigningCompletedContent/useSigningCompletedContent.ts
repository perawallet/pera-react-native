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

import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useReturnToDapp } from '@modules/walletconnect/hooks/useReturnToDapp'

export type SigningReturnToDapp = {
    browserName?: string
    dappUrl?: string
    dappName?: string
    dappIconUrl?: string
}

export type UseSigningCompletedContentResult = {
    showReturnCta: boolean
    returnLabel: string
    handleReturnToDapp: () => void
}

export const useSigningCompletedContent = (
    returnToDappInfo?: SigningReturnToDapp,
): UseSigningCompletedContentResult => {
    const { t } = useLanguage()
    const { resolve } = useBottomSheetResult<boolean>()
    const { canReturnToDapp, returnToDapp } = useReturnToDapp()

    const returnArgs = {
        browserName: returnToDappInfo?.browserName,
        dappUrl: returnToDappInfo?.dappUrl,
    }
    const showReturnCta = !!returnToDappInfo && canReturnToDapp(returnArgs)

    const returnLabel = returnToDappInfo?.dappName
        ? t('walletconnect.request.success_sheet_return_to_dapp', {
              name: returnToDappInfo.dappName,
          })
        : t('walletconnect.request.success_sheet_return_to_dapp_generic')

    const handleReturnToDapp = (): void => {
        void returnToDapp(returnArgs)
        // Overriding onConfirm suppresses ConfirmActionContent's default
        // resolve, so close the sheet ourselves.
        resolve(true)
    }

    return { showReturnCta, returnLabel, handleReturnToDapp }
}
