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
import { logger } from '@perawallet/wallet-core-shared'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    useArc0001Resolver,
    useEnqueueArc0001SignRequest,
} from '@perawallet/wallet-core-signing'
import { useLiquidAuthService } from './useLiquidAuthService'
import { useLiquidAuthRegistryStore } from '../store/registryStore'
import { useLiquidAuthStore } from '../store/store'
import { createArc0027Dispatcher } from '../arc0027/dispatcher'
import { createDiscoverHandler } from '../handlers/discover'
import { createEnableHandler } from '../handlers/enable'
import { createDisableHandler } from '../handlers/disable'
import { createSignTransactionsHandler } from '../handlers/signTransactions'
import {
    createPostTransactionsHandler,
    createSignAndPostTransactionsHandler,
} from '../handlers/postTransactions'
import { createSignMessageHandler } from '../handlers/signMessage'
import { resolveSigningKey } from '../utils/resolveSigningKey'
import { findCredentialId } from '../utils/findCredentialId'
import { LiquidAuthConnectionError } from '../errors'
import type { EnqueueArc60 } from '../handlers/signMessage'
import type { LiquidAuthNetwork, LiquidAuthSession } from '../models'

/** 7 days. */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * How long to wait for the WebRTC transport (`client.connect`) to establish
 * before giving up. A stalled handshake or an unreachable dApp turns into a
 * retryable connection error rather than a silent hang.
 */
const CONNECT_TIMEOUT_MS = 30_000

export type ConnectInput = {
    host: string
    requestId: string
    address: string
}

