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

import { useCallback } from 'react'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    useArc0001Resolver,
    useEnqueueArc0001SignRequest,
} from '@perawallet/wallet-core-signing'
import {
    createNegotiator,
    resolveDisplayIdentity,
    type DisplayIdentity,
    type EnqueueArc60,
} from '@perawallet/wallet-extension-liquid-auth'
import { getLiquidAuthService } from './getLiquidAuthService'
import {
    buildLiquidAuthDispatcher,
    type LiquidAuthProviderConfig,
} from './buildLiquidAuthDispatcher'
import { createConfirmationGate, isDiscoverRequest } from './confirmationGate'
import { useLiquidAuthRegistryStore } from '../store/registryStore'
import { useLiquidAuthStore } from '../store/store'
import { resolveSigningKey } from '../utils/resolveSigningKey'
import { findCredentialId } from '../utils/findCredentialId'
import { withTimeout, withTimeoutFallback } from '../utils/withTimeout'
import { LiquidAuthConnectionError, LiquidAuthRejectedError } from '../errors'
import type { LiquidAuthNetwork, LiquidAuthSession } from '../models'

/** 7 days. */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * How long to wait for the WebRTC transport (`client.connect`) to establish
 * before giving up. A stalled handshake or an unreachable dApp turns into a
 * retryable connection error rather than a silent hang.
 */
const CONNECT_TIMEOUT_MS = 30_000

/** How long to wait for the dApp's negotiation identity before falling back to
 *  a host-only identity in the confirm step. */
const IDENTITY_WAIT_TIMEOUT_MS = 5_000

export type ConnectInput = {
    host: string
    requestId: string
    address: string
    /**
     * Surfaces the resolved dApp identity to the UI and resolves `true` when
     * the user taps Connect, `false` on Reject. Persistence is deferred until
     * this resolves.
     */
    requestConfirmation: (identity: DisplayIdentity) => Promise<boolean>
}

export type UseLiquidAuthConfig = LiquidAuthProviderConfig & {
    /** Surfaces an ARC-60 sign-data request to the signing pipeline. */
    enqueueArc60: EnqueueArc60
    /** Posts base64 msgpack signed txns to algod, returns txn ids. */
    submitSignedTxns: (stxns: string[]) => Promise<string[]>
}

export type UseLiquidAuthResult = {
    connect: (input: ConnectInput) => Promise<void>
    disconnect: (sessionId: string) => void
}

