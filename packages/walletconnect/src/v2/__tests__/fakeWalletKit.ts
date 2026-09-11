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

import { vi, type Mock } from 'vitest'
import { Networks } from '@perawallet/wallet-core-shared'
import { getCaip2ChainId } from '../caip'
import type {
    WalletKitClient,
    WalletKitEvent,
    WalletKitEventArguments,
    WalletKitSession,
    WalletKitSessionProposal,
} from '../client'

/**
 * A WalletKit stand-in typed against {@link WalletKitClient}, so the fake is
 * checked against the real surface rather than a hand-written echo of it.
 * Shared by the v2 handler spec and the handler-contract run, which drives it
 * as the contract suite's peer.
 */

/**
 * The SESSION topic. Deliberately not {@link PAIRING_TOPIC}: on v2 the two are
 * different strings, and a fixture reusing one for both would pass a handler
 * that keyed its records by the pairing.
 */
export const TOPIC = 'a'.repeat(64)
export const OTHER_TOPIC = 'b'.repeat(64)
export const PAIRING_TOPIC = 'c'.repeat(64)
export const SYM_KEY = 'd'.repeat(64)
export const ADDRESS = 'A'.repeat(58)
export const OTHER_ADDRESS = 'B'.repeat(58)
export const MAINNET_CHAIN_ID = getCaip2ChainId(Networks.mainnet) ?? ''
export const TESTNET_CHAIN_ID = getCaip2ChainId(Networks.testnet) ?? ''
export const PROPOSAL_ID = 1701
export const REQUEST_ID = 4242

// An ARC-0001 group with a `msig` slot, which the resolver answers 4200 for
// and nothing on the way there may strip.
export const TXN_GROUP = [
    { txn: 'AAEC' },
    {
        txn: 'AAED',
        msig: { version: 1, threshold: 2, addrs: [ADDRESS, OTHER_ADDRESS] },
    },
]
// ARC-0025 puts the group in the first positional slot.
export const SIGN_TXN_PARAMS = [TXN_GROUP]

export const V2_URI = `wc:${PAIRING_TOPIC}@2?relay-protocol=irn&symKey=${SYM_KEY}`
export const V1_URI = `wc:${'e'.repeat(36)}@1?bridge=https%3A%2F%2Fbridge.example&key=${'f'.repeat(64)}`

export const flush = (): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, 0))

type EventListeners = {
    [E in WalletKitEvent]: Set<(args: WalletKitEventArguments[E]) => void>
}

export type FakeWalletKit = WalletKitClient & {
    emit<E extends WalletKitEvent>(
        event: E,
        args: WalletKitEventArguments[E],
    ): void
    /** Every event carrying at least one listener, so an extra bind fails too. */
    boundEvents(): WalletKitEvent[]
    transportClose: Mock<() => Promise<void>>
    heartbeatStop: Mock<() => void>
    pair: Mock<WalletKitClient['core']['pairing']['pair']>
    pairingDisconnect: Mock<WalletKitClient['core']['pairing']['disconnect']>
    approveSession: Mock<WalletKitClient['approveSession']>
    rejectSession: Mock<WalletKitClient['rejectSession']>
    disconnectSession: Mock<WalletKitClient['disconnectSession']>
    respondSessionRequest: Mock<WalletKitClient['respondSessionRequest']>
    /** Core's own expirer event, whose target is `topic:…` or `id:…`. */
    emitExpired(target: string): void
    expirerListenerCount(): number
}

export const makeSession = (
    overrides: Partial<WalletKitSession> = {},
): WalletKitSession => ({
    topic: TOPIC,
    pairingTopic: PAIRING_TOPIC,
    relay: { protocol: 'irn' },
    expiry: 1_800_000_000,
    acknowledged: true,
    controller: 'controller-public-key',
    namespaces: {
        algorand: {
            chains: [MAINNET_CHAIN_ID],
            accounts: [`${MAINNET_CHAIN_ID}:${ADDRESS}`],
            methods: ['algo_signTxn'],
            events: [],
        },
    },
    requiredNamespaces: {},
    optionalNamespaces: {},
    self: {
        publicKey: 'self-public-key',
        metadata: {
            name: 'Pera Wallet',
            description: '',
            url: 'https://perawallet.app',
            icons: [],
        },
    },
    peer: {
        publicKey: 'peer-public-key',
        metadata: {
            name: 'Test dApp',
            description: 'A dApp',
            url: 'https://dapp.example',
            icons: ['https://dapp.example/icon.png'],
        },
    },
    ...overrides,
})

