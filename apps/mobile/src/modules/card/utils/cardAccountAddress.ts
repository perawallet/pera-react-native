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
    chainAccountOf,
    findAccountByAddressOn,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'

export class CardAccountAddressMissingError extends Error {
    constructor() {
        super('The account has no address on the card chain')
        this.name = 'CardAccountAddressMissingError'
    }
}

export const cardAccountAddressOf = (
    account: WalletAccount,
    chainId: ChainId,
): string | undefined => chainAccountOf(account, chainId)?.address

export const requireCardAccountAddress = (
    account: WalletAccount,
    chainId: ChainId,
): string => {
    const address = cardAccountAddressOf(account, chainId)
    if (address === undefined) throw new CardAccountAddressMissingError()
    return address
}

/** The wallet account holding a card address the store keeps (funding source, card owner). */
export const findCardAccount = (
    accounts: readonly WalletAccount[],
    address: Nullable<string>,
    chainId: ChainId,
): WalletAccount | undefined =>
    address ? findAccountByAddressOn(accounts, chainId, address) : undefined
