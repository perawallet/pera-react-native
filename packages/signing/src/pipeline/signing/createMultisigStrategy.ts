/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type {
    WalletAccount,
    AuthAddressLookup,
} from '@perawallet/wallet-core-accounts'
import { isMultisigAccount } from '@perawallet/wallet-core-accounts'
import type { SigningStrategy, SigningResult, SignerInfo } from '../types'
import { NoLocalParticipantsError, SigningError } from '../errors'

export interface CreateMultisigStrategyOptions {
    /** Get local participants for a multisig account */
    getLocalParticipants: (
        account: WalletAccount,
        allAccounts: WalletAccount[],
        authAddresses: AuthAddressLookup,
    ) => WalletAccount[]

    /** Get signing strategy for an individual participant */
    getStrategyForParticipant: (
        participant: WalletAccount,
        allAccounts: WalletAccount[],
        authAddresses: AuthAddressLookup,
    ) => SigningStrategy

    /** Get all user accounts */
    getAllAccounts: () => WalletAccount[]

    /** Get the current on-chain auth-address lookup */
    getAuthAddresses: () => AuthAddressLookup
}

/**
 * Creates a signing strategy for multisig accounts.
 * Signs with all local participants in parallel and combines results.
 */
export const createMultisigStrategy = (
    options: CreateMultisigStrategyOptions,
): SigningStrategy => {
    const {
        getLocalParticipants,
        getStrategyForParticipant,
        getAllAccounts,
        getAuthAddresses,
    } = options

    return {
        canSign: (account: WalletAccount): boolean => {
            return isMultisigAccount(account)
        },

        sign: async (group, account, callbacks) => {
            if (group.data.type === 'arbitrary-data') {
                throw new SigningError(
                    'Multisig signing of arbitrary data is not supported',
                )
            }

            if (group.data.type === 'arc60') {
                throw new SigningError(
                    'Multisig signing of ARC-60 requests is not supported',
                )
            }

            const allAccounts = getAllAccounts()
            const authAddresses = getAuthAddresses()
            const localParticipants = getLocalParticipants(
                account,
                allAccounts,
                authAddresses,
            )

            if (localParticipants.length === 0) {
                throw new NoLocalParticipantsError(account.address)
            }

            // Sign with each local participant in parallel
            const participantResults = await Promise.all(
                localParticipants.map(async participant => {
                    const strategy = getStrategyForParticipant(
                        participant,
                        allAccounts,
                        authAddresses,
                    )
                    return strategy.sign(group, participant, callbacks)
                }),
            )

            return combineParticipantSignatures(participantResults)
        },
    }
}

/**
 * Combines signatures from multiple participants into a single result.
 * Uses the first result's signed data and flattens all signer info.
 */
const combineParticipantSignatures = (
    results: SigningResult[],
): SigningResult => {
    if (results.length === 0) {
        throw new Error('No participant results to combine')
    }

    const firstResult = results[0]
    const allSigners: SignerInfo[] = results.flatMap(r => r.signers)

    return {
        signedData: firstResult.signedData,
        signers: allSigners,
    }
}