export type UseLiquidAuthConfig = {
    providerId: string
    name: string
    icon?: string
    networks: LiquidAuthNetwork[]
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
    const service = useLiquidAuthService()
    const resolve = useArc0001Resolver()
    const enqueue = useEnqueueArc0001SignRequest()
    const registerClient = useLiquidAuthRegistryStore(s => s.registerClient)
    const forgetClient = useLiquidAuthRegistryStore(s => s.forgetClient)

    const establishConnection = useCallback(
        async ({ host, requestId, address }: ConnectInput) => {
            logger.info('[liquid-auth] connect: start', {
                host,
                requestId,
                address,
            })
            const accounts = useAccountsStore.getState().accounts
            const keyId = resolveSigningKey(address, accounts)
            logger.info('[liquid-auth] connect: keyId resolved', {
                hasKey: !!keyId,
            })
            if (!keyId) {
                throw new LiquidAuthConnectionError(
                    `No signing key for address ${address}`,
                    false,
                )
            }

            // Reuse a passkey already registered for this host+account so we
            // assert (not attest) — otherwise the OS creates a fresh passkey on
            // every connect.
            const existingCredentialId = findCredentialId(
                useLiquidAuthStore.getState().credentials,
                host,
                address,
            )
            logger.info('[liquid-auth] connect: running FIDO ceremony', {
                reusing: !!existingCredentialId,
            })
            const { credentialId } = await service.runCeremony({
                origin: host,
                requestId,
                address,
                keyId,
                deviceName: 'Pera Wallet',
                credentialId: existingCredentialId,
            })
            logger.info('[liquid-auth] connect: ceremony done', {
                credentialId,
            })

            // Capture the session cookie AFTER the ceremony — the attestation
            // POSTs are what set connect.sid in the native cookie jar. The
            // signaling socket must carry it so the server joins it to the
            // dApp's session room (otherwise the answer never arrives).
            const cookie = await service.getSessionCookie(host)
            logger.info('[liquid-auth] connect: session cookie', {
                hasCookie: !!cookie,
            })
            const client = service.createSignalClient(host, cookie)
            logger.info('[liquid-auth] connect: signal client created')
            const sessionId = requestId

            const signTransactionsHandler = createSignTransactionsHandler({
                resolve: resolve as never,
                enqueue: enqueue as never,
                authorizedAddresses: new Set([address]),
                transportId: sessionId,
            })

            const dispatcher = createArc0027Dispatcher({
                discover: createDiscoverHandler({
                    providerId: config.providerId,
                    name: config.name,
                    icon: config.icon,
                    networks: config.networks,
                }),
                // The address is already bound (and the session persisted)
                // during the FIDO ceremony, so if a dApp does send `enable`
                // we just return the bound account — no second approval.
                enable: createEnableHandler({
                    providerId: config.providerId,
                    genesisHash: config.networks[0]?.genesisHash ?? '',
                    genesisId: config.networks[0]?.genesisId ?? '',
                    accounts: [address],
                }),
                disable: createDisableHandler({
                    sessionId,
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
                }),
                sign_transactions: signTransactionsHandler,
                post_transactions: createPostTransactionsHandler({
                    submit: config.submitSignedTxns,
                }),
                sign_and_post_transactions:
                    createSignAndPostTransactionsHandler({
                        sign: env =>
                            signTransactionsHandler(env) as Promise<{
                                stxns: (string | null)[]
                            }>,
                        submit: config.submitSignedTxns,
                    }),
                sign_message: createSignMessageHandler({
                    enqueueArc60: config.enqueueArc60,
                    transportId: sessionId,
                }),
            })

            client.onMessage(async (data: string) => {
                const response = await dispatcher(data)
                if (response) client.send(response)
            })
            client.onClose(() => forgetClient(sessionId))

            // Race the transport establishment against a timeout so a stalled
            // WebRTC handshake (or an unreachable dApp) surfaces a retryable
            // error instead of hanging forever. The timer is always cleared,
            // whether connect resolves, rejects, or times out.
            logger.info(
                '[liquid-auth] connect: opening transport (peer/answer)…',
            )
            let timeoutId: ReturnType<typeof setTimeout> | undefined
            try {
                await new Promise<void>((resolve, reject) => {
                    timeoutId = setTimeout(() => {
                        logger.info(
                            '[liquid-auth] connect: transport TIMEOUT after 30s',
                        )
                        reject(
                            new LiquidAuthConnectionError(
                                'The dApp did not respond. Please try again.',
                                true,
                            ),
                        )
                    }, CONNECT_TIMEOUT_MS)
                    client.connect(requestId).then(resolve, reject)
                })
            } catch (error) {
                if (timeoutId !== undefined) clearTimeout(timeoutId)
                client.close()
                throw error
            }
            if (timeoutId !== undefined) clearTimeout(timeoutId)

            logger.info('[liquid-auth] connect: transport open, registered', {
                sessionId,
            })
            registerClient(sessionId, client)

            // Liquid Auth binds the address at the FIDO layer, so a verified
            // ceremony + open transport IS the connection — there's no ARC-0027
            // `enable` handshake to wait for. Persist the session now, keyed by
            // host+account so a reconnect updates the single entry (and reuses
            // its credentialId via findCredentialId) rather than duplicating.
            const store = useLiquidAuthStore.getState()
            const prior = store.sessions.find(
                s => s.host === host && s.accounts.includes(address),
            )
            const now = Date.now()
            const session: LiquidAuthSession = {
                sessionId,
                requestId,
                host,
                peerMeta: { name: host, origin: host },
                accounts: [address],
                genesisHash: config.networks[0]?.genesisHash ?? '',
                networks: config.networks,
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
            // Record the credential in the durable registry so a future
            // reconnect (even after this session is deleted) asserts the same
            // passkey instead of attesting a new one.
            store.recordCredential({
                host,
                address,
                credentialId,
                createdAt: now,
            })
            logger.info('[liquid-auth] connect: session persisted', {
                sessionId,
            })
            store.setPendingConnection(null)
        },
        [
            service,
            resolve,
            enqueue,
            registerClient,
            forgetClient,
            config,
            config.enqueueArc60,
            config.submitSignedTxns,
        ],
    )

    const connect = useCallback(
        async ({ host, requestId, address }: ConnectInput) => {
            const setPendingConnection =
                useLiquidAuthStore.getState().setPendingConnection
            // Surface a "Connecting…" sheet immediately; cleared on any throw,
            // and again by the enable handler once approval supersedes it.
            logger.info('[liquid-auth] connect: status → connecting')
            setPendingConnection({ host, requestId })
            try {
                await establishConnection({ host, requestId, address })
            } catch (error) {
                logger.info('[liquid-auth] connect: failed', {
                    message: (error as Error)?.message,
                })
                setPendingConnection(null)
                throw error
            }
        },
        [establishConnection],
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
