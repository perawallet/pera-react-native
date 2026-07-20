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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { waitForSessionOutcome } from '../sessionOutcome'
import { useWalletConnectStore } from '../../store'

import type { WalletConnectSessionRequest } from '../../models'

// The WC v1 client fork and the platform provider pull in native modules
// jsdom can't load; these tests only exercise the store subscription.
vi.mock('@perawallet/walletconnect', () => ({ default: vi.fn() }))
vi.mock('@perawallet/wallet-core-signing', () => ({
    MAX_DATA_SIGN_REQUESTS: 10,
    MAX_TRANSACTION_SIGN_REQUESTS: 64,
    ARC60_MAX_REQUEST_BYTES: 64 * 1024,
}))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

const sessionRequest = (clientId: string): WalletConnectSessionRequest =>
    ({
        clientId,
        chainId: 4160,
        permissions: [],
        peerMeta: { name: 'dApp', description: '', url: '', icons: [] },
        createdAt: Date.now(),
    }) as WalletConnectSessionRequest

describe('waitForSessionOutcome', () => {
    beforeEach(() => {
        useWalletConnectStore.getState().resetState()
    })

    it('resolves `session` when a session_request lands for the pairing connector', async () => {
        const outcome = waitForSessionOutcome('pairing-client', 1000)

        useWalletConnectStore
            .getState()
            .setSessionRequests([sessionRequest('pairing-client')])

        await expect(outcome).resolves.toEqual({ type: 'session' })
    })

    it('resolves `session` immediately when the request landed before subscribing', async () => {
        useWalletConnectStore
            .getState()
            .setSessionRequests([sessionRequest('pairing-client')])

        await expect(
            waitForSessionOutcome('pairing-client', 1000),
        ).resolves.toEqual({ type: 'session' })
    })

    it('resolves `error` when a connection error is surfaced for the pairing connector', async () => {
        const outcome = waitForSessionOutcome('pairing-client', 1000)

        const error = Object.assign(new Error('wrong network'), {
            clientId: 'pairing-client',
        })
        useWalletConnectStore.getState().setConnectionError(error)

        await expect(outcome).resolves.toEqual({ type: 'error', error })
    })

    it('ignores errors and requests belonging to other connectors', async () => {
        const outcome = waitForSessionOutcome('pairing-client', 1000)

        useWalletConnectStore.getState().setConnectionError(
            Object.assign(new Error('unrelated'), {
                clientId: 'other-connector',
            }),
        )
        useWalletConnectStore
            .getState()
            .setSessionRequests([sessionRequest('other-connector')])
        useWalletConnectStore
            .getState()
            .setSessionRequests([
                sessionRequest('other-connector'),
                sessionRequest('pairing-client'),
            ])

        await expect(outcome).resolves.toEqual({ type: 'session' })
    })

    it('resolves `timeout` when nothing lands within the budget', async () => {
        await expect(
            waitForSessionOutcome('pairing-client', 20),
        ).resolves.toEqual({ type: 'timeout' })
    })
})
