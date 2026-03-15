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
} from './types'
import { UserCancelledError } from './errors'
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
                const strategy = getSigningStrategy(account, allAccounts)
                const signingResult = await strategy.sign(
                    analyzedGroup,
                    account,
                    callbacks,
                )

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
