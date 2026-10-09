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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { PinningError } from 'react-native-ssl-public-key-pinning'
import { pinnedHostRegistry } from '@perawallet/wallet-extension-platform'
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

const FIXTURE_FLAG = 'enable_ssl_pinning_fixture'

const fixtureGroup = (urls: readonly string[]) => ({
    flag: FIXTURE_FLAG,
    urls,
    domains: ['fixture.example'],
})

const makeDeps = (
    overrides: {
        isBackendPinningEnabled?: boolean
        isFixturePinningEnabled?: boolean
        backendUrls?: readonly string[]
        fixtureUrls?: readonly string[]
    } = {},
) => {
    const {
        isBackendPinningEnabled = true,
        isFixturePinningEnabled = false,
        backendUrls = ['https://mainnet.api.perawallet.app'],
        fixtureUrls = [],
    } = overrides
    return {
        remoteConfig: {
            getBooleanValue: vi.fn((key: string) =>
                key === FIXTURE_FLAG
                    ? isFixturePinningEnabled
                    : isBackendPinningEnabled,
            ),
        },
        analytics: { logEvent: vi.fn() },
        crashReporting: { recordNonFatalError: vi.fn() },
        backendUrls,
        pinnedHostGroups: [fixtureGroup(fixtureUrls)],
    }
}

describe('initializeSslPinningService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        pinnedHostRegistry.reset()
        mockIsSslPinningAvailable.mockReturnValue(true)
        mockInitializeSslPinning.mockResolvedValue(undefined)
    })

    test('does not enable pinning while both remote flags are off', async () => {
        const deps = makeDeps({
            isBackendPinningEnabled: false,
            isFixturePinningEnabled: false,
        })

        await initializeSslPinningService(deps)

        expect(deps.remoteConfig.getBooleanValue).toHaveBeenCalledWith(
            'enable_ssl_pinning_pera_api',
            false,
        )
        expect(deps.remoteConfig.getBooleanValue).toHaveBeenCalledWith(
            FIXTURE_FLAG,
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
            fixtureUrls: ['https://node.fixture.example'],
        })

        await initializeSslPinningService(deps)

        expect(mockInitializeSslPinning).toHaveBeenCalledWith({
            'mainnet.api.perawallet.app': pinEntry(),
            'testnet.api.perawallet.app': pinEntry(),
        })
    })

    test("pins only a chain group's hosts when only its flag is on", async () => {
        const deps = makeDeps({
            isBackendPinningEnabled: false,
            isFixturePinningEnabled: true,
            fixtureUrls: [
                'https://node.fixture.example',
                'https://indexer.fixture.example',
            ],
        })

        await initializeSslPinningService(deps)

        expect(mockInitializeSslPinning).toHaveBeenCalledWith({
            'node.fixture.example': pinEntry(),
            'indexer.fixture.example': pinEntry(),
        })
    })

    test("never pins a chain group's hosts outside its domains", async () => {
        const deps = makeDeps({
            isBackendPinningEnabled: false,
            isFixturePinningEnabled: true,
            fixtureUrls: [
                'https://node.fixture.example',
                'https://evil-fixture.example',
                'http://localhost:4001',
            ],
        })

        await initializeSslPinningService(deps)

        expect(mockInitializeSslPinning).toHaveBeenCalledWith({
            'node.fixture.example': pinEntry(),
        })
    })

    test('pins the backend and every chain group in a single initialization', async () => {
        const deps = makeDeps({
            isFixturePinningEnabled: true,
            backendUrls: ['https://mainnet.api.perawallet.app'],
            fixtureUrls: ['https://node.fixture.example'],
        })

        await initializeSslPinningService(deps)

        expect(mockInitializeSslPinning).toHaveBeenCalledTimes(1)
        expect(mockInitializeSslPinning).toHaveBeenCalledWith({
            'mainnet.api.perawallet.app': pinEntry(),
            'node.fixture.example': pinEntry(),
        })
    })

    test('reads the chain groups from the pinned-host registry by default', async () => {
        pinnedHostRegistry.declare(fixtureGroup(['https://node.fixture.example']))
        const { pinnedHostGroups: _, ...deps } = makeDeps({
            isBackendPinningEnabled: false,
            isFixturePinningEnabled: true,
        })

        await initializeSslPinningService(deps)

        expect(mockInitializeSslPinning).toHaveBeenCalledWith({
            'node.fixture.example': pinEntry(),
        })
    })

    test('the backend group never pins third-party chain domains', async () => {
        const deps = makeDeps({
            // A chain host leaking into the backend URL list must not be
            // pinned by the backend group.
            backendUrls: ['https://node.fixture.example'],
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
