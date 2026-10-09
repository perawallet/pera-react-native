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
    canSignDirectly,
    chainAccountOf,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { MultisigParameters } from '@perawallet/wallet-core-multisig'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandMultisigAdapter } from '../multisig/adapter'
import { algorandAddressOf, isQuantumAccount } from './vocabulary'

/** The multisig parameters an account carries on Algorand; `undefined` when a legacy record lacks them. */
export const algorandMultisigOf = (
    account: WalletAccount,
): MultisigParameters | undefined =>
    algorandMultisigAdapter.parametersOf(
        chainAccountOf(account, ALGORAND_CHAIN_ID)?.native,
    )

/**
 * Multisig signing is propose-based, so one local signable participant is
 * enough. Slots bind to the participant's own pubkey, so rekey indirection is
 * not followed. Quantum participants never count — slots verify Ed25519 only.
 */
export const canSignViaParticipants = (
    participantAddresses: readonly string[],
    accounts: readonly WalletAccount[],
): boolean =>
    participantAddresses.some(address => {
        const participant = accounts.find(
            account => algorandAddressOf(account) === address,
        )
        return (
            !!participant &&
            !isQuantumAccount(participant) &&
            canSignDirectly(participant)
        )
    })

/** Whether a held account can propose for the multisig; false while its parameters are unknown. */
export const hasLocalCoSigner = (
    multisig: WalletAccount,
    accounts: readonly WalletAccount[],
): boolean => {
    const parameters = algorandMultisigOf(multisig)
    return (
        !!parameters && canSignViaParticipants(parameters.addresses, accounts)
    )
}
