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

import { beforeEach, describe, expect, it, vi } from 'vitest'

const providerLogEvent = vi.fn()
let currentNetwork = 'mainnet'
let throwOnGetProvider = false

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => {
        if (throwOnGetProvider) {
            throw new Error('no provider configured')
        }
        return { analytics: { logEvent: providerLogEvent } }
    },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetworkStore: {
        getState: () => ({ network: currentNetwork }),
    },
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    isMainnet: (network: string) => network === 'mainnet',
}))

import { logEvent, createBaseLogger, resolveEventName } from '../log'

describe('resolveEventName', () => {
    beforeEach(() => {
        currentNetwork = 'mainnet'
    })

    it('leaves mainnet event names untouched', () => {
        currentNetwork = 'mainnet'

        expect(resolveEventName('screen_view')).toBe('screen_view')
    })

    it('prefixes every non-mainnet network', () => {
        for (const network of ['testnet', 'betanet', 'fnet', 'localnet']) {
            currentNetwork = network

            expect(resolveEventName('screen_view')).toBe('t_screen_view')
        }
    })
})

describe('logEvent (base)', () => {
    beforeEach(() => {
        providerLogEvent.mockClear()
        currentNetwork = 'mainnet'
        throwOnGetProvider = false
    })

    it('forwards the raw name and payload unchanged on mainnet', () => {
        logEvent('some_event', { foo: 'bar' })

        expect(providerLogEvent).toHaveBeenCalledWith('some_event', {
            foo: 'bar',
        })
    })

    it('prepends the testnet prefix when the active network is testnet', () => {
        currentNetwork = 'testnet'

        logEvent('some_event')

        expect(providerLogEvent).toHaveBeenCalledWith('t_some_event', undefined)
    })

    it('never throws when the underlying logEvent fails', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        providerLogEvent.mockImplementationOnce(() => {
            throw new Error('analytics backend exploded')
        })

        expect(() => logEvent('some_event')).not.toThrow()
        expect(warnSpy).toHaveBeenCalled()

        warnSpy.mockRestore()
    })

    it('never throws when the provider itself is unavailable', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        throwOnGetProvider = true

        expect(() => logEvent('some_event')).not.toThrow()
        expect(warnSpy).toHaveBeenCalled()
        expect(providerLogEvent).not.toHaveBeenCalled()

        warnSpy.mockRestore()
    })
})

describe('createBaseLogger', () => {
    beforeEach(() => {
        currentNetwork = 'mainnet'
    })

    it('binds to the provided analytics instance and applies the testnet prefix', () => {
        const analytics = { initializeAnalytics: vi.fn(), logEvent: vi.fn() }
        currentNetwork = 'testnet'

        const log = createBaseLogger(analytics)
        log('bound_event', { a: 1 })

        expect(analytics.logEvent).toHaveBeenCalledWith('t_bound_event', {
            a: 1,
        })
    })

    it('swallows errors from the bound analytics instance', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const analytics = {
            initializeAnalytics: vi.fn(),
            logEvent: vi.fn(() => {
                throw new Error('boom')
            }),
        }

        const log = createBaseLogger(analytics)

        expect(() => log('bound_event')).not.toThrow()
        expect(warnSpy).toHaveBeenCalled()

        warnSpy.mockRestore()
    })
})
