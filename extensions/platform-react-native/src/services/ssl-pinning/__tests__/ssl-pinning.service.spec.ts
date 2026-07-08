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

const makeDeps = (
    overrides: {
        isPinningEnabled?: boolean
        backendUrls?: readonly string[]
    } = {},
) => {
    const { isPinningEnabled = true, backendUrls } = overrides
    return {
        remoteConfig: {
            getBooleanValue: vi.fn().mockReturnValue(isPinningEnabled),
        },
        analytics: { logEvent: vi.fn() },
        crashReporting: { recordNonFatalError: vi.fn() },
        backendUrls: backendUrls ?? ['https://mainnet.api.perawallet.app'],
    }
}

describe('initializeSslPinningService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsSslPinningAvailable.mockReturnValue(true)
        mockInitializeSslPinning.mockResolvedValue(undefined)
    })

    test('does not enable pinning while the remote flag is off', async () => {
        const deps = makeDeps({ isPinningEnabled: false })

        await initializeSslPinningService(deps)

        expect(deps.remoteConfig.getBooleanValue).toHaveBeenCalledWith(
            'enable_ssl_pinning',
            false,
        )
        expect(mockInitializeSslPinning).not.toHaveBeenCalled()
        expect(mockAddSslPinningErrorListener).not.toHaveBeenCalled()
    })

    test('enables pinning for the configured backend hosts when the flag is on', async () => {
        const deps = makeDeps({
            backendUrls: [
                'https://mainnet.api.perawallet.app',
                'https://testnet.api.perawallet.app',
            ],
        })

        await initializeSslPinningService(deps)

        expect(mockInitializeSslPinning).toHaveBeenCalledWith({
            'mainnet.api.perawallet.app': {
                includeSubdomains: false,
                publicKeyHashes: [...PINNED_ROOT_SPKI_HASHES],
                expirationDate: SSL_PINNING_EXPIRATION_DATE,
            },
            'testnet.api.perawallet.app': {
                includeSubdomains: false,
                publicKeyHashes: [...PINNED_ROOT_SPKI_HASHES],
                expirationDate: SSL_PINNING_EXPIRATION_DATE,
            },
        })
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