export const useLiquidAuth = (
    config: UseLiquidAuthConfig,
): UseLiquidAuthResult => {
    const resolve = useArc0001Resolver()
    const enqueue = useEnqueueArc0001SignRequest()
    const registerClient = useLiquidAuthRegistryStore(s => s.registerClient)
    const forgetClient = useLiquidAuthRegistryStore(s => s.forgetClient)

    const connect = useCallback(
        async ({
            host,
            requestId,
            address,
            requestConfirmation,
        }: ConnectInput) => {
            const service = getLiquidAuthService()
            const sessionId = requestId

            const accounts = useAccountsStore.getState().accounts
            const keyId = resolveSigningKey(address, accounts)
            if (!keyId) {
                throw new LiquidAuthConnectionError(
                    `No signing key for address ${address}`,
                    false,
                )
            }

            // Sweep any expired sessions so Connected Apps doesn't accumulate
            // stale entries (the TTL is otherwise never enforced).
            useLiquidAuthStore.getState().expireSessions(Date.now())

            // Reuse a passkey already registered for this host+account so we
            // assert (not attest) — otherwise the OS creates a fresh passkey on
            // every connect.
            const existingCredentialId = findCredentialId(
                useLiquidAuthStore.getState().credentials,
                host,
                address,
            )
            const { credentialId } = await service.runCeremony({
                origin: host,
                requestId,
                address,
                keyId,
                deviceName: config.name,
                credentialId: existingCredentialId,
            })
            // Record the credential immediately: the ceremony has already
            // registered the passkey (OS keychain + server), so persist which
            // credentialId to reuse now, independent of whether the user goes on
            // to approve the session. Otherwise a reject would strand the fresh
            // passkey and the next attempt would attest yet another one.
            useLiquidAuthStore.getState().recordCredential({
                host,
                address,
                credentialId,
                createdAt: Date.now(),
            })

            // Capture the session cookie AFTER the ceremony — the attestation
            // POSTs are what set connect.sid in the native cookie jar. The
            // signaling socket must carry it so the server joins it to the
            // dApp's session room (otherwise the answer never arrives).
            const cookie = await service.getSessionCookie(host)
            const client = service.createSignalClient(host, cookie)

            const gate = createConfirmationGate(data => client.send(data))

            const { dispatcher, walletConnectRoute } =
                buildLiquidAuthDispatcher({
                    config,
                    address,
                    sessionId,
                    signing: {
                        // The dApp-supplied transactions arrive as ARC-0001 wallet
                        // transactions on the wire; the resolver/enqueue types are
                        // stricter than the transport's structural view, so adapt at
                        // this single boundary (Parameters<> avoids importing the
                        // signing package's internal request/result types here).
                        resolve: (request, options) =>
                            resolve(
                                request as Parameters<typeof resolve>[0],
                                options,
                            ),
                        enqueue: (resolved, transport) =>
                            enqueue(
                                resolved as Parameters<typeof enqueue>[0],
                                transport as Parameters<typeof enqueue>[1],
                            ),
                        enqueueArc60: config.enqueueArc60,
                        submitSignedTxns: config.submitSignedTxns,
                    },
                    teardown: id => {
                        const c =
                            useLiquidAuthRegistryStore.getState().clients[id]
                        c?.close()
                        forgetClient(id)
                        const store = useLiquidAuthStore.getState()
                        store.setSessions(
                            store.sessions.filter(s => s.sessionId !== id),
                        )
                    },
                })

            let resolveIdentity: ((identity: DisplayIdentity) => void) | null =
                null
            const identityPromise = new Promise<DisplayIdentity>(res => {
                resolveIdentity = res
            })

            const negotiator = createNegotiator({
                walletProtocols: [
                    { id: 'arc0027', versions: ['1.0'] },
                    { id: 'walletconnect', versions: ['2.0'] },
                ],
                routes: {
                    arc0027: gate.gate(dispatcher, isDiscoverRequest),
                    walletconnect: gate.gate(walletConnectRoute),
                },
                send: (data: string) => client.send(data),
                close: () => client.close(),
                onIdentity: (peer, attestedOrigin) => {
                    resolveIdentity?.(
                        resolveDisplayIdentity(peer, attestedOrigin, host),
                    )
                    resolveIdentity = null
                },
                // Sourced from the signalling server once it emits an attested
                // origin (upstream dependency); undefined keeps the self-asserted
                // path until then.
                serverAttestedOrigin: undefined,
            })
            client.onMessage((data: string) => {
                void negotiator.handleMessage(data)
            })
            client.onClose(() => {
                negotiator.dispose()
                forgetClient(sessionId)
            })

            // Race transport establishment against a timeout so a stalled
            // handshake (or unreachable dApp) surfaces a retryable error rather
            // than hanging forever.
            try {
                await withTimeout(
                    client.connect(requestId),
                    CONNECT_TIMEOUT_MS,
                    () =>
                        new LiquidAuthConnectionError(
                            'The dApp did not respond. Please try again.',
                            true,
                        ),
                )
            } catch (error) {
                client.close()
                forgetClient(sessionId)
                throw error
            }

            registerClient(sessionId, client)

            // Everything past the successful connect must close the client on
            // any failure (reject, or a throw from the confirmation callback) —
            // otherwise the live client + WebRTC connection leak.
            try {
                const identity = await withTimeoutFallback(
                    identityPromise,
                    IDENTITY_WAIT_TIMEOUT_MS,
                    () => resolveDisplayIdentity(undefined, undefined, host),
                )

                const approved = await requestConfirmation(identity)
                if (!approved) throw new LiquidAuthRejectedError()

                gate.markConfirmed()
                persistSession({
                    sessionId,
                    requestId,
                    host,
                    identity,
                    address,
                    networks: config.networks,
                    credentialId,
                })
            } catch (error) {
                client.close()
                forgetClient(sessionId)
                throw error
            }
        },
        [resolve, enqueue, registerClient, forgetClient, config],
    )

    const disconnect = useCallback(
        (sessionId: string) => {
            const client =
                useLiquidAuthRegistryStore.getState().clients[sessionId]
            client?.close()
            forgetClient(sessionId)
            // Remove the session record so it leaves Connected Apps. The
            // credential registry is intentionally left intact, so a later
            // reconnect reuses the passkey rather than re-registering.
            const store = useLiquidAuthStore.getState()
            store.setSessions(
                store.sessions.filter(s => s.sessionId !== sessionId),
            )
        },
        [forgetClient],
    )

    return { connect, disconnect }
}

/**
 * Persists (or replaces) the session for a host+account. Closes and forgets any
 * prior live client for a replaced session so a reconnect doesn't orphan the
 * previous WebRTC connection (which would otherwise stay open and unreachable
 * once its session record is gone).
 */
const persistSession = ({
    sessionId,
    requestId,
    host,
    identity,
    address,
    networks,
    credentialId,
}: {
    sessionId: string
    requestId: string
    host: string
    identity: DisplayIdentity
    address: string
    networks: LiquidAuthNetwork[]
    credentialId: string
}): void => {
    const store = useLiquidAuthStore.getState()
    const registry = useLiquidAuthRegistryStore.getState()
    const isReplaced = (session: LiquidAuthSession): boolean =>
        session.host === host &&
        session.accounts.includes(address) &&
        session.sessionId !== sessionId

    for (const prior of store.sessions.filter(isReplaced)) {
        registry.clients[prior.sessionId]?.close()
        registry.forgetClient(prior.sessionId)
    }

    const prior = store.sessions.find(
        s => s.host === host && s.accounts.includes(address),
    )
    const now = Date.now()
    const session: LiquidAuthSession = {
        sessionId,
        requestId,
        host,
        peerMeta: { name: identity.name, origin: identity.origin },
        accounts: [address],
        genesisHash: networks[0]?.genesisHash ?? '',
        networks,
        credentialId,
        createdAt: prior?.createdAt ?? now,
        lastActiveAt: now,
        ttl: SESSION_TTL_MS,
    }
    store.setSessions([
        ...store.sessions.filter(
            s => !(s.host === host && s.accounts.includes(address)),
        ),
        session,
    ])
}
