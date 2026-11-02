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

import type { HdIndex, WalletAccount } from './models'
import { hdIndexOf } from './credentials'
import { ACCOUNT_GAP_LIMIT } from './hd-walk'

/** An HD position on one seed; `walletId` is the keystore id of the bip39 seed. */
export type HdWalletSlot = HdIndex & { walletId: string }

/**
 * The next account on `seedKeyId`, given only that seed's accounts, on keyIndex 0 past every
 * existing `accountNumberOf`. On a seed with keyIndex-axis accounts that can skip account indexes,
 * so the skip is capped below discovery's gap limit; past the cap a number can still repeat.
 */
export const nextHdSlotForSeed = (
    seedKeyId: string,
    seedAccounts: readonly WalletAccount[],
): HdWalletSlot => {
    const indexes = seedAccounts.flatMap(a => hdIndexOf(a) ?? [])
    if (indexes.length === 0)
        return { walletId: seedKeyId, account: 0, keyIndex: 0 }
    const highestAccount = Math.max(...indexes.map(hd => hd.account))
    const highestNumber = Math.max(
        ...indexes.map(hd => hd.account + hd.keyIndex),
    )
    return {
        walletId: seedKeyId,
        account: Math.min(
            highestNumber + 1,
            highestAccount + ACCOUNT_GAP_LIMIT,
        ),
        keyIndex: 0,
    }
}
