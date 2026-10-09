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
    AlgodError,
    encodeSignedTransactions,
    createWalletAlgorandClient,
    getAlgorandClient,
} from '../blockchain'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import type { BroadcasterChainAdapter } from '@perawallet/wallet-core-signing'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandNetworkOf } from '../legacy-network'
import { createAlgodTransport } from './transports/createAlgodTransport'
import { findStaleGroupReason } from './staleRequestGuard'
import {
    CONFIRMATION_ROUNDS_TO_WAIT,
    setOnConfirmedHandler,
    submitAndAutoRefresh,
    submitRawSignedTransactionGroup,
    waitForAlgodConfirmation,
} from './submission'
import {
    deriveSubmissionAttemptFromBytes,
    isRequestGroupAlreadySubmitted,
    reconcileOpenSubmissions,
    setSubmissionSettledHandler,
} from './submission-ledger'

export const algorandBroadcasterAdapter: BroadcasterChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    submit: (scope, signedTransactions) =>
        submitRawSignedTransactionGroup(getAlgorandClient(scope), [
            ...signedTransactions,
        ]),
    waitForConfirmation: async (scope, txIds) => {
        const [firstTxId] = txIds
        if (firstTxId === undefined) return
        // A group is atomic, so its first transaction confirming means the group did.
        await waitForAlgodConfirmation(
            getAlgorandClient(scope),
            firstTxId,
            CONFIRMATION_ROUNDS_TO_WAIT,
        )
    },
    createSubmitTransport: scope =>
        createAlgodTransport(
            createWalletAlgorandClient(algorandNetworkOf(scope)),
            encodeSignedTransactions,
            scope,
        ),
    submitAndAutoRefresh: (signedTxns, options) =>
        submitAndAutoRefresh(
            createWalletAlgorandClient(useNetworkStore.getState().network),
            encodeSignedTransactions,
            signedTxns,
            options,
        ),
    isRequestGroupAlreadySubmitted,
    findStaleGroupReason: request => findStaleGroupReason(request),
    // The test-only params stay off the adapter.
    reconcileOpenSubmissions: () => reconcileOpenSubmissions(),
    deriveSubmissionAttemptFromBytes,
    setOnConfirmedHandler,
    setSubmissionSettledHandler,
    submitTimeoutError: timeoutMs =>
        new AlgodError(
            'network_unavailable',
            {},
            new Error(`Transaction submit timed out after ${timeoutMs}ms`),
        ),
}
