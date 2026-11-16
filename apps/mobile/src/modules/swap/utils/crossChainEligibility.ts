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

import {
    canSignWith,
    chainAccountOf,
    isMultisigAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'

/**
 * A shared account's swap finishes later, through the co-sign flow, with no
 * cross-chain order to track, so it stays on its own chain.
 */
export const canSwapCrossChain = (account: WalletAccount): boolean =>
    !isMultisigAccount(account)

/** Whether `candidate` can be paid a cross-chain swap's output on `chainId`. */
export const canReceiveCrossChain = (
    candidate: WalletAccount,
    accounts: WalletAccount[],
    chainId: ChainId,
): boolean =>
    // canSignWith can pass with no entry on the chain, leaving no address to pay.
    !!chainAccountOf(candidate, chainId) &&
    canSignWith(candidate, accounts, chainId)
