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
import {
    isUniqueCollectible,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { logger } from '@perawallet/wallet-core-shared'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useSendFunds } from './useSendFunds'
import { useSendScope } from './useSendScope'

// Stable id so a second request while the prompt is open (a double tap, or
// Android back pressed twice) is ignored by the sheet store.
const SEND_DISCARD_SHEET_ID = 'send-discard'

export type UseSendFlowCloseResult = {
    requestClose: () => void
}

export const useSendFlowClose = (): UseSendFlowCloseResult => {
    const { t } = useLanguage()
    const scope = useSendScope()
    const {
        amount,
        destination,
        prefilledDestination,
        hasUnsavedInput,
        selectedAssetId,
        onFinished,
    } = useSendFunds()
    const { request: requestBottomSheet } = useBottomSheet()
    const { data: assets } = useAssetsQuery(
        scope,
        selectedAssetId ? [selectedAssetId] : [],
    )
    const selectedAsset = selectedAssetId
        ? assets.get(selectedAssetId)
        : undefined

    // A unique collectible's amount of 1 is filled in for the user, so it
    // doesn't count as something they entered.
    const hasEnteredAmount =
        !!amount && !(selectedAsset && isUniqueCollectible(selectedAsset))
    const hasPickedRecipient =
        !!destination && destination !== prefilledDestination
    const hasEnteredInput =
        hasEnteredAmount || hasUnsavedInput || hasPickedRecipient

    const requestClose = useCallback(() => {
        if (!hasEnteredInput) {
            onFinished?.()
            return
        }
        void (async () => {
            try {
                const shouldDiscard = await requestBottomSheet<boolean>({
                    id: SEND_DISCARD_SHEET_ID,
                    contents: (
                        <ConfirmActionContent
                            icon='trash'
                            iconVariant='error'
                            title={t('send_funds.discard.title')}
                            message={t('send_funds.discard.body')}
                            isMessageCentered
                            confirmLabel={t('send_funds.discard.confirm')}
                            confirmVariant='destructiveLight'
                            cancelLabel={t('common.cancel.label')}
                            testID='send_discard_sheet'
                            confirmTestID='send_discard_confirm'
                            cancelTestID='send_discard_cancel'
                        />
                    ),
                    options: { size: 'auto', enablePanDownToClose: true },
                })
                if (shouldDiscard) onFinished?.()
            } catch (error) {
                // Fail open: `request` rejects when no sheet host is
                // mounted, and the user must still be able to leave.
                logger.error(
                    'useSendFlowClose: could not confirm discarding the send',
                    { error },
                )
                onFinished?.()
            }
        })()
    }, [hasEnteredInput, onFinished, requestBottomSheet, t])

    return { requestClose }
}
