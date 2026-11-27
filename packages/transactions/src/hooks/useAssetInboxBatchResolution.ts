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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import {
    isLedgerError,
    UserRejectedSigningError,
} from '@perawallet/wallet-core-signing'
import type { AssetInboxRequest } from '../chain-adapter'
import {
    shouldUseAssetInboxFunds,
    type AssetInboxResolution,
} from '../utils/assetInboxResolution'
import { useAssetInboxInvalidator } from './useAssetInboxInvalidator'
import { useTransactionSendFlow } from './useTransactionSendFlow'

export type AssetInboxBatchItemStatus =
    | 'waiting'
    | 'sending'
    | 'done'
    | 'failed'
    | 'cancelled'

export type ResolveAssetInboxBatchParams = {
    mode: AssetInboxResolution
    sender: WalletAccount
    requests: readonly AssetInboxRequest[]
    /** Called as each request, by its position in `requests`, changes status. */
    onStatus: (position: number, status: AssetInboxBatchItemStatus) => void
}

export type AssetInboxBatchResult = {
    doneCount: number
    failedCount: number
    /** The first failure, for the caller to explain; a declined signature isn't one. */
    firstError: Nullable<unknown>
    /** A declined signature or a Ledger device fault left the rest unsent. */
    isCancelled: boolean
}

export type UseAssetInboxBatchResolutionResult = {
    resolve: (
        params: ResolveAssetInboxBatchParams,
    ) => Promise<AssetInboxBatchResult>
}

/**
 * Claims or rejects inbox requests one group at a time. A failure doesn't stop
 * the batch; a declined signature or a Ledger device fault does. Asset inbox queries are removed once
 * it ends, since every request it touched has changed.
 */
export const useAssetInboxBatchResolution = (
    scope: ChainScope,
): UseAssetInboxBatchResolutionResult => {
    const { execute } = useTransactionSendFlow(scope)
    const { remove: removeAssetInboxQueries } = useAssetInboxInvalidator()

    const resolve = useCallback(
        async ({
            mode,
            sender,
            requests,
            onStatus,
        }: ResolveAssetInboxBatchParams): Promise<AssetInboxBatchResult> => {
            const result: AssetInboxBatchResult = {
                doneCount: 0,
                failedCount: 0,
                firstError: null,
                isCancelled: false,
            }
            // The inbox's native funds move to the account with the first
            // group that asks for them; a later group asking again would find
            // the inbox already drained.
            let haveInboxFundsMoved = false
            const cancelFrom = (start: number) => {
                for (let rest = start; rest < requests.length; rest++) {
                    onStatus(rest, 'cancelled')
                }
                result.isCancelled = true
            }

            for (const [position, request] of requests.entries()) {
                const shouldClaimAlgo =
                    !haveInboxFundsMoved &&
                    shouldUseAssetInboxFunds(request, mode)
                onStatus(position, 'sending')
                try {
                    await execute({
                        params: {
                            sendMode:
                                mode === 'claim'
                                    ? 'claimAssetInbox'
                                    : 'rejectAssetInbox',
                            sender,
                            asset: request.asset,
                            shouldClaimAlgo,
                            amount: request.totalAmount,
                            inboxAddress: request.inboxAddress,
                        },
                    })
                    if (shouldClaimAlgo) haveInboxFundsMoved = true
                    result.doneCount += 1
                    onStatus(position, 'done')
                } catch (error) {
                    if (error instanceof UserRejectedSigningError) {
                        cancelFrom(position)
                        break
                    }
                    logger.warn('Asset inbox batch item failed', { error })
                    result.failedCount += 1
                    result.firstError ??= error
                    onStatus(position, 'failed')
                    // The user has already been through the device's
                    // troubleshooting sheet; every later request would
                    // reopen it for the same fault.
                    if (isLedgerError(error)) {
                        cancelFrom(position + 1)
                        break
                    }
                }
            }

            removeAssetInboxQueries()
            return result
        },
        [execute, removeAssetInboxQueries],
    )

    return { resolve }
}
