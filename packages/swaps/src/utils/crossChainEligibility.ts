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
    accountChainOptions,
    canSignWith,
    findAccountByAddressOn,
    isMultisigAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'

/**
 * A shared account's swap finishes later, through the co-sign flow, with no
 * cross-chain order to track, so it stays on its own chain.
 */
export const canSwapCrossChain = (account: WalletAccount): boolean =>
    !isMultisigAccount(account)

/**
 * The address a cross-chain swap from `account` pays out to on `chainId`. An
 * enabled chain gives its own address; a not-enabled chain in a family the
 * account already holds gives the family address, which enabling it gives the
 * account, unless another account already holds that address there, since
 * enabling then fails with `DuplicateAccountError`.
 */
export const swapPayoutAddressOn = (
    account: WalletAccount,
    accounts: WalletAccount[],
    chainId: ChainId,
): Optional<string> => {
    const option = accountChainOptions(account, id => id === chainId).at(0)
    if (option?.address === undefined) return undefined
    // canSignWith can pass with no entry on the chain, so only an enabled one is checked.
    if (option.isEnabled) {
        return canSignWith(account, accounts, chainId)
            ? option.address
            : undefined
    }
    return findAccountByAddressOn(accounts, chainId, option.address)
        ? undefined
        : option.address
}
