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
    multisigParametersOf,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { MultisigSignRequest } from '@perawallet/wallet-core-multisig'
import type { Optional } from '@perawallet/wallet-core-shared'

const chainIdsOf = (account: WalletAccount): ChainId[] =>
    Object.keys(account.chains) as ChainId[]

/** The chain a held joint account lives on at `multisigAddress`, by the entry that stores its multisig parameters. */
export const chainIdOfJointAccount = (
    accounts: readonly WalletAccount[],
    multisigAddress: string,
): Optional<ChainId> => {
    for (const account of accounts) {
        const chainId = chainIdsOf(account).find(
            id =>
                account.chains[id]?.address === multisigAddress &&
                multisigParametersOf(account, id) !== undefined,
        )
        if (chainId) return chainId
    }
    return undefined
}

/**
 * The chain a backend sign request belongs to, which the backend doesn't say:
 * the held joint account's chain, else the chain of a held participant, since
 * a cosigner needn't have imported the joint account.
 */
export const chainIdOfMultisigSignRequest = (
    signRequest: MultisigSignRequest,
    accounts: readonly WalletAccount[],
): Optional<ChainId> => {
    const { address, participantAddresses } = signRequest.multisigAccount
    const jointChainId = chainIdOfJointAccount(accounts, address)
    if (jointChainId) return jointChainId
    const participants = new Set(participantAddresses)
    for (const account of accounts) {
        const chainId = chainIdsOf(account).find(id => {
            const held = account.chains[id]?.address
            return held !== undefined && participants.has(held)
        })
        if (chainId) return chainId
    }
    return undefined
}
