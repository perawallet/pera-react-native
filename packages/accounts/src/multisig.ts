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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    multisigChainAdapters,
    type MultisigParameters,
} from '@perawallet/wallet-core-multisig'
import { chainAccountOf } from './credentials/accessors'
import type { WalletAccount } from './models'

/** The multisig parameters the account stores on `chainId`; `undefined` for a non-multisig, a chain without multisig, or a legacy record that lacks them. */
export const multisigParametersOf = (
    account: WalletAccount,
    chainId: ChainId,
): MultisigParameters | undefined => {
    if (account.custody.kind !== 'multisig') return undefined
    if (!multisigChainAdapters.has(chainId)) return undefined
    return multisigChainAdapters
        .get(chainId)
        .parametersOf(chainAccountOf(account, chainId)?.native)
}

/** The account with `parameters` stored on its `chainId` entry; unchanged when it has no entry there. */
export const withMultisigParameters = (
    account: WalletAccount,
    chainId: ChainId,
    parameters: MultisigParameters,
): WalletAccount => {
    const entry = chainAccountOf(account, chainId)
    if (!entry) return account
    return {
        ...account,
        chains: {
            ...account.chains,
            [chainId]: {
                ...entry,
                native: multisigChainAdapters.get(chainId).toNative(parameters),
            },
        },
    }
}
