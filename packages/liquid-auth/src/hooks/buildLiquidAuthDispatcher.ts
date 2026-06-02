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

import {
    createArc0027Dispatcher,
    createDisableHandler,
    createDiscoverHandler,
    createEnableHandler,
    createPostTransactionsHandler,
    createSignAndPostTransactionsHandler,
    createSignMessageHandler,
    createSignTransactionsHandler,
    createWalletConnectRoute,
    type Arc0027RequestEnvelope,
    type EnqueueArc60,
} from '@perawallet/wallet-extension-liquid-auth'
import type { LiquidAuthNetwork } from '../models'

type Route = (raw: string) => Promise<string | null>

/**
 * Signing collaborators from `@perawallet/wallet-core-signing`, kept as
 * structural types so this module doesn't couple to the signing package's
 * internal request/result shapes.
 */
export type SigningBridge = {
    resolve: (
        request: { transactions: unknown },
        options: { authorizedAddresses?: Set<string> },
    ) => unknown
    enqueue: (
        resolved: unknown,
        transport: {
            sourceType: 'liquidauth'
            transportId: string
            respondWithResult: (result: (string | null)[]) => void
            respondWithReject: () => void
            respondWithError: (error: Error) => void
        },
    ) => void
    enqueueArc60: EnqueueArc60
    submitSignedTxns: (stxns: string[]) => Promise<string[]>
}

export type LiquidAuthProviderConfig = {
    providerId: string
    name: string
    icon?: string
    networks: LiquidAuthNetwork[]
}

export type BuildDispatcherParams = {
    config: LiquidAuthProviderConfig
    /** The single account bound by the ceremony for this connection. */
    address: string
    /** The session id (= connect requestId) this dispatcher serves. */
    sessionId: string
    signing: SigningBridge
    /** Closes and forgets the session when the dApp sends `disable`. */
    teardown: (sessionId: string) => void
}

/**
 * Assembles the ARC-0027 dispatcher and the WalletConnect route for one
 * connection. Pure factory (no React, no store access) so it is unit-testable
 * in isolation; the hook owns the store wiring behind `signing` and `teardown`.
 */
export const buildLiquidAuthDispatcher = ({
    config,
    address,
    sessionId,
    signing,
    teardown,
}: BuildDispatcherParams): {
    dispatcher: Route
    walletConnectRoute: Route
} => {
    const primaryNetwork = config.networks[0]
    const genesisHash = primaryNetwork?.genesisHash ?? ''
    const genesisId = primaryNetwork?.genesisId ?? ''

    const signTransactions = createSignTransactionsHandler({
        resolve: signing.resolve,
        enqueue: signing.enqueue,
        authorizedAddresses: new Set([address]),
        transportId: sessionId,
    })
    const signMessage = createSignMessageHandler({
        enqueueArc60: signing.enqueueArc60,
        transportId: sessionId,
    })

    const dispatcher = createArc0027Dispatcher({
        discover: createDiscoverHandler({
            providerId: config.providerId,
            name: config.name,
            icon: config.icon,
            networks: config.networks,
        }),
        // The address is already bound (and the session persisted) during the
        // FIDO ceremony, so if a dApp sends `enable` we just return the bound
        // account — no second approval step.
        enable: createEnableHandler({
            providerId: config.providerId,
            genesisHash,
            genesisId,
            accounts: [address],
        }),
        disable: createDisableHandler({ sessionId, teardown }),
        sign_transactions: signTransactions,
        post_transactions: createPostTransactionsHandler({
            submit: signing.submitSignedTxns,
        }),
        sign_and_post_transactions: createSignAndPostTransactionsHandler({
            sign: (env: Arc0027RequestEnvelope) =>
                signTransactions(env) as Promise<{
                    stxns: (string | null)[]
                }>,
            submit: signing.submitSignedTxns,
        }),
        sign_message: signMessage,
    })

    const walletConnectRoute = createWalletConnectRoute({
        signTransactions,
        signMessage,
        account: address,
        genesisHash,
        genesisId,
    })

    return { dispatcher, walletConnectRoute }
}
