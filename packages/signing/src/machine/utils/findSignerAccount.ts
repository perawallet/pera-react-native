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
    isSameAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'

/**
 * The wallet account holding `address` on `chainId`, compared the way that
 * chain compares addresses. An account's top-level address is its Algorand
 * one, so another chain's signer is only found here.
 */
export const findSignerAccount = (
    accounts: WalletAccount[],
    address: string,
    chainId: ChainId,
): Optional<WalletAccount> =>
    accounts.find(account => {
        const own = chainAccountOf(account, chainId)?.address
        return own !== undefined && isSameAddress(chainId, own, address)
    })
