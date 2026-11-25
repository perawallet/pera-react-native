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
import { useAddTokenMutation } from '@perawallet/wallet-core-accounts'
import {
    DappRequestExplainedError,
    type ConfirmWatchAsset,
} from '@perawallet/wallet-core-connections'
import { generateUniqueId } from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    WatchAssetContent,
    type WatchAssetSheetResult,
} from '../components/WatchAssetContent'

/**
 * The sheet a dApp's watch-asset request waits on. Approving adds the token
 * here, so a failed add rejects the decision and the dApp hears of it.
 */
export const useWatchAssetPrompt = (): ConfirmWatchAsset => {
    const { request, dismiss } = useBottomSheet()
    const { addToken } = useAddTokenMutation()

    return useCallback(
        ({ scope, assetId, accountAddress, peer }) => {
            const id = generateUniqueId()
            const decision = request<WatchAssetSheetResult>({
                id,
                contents: (
                    <WatchAssetContent
                        scope={scope}
                        assetId={assetId}
                        accountAddress={accountAddress}
                        peer={peer}
                    />
                ),
                options: {
                    size: 'auto',
                    // Cancel rejects the dApp, so the sheet offers no third exit.
                    enablePanDownToClose: false,
                    enableCloseOnBackdropPress: false,
                },
            }).then(async result => {
                if (result === 'unreadable') {
                    throw new DappRequestExplainedError(
                        'No token could be read at this address on this network',
                    )
                }
                if (result !== 'add') return false
                await addToken({ accountAddress, scope, assetId })
                return true
            })
            return { decision, dismiss: () => dismiss(id) }
        },
        [request, dismiss, addToken],
    )
}