export const createFakeWalletKit = (
    initial: Record<string, WalletKitSession> = {},
): FakeWalletKit => {
    const listeners: EventListeners = {
        session_proposal: new Set(),
        session_request: new Set(),
        session_delete: new Set(),
        proposal_expire: new Set(),
        session_request_expire: new Set(),
        session_authenticate: new Set(),
    }
    const sessions = { ...initial }
    const transportClose = vi.fn<() => Promise<void>>(async () => {})
    const heartbeatStop = vi.fn<() => void>()
    const pair = vi.fn<WalletKitClient['core']['pairing']['pair']>(
        async () => ({
            topic: PAIRING_TOPIC,
        }),
    )
    const pairingDisconnect = vi.fn<
        WalletKitClient['core']['pairing']['disconnect']
    >(async () => {})
    // Settles the session the way the relay would, so restore() and the store
    // see what the dApp does. The topic is the session's, never the pairing's.
    const approveSession = vi.fn<WalletKitClient['approveSession']>(
        async ({ namespaces }) => {
            const session = makeSession({ namespaces })
            sessions[session.topic] = session
            return session
        },
    )
    const rejectSession = vi.fn<WalletKitClient['rejectSession']>(
        async () => {},
    )
    const disconnectSession = vi.fn<WalletKitClient['disconnectSession']>(
        async ({ topic }) => {
            delete sessions[topic]
        },
    )
    const respondSessionRequest = vi.fn<
        WalletKitClient['respondSessionRequest']
    >(async () => {})
    const expirerListeners = new Set<(payload: { target: string }) => void>()

    return {
        on: (event, listener) => listeners[event].add(listener),
        off: (event, listener) => listeners[event].delete(listener),
        getActiveSessions: () => sessions,
        approveSession,
        rejectSession,
        disconnectSession,
        respondSessionRequest,
        core: {
            pairing: { pair, disconnect: pairingDisconnect },
            relayer: { transportClose },
            heartbeat: { stop: heartbeatStop },
            expirer: {
                on: (_event, listener) => expirerListeners.add(listener),
                off: (_event, listener) => expirerListeners.delete(listener),
            },
        },
        emit: (event, args) => {
            for (const listener of listeners[event]) listener(args)
        },
        emitExpired: target => {
            for (const listener of expirerListeners) listener({ target })
        },
        expirerListenerCount: () => expirerListeners.size,
        boundEvents: () =>
            Object.keys(listeners)
                .filter(
                    (event): event is WalletKitEvent =>
                        listeners[event as WalletKitEvent].size > 0,
                )
                .sort(),
        transportClose,
        heartbeatStop,
        pair,
        pairingDisconnect,
    }
}

export const makeProposal = (
    overrides: Partial<WalletKitSessionProposal['params']> = {},
): WalletKitSessionProposal => ({
    id: PROPOSAL_ID,
    params: {
        id: PROPOSAL_ID,
        // Seconds, as WalletKit reports it.
        expiryTimestamp: 1_800_000_000,
        relays: [{ protocol: 'irn' }],
        proposer: {
            publicKey: 'peer-public-key',
            metadata: makeSession().peer.metadata,
        },
        requiredNamespaces: {
            algorand: {
                chains: [MAINNET_CHAIN_ID],
                methods: ['algo_signTxn'],
                events: [],
            },
        },
        optionalNamespaces: {},
        pairingTopic: PAIRING_TOPIC,
        ...overrides,
    },
    verifyContext: {
        verified: {
            verifyUrl: '',
            validation: 'UNKNOWN',
            origin: 'https://dapp.example',
        },
    },
})

export type RequestOverrides = {
    id?: number
    topic?: string
    method?: string
    params?: unknown
    chainId?: string
}

export const makeRequest = (
    overrides: RequestOverrides = {},
): WalletKitEventArguments['session_request'] => ({
    id: overrides.id ?? REQUEST_ID,
    topic: overrides.topic ?? TOPIC,
    params: {
        request: {
            method: overrides.method ?? 'algo_signTxn',
            params: overrides.params ?? SIGN_TXN_PARAMS,
        },
        chainId: overrides.chainId ?? MAINNET_CHAIN_ID,
    },
    verifyContext: {
        verified: {
            verifyUrl: '',
            validation: 'UNKNOWN',
            origin: 'https://dapp.example',
        },
    },
})
