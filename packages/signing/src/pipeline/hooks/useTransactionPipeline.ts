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

import { useState, useCallback, useRef } from 'react'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import {
    useNetwork,
    useAlgorandClient,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import { useTransactionSigner } from '../../hooks'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    DataSource,
    DataAnalyzer,
    DataTransport,
    TransportResult,
    HardwarePrompt,
    AnalyzedSignableGroup,
    AnalysisWarning,
} from '../types'
import { createPipeline } from '../createPipeline'
import { createStandardAnalyzer } from '../analyzers'
import { createSigningStrategySelector, getLocalParticipants } from '../signing'
import { createTransportSelector } from '../transports'

/**
 * Options for the transaction pipeline hook
 */
export interface UseTransactionPipelineOptions<TSourceParams> {
    /** The data source */
    source: DataSource<TSourceParams>

    /** Custom analyzer (defaults to standard) */
    analyzer?: DataAnalyzer

    /** Override transport (defaults to auto-select) */
    transport?: DataTransport

    /** Function to propose a multisig transaction (required for multisig support) */
    proposeSignRequest?: (params: {
        jointAccountAddress: string
        signedData: unknown
        signers: unknown[]
    }) => Promise<{
        signRequestId: string
        status: 'pending' | 'ready' | 'submitted' | 'failed'
    }>

    /** Function to add signatures to an existing request (required for multisig co-sign) */
    addSignatures?: (params: {
        signRequestId: string
        signers: unknown[]
    }) => Promise<{ status: 'pending' | 'ready' | 'submitted' | 'failed' }>
}

/**
 * Result of the transaction pipeline hook
 */
export type UseTransactionPipelineResult<TSourceParams> = {
    /** Execute the pipeline with the given params and account */
    execute: (
        params: TSourceParams,
        account: WalletAccount,
    ) => Promise<TransportResult>

    /** Whether the pipeline is currently executing */
    isExecuting: boolean

    /** Error from the last execution, if any */
    error: Error | null

    /** Current hardware wallet prompt, if any */
    hardwarePrompt: HardwarePrompt | null

    /** Acknowledge the current hardware prompt */
    acknowledgeHardwarePrompt: () => void

    /** Current analyzed group awaiting confirmation, if any */
    pendingConfirmation: AnalyzedSignableGroup | null

    /** Confirm the pending analysis */
    confirmPending: () => void

    /** Reject the pending analysis */
    rejectPending: () => void

    /** Warnings from the last analysis */
    warnings: AnalysisWarning[]
}

/**
 * Hook for executing transaction pipelines.
 * Provides a high-level interface for the pipeline with React state management.
 */
export const useTransactionPipeline = <TSourceParams>(
    options: UseTransactionPipelineOptions<TSourceParams>,
): UseTransactionPipelineResult<TSourceParams> => {
    const { source, analyzer, transport: overrideTransport } = options

    // Core dependencies
    const accounts = useAllAccounts()
    const { network } = useNetwork()
    const { signTransactions } = useTransactionSigner()
    const algokit = useAlgorandClient(signTransactions)
    const { encodeSignedTransactions } = useTransactionEncoder()

    // State
    const [isExecuting, setIsExecuting] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const [hardwarePrompt, setHardwarePrompt] = useState<HardwarePrompt | null>(
        null,
    )
    const [pendingConfirmation, setPendingConfirmation] =
        useState<AnalyzedSignableGroup | null>(null)
    const [warnings, setWarnings] = useState<AnalysisWarning[]>([])

    // Refs for resolving async operations
    const hardwarePromptResolver = useRef<(() => void) | null>(null)
    const confirmationResolver = useRef<((confirmed: boolean) => void) | null>(
        null,
    )

    // Create signing strategy selector
    const getSigningStrategy = useCallback(
        (account: WalletAccount, allAccounts: WalletAccount[]) => {
            const selector = createSigningStrategySelector({
                signTransactions,
            })
            return selector(account, allAccounts)
        },
        [signTransactions],
    )

    // Create transport selector
    const getTransport = useCallback(
        (sourceMetadata: { type: string }, account: WalletAccount) => {
            // Default implementations for multisig functions
            const proposeSignRequest =
                options.proposeSignRequest ??
                (async () => {
                    throw new Error('proposeSignRequest not provided')
                })
            const addSignatures =
                options.addSignatures ??
                (async () => {
                    throw new Error('addSignatures not provided')
                })

            const selector = createTransportSelector({
                algokit,
                encodeSignedTransactions,
                proposeSignRequest,
                addSignatures,
            })
            return selector(
                sourceMetadata as {
                    type:
                        | 'local'
                        | 'walletconnect'
                        | 'multisig-cosign'
                        | 'arc60'
                },
                account,
            )
        },
        [
            algokit,
            encodeSignedTransactions,
            options.proposeSignRequest,
            options.addSignatures,
        ],
    )

    // Execute the pipeline
    const execute = useCallback(
        async (
            params: TSourceParams,
            account: WalletAccount,
        ): Promise<TransportResult> => {
            setIsExecuting(true)
            setError(null)
            setWarnings([])

            try {
                const pipeline = createPipeline({
                    source,
                    analyzer: analyzer ?? createStandardAnalyzer(),
                    transport: overrideTransport,
                    getSigningStrategy,
                    getTransport,
                    getAllAccounts: () => accounts,
                    getNetwork: () => network,
                    getLocalParticipants: (acc, allAccounts) =>
                        getLocalParticipants(acc, allAccounts),
                    callbacks: {
                        onHardwarePrompt: async prompt => {
                            setHardwarePrompt(prompt)
                            await new Promise<void>(resolve => {
                                hardwarePromptResolver.current = resolve
                            })
                            setHardwarePrompt(null)
                        },
                        onConfirmationRequired: async group => {
                            setPendingConfirmation(group)
                            const confirmed = await new Promise<boolean>(
                                resolve => {
                                    confirmationResolver.current = resolve
                                },
                            )
                            setPendingConfirmation(null)
                            return confirmed
                        },
                        onWarnings: w => {
                            setWarnings(w)
                        },
                        onError: e => {
                            setError(e)
                        },
                    },
                })

                return await pipeline.execute(params, account)
            } catch (e) {
                const err = e instanceof Error ? e : new Error(String(e))
                setError(err)
                throw err
            } finally {
                setIsExecuting(false)
            }
        },
        [
            source,
            analyzer,
            overrideTransport,
            getSigningStrategy,
            getTransport,
            accounts,
            network,
        ],
    )

    // Hardware prompt acknowledgment
    const acknowledgeHardwarePrompt = useCallback(() => {
        hardwarePromptResolver.current?.()
        hardwarePromptResolver.current = null
    }, [])

    // Confirmation handlers
    const confirmPending = useCallback(() => {
        confirmationResolver.current?.(true)
        confirmationResolver.current = null
    }, [])

    const rejectPending = useCallback(() => {
        confirmationResolver.current?.(false)
        confirmationResolver.current = null
    }, [])

    return {
        execute,
        isExecuting,
        error,
        hardwarePrompt,
        acknowledgeHardwarePrompt,
        pendingConfirmation,
        confirmPending,
        rejectPending,
        warnings,
    }
}
