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

import type { TransactionRecord } from '@perawallet/wallet-core-chain-contract'
import { isNativeAssetId } from '@perawallet/wallet-core-assets'
import { isFeePaidByAccount } from './fee'

const involvesAsset = (record: TransactionRecord, assetId: string): boolean =>
    record.summary.amount?.assetRef.assetId === assetId ||
    (record.summary.balanceChanges ?? []).some(
        change => change.assetRef.assetId === assetId,
    )

const movesNothing = ({ summary }: TransactionRecord): boolean =>
    summary.amount === undefined && !summary.balanceChanges?.length

/**
 * Gas is paid in the native asset, so its history also keeps the calls the
 * account paid for that moved nothing else: approvals and failed calls.
 */
export const isRecordInAssetHistory = (
    record: TransactionRecord,
    assetId: string,
    accountAddress: string,
): boolean =>
    involvesAsset(record, assetId) ||
    (isNativeAssetId(record.scope.chainId, assetId) &&
        movesNothing(record) &&
        isFeePaidByAccount(record, accountAddress))
