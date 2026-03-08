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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { Network } from '@perawallet/wallet-core-shared'
import type {
    DataPipeline,
    DataSource,
    DataAnalyzer,
    DataTransport,
    SigningStrategy,
    PipelineCallbacks,
    AnalyzedSignableGroup,
    TransportResult,
    SigningResult,
    SignerInfo,
} from './types'
import { UserCancelledError, NoLocalParticipantsError } from './errors'
import { isMultisigAccount } from '@perawallet/wallet-core-accounts'

/**
 * Options for creating a pipeline
 */
export interface CreatePipelineOptions<TSourceParams> {
    /** The data source */
    source: DataSource<TSourceParams>

    /** The analyzer (optional) */
    analyzer?: DataAnalyzer

    /** Override transport selection (optional) */
    transport?: DataTransport

    /** Get signing strategy for an account */
    getSigningStrategy: (
        account: WalletAccount,
        allAccounts: WalletAccount[],
    ) => SigningStrategy

    /** Get transport for the result */
    getTransport: (
        source: { type: string },
        account: WalletAccount,
    ) => DataTransport

    /** Get all user accounts */
    getAllAccounts: () => WalletAccount[]

    /** Get current network */
    getNetwork: () => Network

    /** Get local participants for a multisig account */
    getLocalParticipants: (
        account: WalletAccount,
        allAccounts: WalletAccount[],
    ) => WalletAccount[]

    /** UI callbacks */
    callbacks?: PipelineCallbacks
}

/**
 * Creates a transaction pipeline that executes the full flow:
 * source -> analyze -> sign -> transport
 */
export const createPipeline = <TSourceParams>(
    options: CreatePipelineOptions<TSourceParams>,
): DataPipeline<TSourceParams> => {
    const {
        source,
        analyzer,
        transport: overrideTransport,
        getSigningStrategy,
        getTransport,
        getAllAccounts,
        getNetwork,
        getLocalParticipants,
        callbacks,
    } = options

    return {
        execute: async (
            params: TSourceParams,
            account: WalletAccount,
        ): Promise<TransportResult> => {
            callbacks?.onSigningStart?.()

            try {
                // Stage 1: SOURCE - Get signable data
                const signableGroup = await source.getSignableData(params)

                // Stage 2: ANALYZE - Inspect the data
                const allAccounts = getAllAccounts()
                const network = getNetwork()

                let analyzedGroup: AnalyzedSignableGroup

                if (analyzer) {
                    const analysis = await analyzer.analyze(signableGroup, {
                        network,
                        accounts: allAccounts,
                    })

                    analyzedGroup = {
                        ...signableGroup,
                        analysis,
                    }

                    // Notify about warnings
                    if (analysis.warnings.length > 0) {
                        callbacks?.onWarnings?.(analysis.warnings)
                    }
                } else {
                    // No analyzer provided - create minimal analysis
                    analyzedGroup = {
                        ...signableGroup,
                        analysis: {
                            totalFees: 0n,
                            transactionSummaries: [],
                            warnings: [],
                            signableAddresses: [account.address],
                            riskLevel: 'low',
                        },
                    }
                }

                // Confirmation UI (user sees analysis results)
                if (callbacks?.onConfirmationRequired) {
                    const confirmed =
                        await callbacks.onConfirmationRequired(analyzedGroup)
                    if (!confirmed) {
                        throw new UserCancelledError()
                    }
                }

                // Stage 3: SIGN - Authorize the data
                let signingResult: SigningResult

                if (isMultisigAccount(account)) {
                    // For multisig: sign with all local participants
                    const localParticipants = getLocalParticipants(
                        account,
                        allAccounts,
                    )

                    if (localParticipants.length === 0) {
                        throw new NoLocalParticipantsError(account.address)
                    }

                    // Sign with each local participant
                    const participantResults = await Promise.all(
                        localParticipants.map(async participant => {
                            const strategy = getSigningStrategy(
                                participant,
                                allAccounts,
                            )
                            return strategy.sign(
                                analyzedGroup,
                                participant,
                                callbacks,
                            )
                        }),
                    )

                    // Combine participant signatures
                    signingResult =
                        combineParticipantSignatures(participantResults)
                } else {
                    // For regular accounts: sign directly
                    const strategy = getSigningStrategy(account, allAccounts)
                    signingResult = await strategy.sign(
                        analyzedGroup,
                        account,
                        callbacks,
                    )
                }

                // Stage 4: TRANSPORT - Deliver the signed data
                const transport =
                    overrideTransport ??
                    getTransport(signableGroup.source, account)

                const result = await transport.send(
                    signingResult,
                    signableGroup.source,
                    isMultisigAccount(account) ? account.address : undefined,
                )

                callbacks?.onSigningComplete?.()
                return result
            } catch (error) {
                if (error instanceof Error) {
                    callbacks?.onError?.(error)
                }
                throw error
            }
        },
    }
}

/**
 * Combines signatures from multiple participants into a single result
 */
const combineParticipantSignatures = (
    results: SigningResult[],
): SigningResult => {
    if (results.length === 0) {
        throw new Error('No participant results to combine')
    }

    // Use the first result as the base
    const firstResult = results[0]

    // Combine signer info from all participants
    const allSigners: SignerInfo[] = results.flatMap(r => r.signers)

    return {
        signedData: firstResult.signedData,
        signers: allSigners,
    }
}
