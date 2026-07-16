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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { PinningError } from 'react-native-ssl-public-key-pinning'
import { initializeSslPinningService } from '../ssl-pinning.service'
import { PINNED_ROOT_SPKI_HASHES, SSL_PINNING_EXPIRATION_DATE } from '../pins'

const {
    mockInitializeSslPinning,
    mockIsSslPinningAvailable,
    mockAddSslPinningErrorListener,
} = vi.hoisted(() => ({
    mockInitializeSslPinning: vi.fn().mockResolvedValue(undefined),
    mockIsSslPinningAvailable: vi.fn().mockReturnValue(true),
    mockAddSslPinningErrorListener: vi.fn(),
}))

vi.mock('react-native-ssl-public-key-pinning', () => ({
    initializeSslPinning: mockInitializeSslPinning,
    isSslPinningAvailable: mockIsSslPinningAvailable,
    addSslPinningErrorListener: mockAddSslPinningErrorListener,
}))

const pinEntry = () => ({
    includeSubdomains: false,
    publicKeyHashes: [...PINNED_ROOT_SPKI_HASHES],
    expirationDate: SSL_PINNING_EXPIRATION_DATE,
})

const makeDeps = (
    overrides: {
        isBackendPinningEnabled?: boolean
        isNodePinningEnabled?: boolean
        backendUrls?: readonly string[]
        nodeUrls?: readonly string[]
    } = {},
) => {
    const {
        isBackendPinningEnabled = true,
        isNodePinningEnabled = false,
        backendUrls = ['https://mainnet.api.perawallet.app'],
        nodeUrls = [],
    } = overrides
    return {
        remoteConfig: {
            getBooleanValue: vi.fn((key: string) =>
                key === 'enable_ssl_pinning_algod'
                    ? isNodePinningEnabled
                    : isBackendPinningEnabled,
            ),
        },
        analytics: { logEvent: vi.fn() },
        crashReporting: { recordNonFatalError: vi.fn() },
        backendUrls,
        nodeUrls,
    }
}

describe('initializeSslPinningService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsSslPinningAvailable.mockReturnValue(true)
        mockInitializeSslPinning.mockResolvedValue(undefined)
    })

    test('does not enable pinning while both remote flags are off', async () => {
        const deps = makeDeps({
            isBackendPinningEnabled: false,
            isNodePinningEnabled: false,
        })

        await initializeSslPinningService(deps)

        expect(deps.remoteConfig.getBooleanValue).toHaveBeenCalledWith(
            'enable_ssl_pinning_pera_api',
            false,
        )
        expect(deps.remoteConfig.getBooleanValue).toHaveBeenCalledWith(
            'enable_ssl_pinning_algod',
            false,
        )
        expect(mockInitializeSslPinning).not.toHaveBeenCalled()
        expect(mockAddSslPinningErrorListener).not.toHaveBeenCalled()
    })

    test('pins only the backend hosts when only the backend flag is on', async () => {
        const deps = makeDeps({
            backendUrls: [
                'https://mainnet.api.perawallet.app',
                'https://testnet.api.perawallet.app',
            ],
            nodeUrls: ['https://mainnet-api.algonode.cloud'],
        })

        await initializeSslPinningService(deps)

        expect(mockInitializeSslPinning).toHaveBeenCalledWith({
            'mainnet.api.perawallet.app': pinEntry(),
            'testnet.api.perawallet.app': pinEntry(),
        })
    })

    test('pins only the node hosts when only the nodes flag is on', async () => {
        const deps = makeDeps({
            isBackendPinningEnabled: false,
            isNodePinningEnabled: true,
            backendUrls: ['https://mainnet.api.perawallet.app'],
            nodeUrls: [
                'https://mainnet-api.algonode.cloud',
                'https://mainnet-idx.algonode.cloud',
            ],
        })

        await initializeSslPinningService(deps)

        expect(mockInitializeSslPinning).toHaveBeenCalledWith({
            'mainnet-api.algonode.cloud': pinEntry(),
            'mainnet-idx.algonode.cloud': pinEntry(),
        })
    })

    test('pins node hosts served from perawallet.app subdomains (production Nodely fronts)', async () => {
        const deps = makeDeps({
            isBackendPinningEnabled: false,
            isNodePinningEnabled: true,
            // Production builds inject Pera-owned hostnames for algod/indexer
            // via env config (real values live in CI env, not in this repo);
            // the node group must pin any perawallet.app host it is given.
            nodeUrls: ['https://some-node.perawallet.app'],
        })

        await initializeSslPinningService(deps)

        expect(mockInitializeSslPinning).toHaveBeenCalledWith({
            'some-node.perawallet.app': pinEntry(),
        })
    })

    test('pins both groups in a single initialization when both flags are on', async () => {
        const deps = makeDeps({
            isNodePinningEnabled: true,
            backendUrls: ['https://mainnet.api.perawallet.app'],
            nodeUrls: ['https://mainnet-api.algonode.cloud'],
        })

        await initializeSslPinningService(deps)

        expect(mockInitializeSslPinning).toHaveBeenCalledTimes(1)
        expect(mockInitializeSslPinning).toHaveBeenCalledWith({
            'mainnet.api.perawallet.app': pinEntry(),
            'mainnet-api.algonode.cloud': pinEntry(),
        })
    })

    test('the backend group never pins third-party node domains', async () => {
        const deps = makeDeps({
            isNodePinningEnabled: false,
            // A node host leaking into the backend URL list must not be
            // pinned by the backend group.
            backendUrls: ['https://mainnet-api.algonode.cloud'],
        })

        await initializeSslPinningService(deps)

        expect(mockInitializeSslPinning).not.toHaveBeenCalled()
    })

    test('skips initialization when the native module is unavailable', async () => {
        mockIsSslPinningAvailable.mockReturnValue(false)
        const deps = makeDeps()

        await initializeSslPinningService(deps)

        expect(mockInitializeSslPinning).not.toHaveBeenCalled()
    })

    test('skips initialization when no configured host is pinnable', async () => {
        const deps = makeDeps({ backendUrls: ['http://localhost:8000'] })

        await initializeSslPinningService(deps)

        expect(mockInitializeSslPinning).not.toHaveBeenCalled()
        expect(mockAddSslPinningErrorListener).not.toHaveBeenCalled()
    })

    test('reports pin-validation failures to analytics and crash reporting', async () => {
        const deps = makeDeps()

        await initializeSslPinningService(deps)

        expect(mockAddSslPinningErrorListener).toHaveBeenCalledTimes(1)
        const listener = mockAddSslPinningErrorListener.mock.calls[0]![0] as (
            error: PinningError,
        ) => void
        listener({ serverHostname: 'mainnet.api.perawallet.app' })

        expect(deps.analytics.logEvent).toHaveBeenCalledWith(
            'ssl_pinning_failure',
            { server_hostname: 'mainnet.api.perawallet.app' },
        )
        expect(deps.crashReporting.recordNonFatalError).toHaveBeenCalledTimes(1)
    })

    test('never lets a pinning setup failure break startup', async () => {
        mockInitializeSslPinning.mockRejectedValue(new Error('native boom'))
        const deps = makeDeps()

        await expect(initializeSslPinningService(deps)).resolves.toBeUndefined()
        expect(deps.crashReporting.recordNonFatalError).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'native boom' }),
        )
    })
})
