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
import type { SigningScheme } from '@perawallet/wallet-core-chain-contract'
import type { MultisigParameters } from '@perawallet/wallet-core-multisig'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandMultisigNative } from './multisig-native'
import { algorandAddressOf, isQuantumAccount } from './vocabulary'

/** The multisig parameters an account carries on Algorand; `undefined` when a legacy record lacks them. */
export const algorandMultisigOf = (
    account: WalletAccount,
): MultisigParameters | undefined =>
    algorandMultisigNative.parametersOf(
        chainAccountOf(account, ALGORAND_CHAIN_ID)?.native,
    )

/**
 * Multisig slots verify Ed25519 subsignatures only, and algosdk's PQ signer
 * rejects multisig signing outright.
 */
export const acceptsAlgorandParticipantScheme = (
    scheme: SigningScheme,
): boolean => scheme === 'ed25519'

/**
 * The held account at `address` when it can contribute its own subsignature.
 * Slots bind to the participant's own pubkey, so rekey indirection is not
 * followed, and a quantum key never counts: see
 * {@link acceptsAlgorandParticipantScheme}.
 */
export const signableParticipantAt = (
    address: string,
    accounts: readonly WalletAccount[],
): WalletAccount | undefined => {
    const participant = accounts.find(
        account => algorandAddressOf(account) === address,
    )
    return participant &&
        !isQuantumAccount(participant) &&
        canSignDirectly(participant)
        ? participant
        : undefined
}

/** Multisig signing is propose-based, so one local signable participant is enough. */
export const canSignViaParticipants = (
    participantAddresses: readonly string[],
    accounts: readonly WalletAccount[],
): boolean =>
    participantAddresses.some(
        address => signableParticipantAt(address, accounts) !== undefined,
    )

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
