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
import { logger } from '@perawallet/wallet-core-shared'

const providerLogEvent = vi.fn()
let currentMode: 'live' | 'developer' = 'live'
let throwOnGetProvider = false

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => {
        if (throwOnGetProvider) {
            throw new Error('no provider configured')
        }
        return { analytics: { logEvent: providerLogEvent } }
    },
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useNetworkStore: {
        getState: () => ({ mode: currentMode }),
    },
}))

import { logEvent, createBaseLogger, resolveEventName } from '../log'

describe('resolveEventName', () => {
    beforeEach(() => {
        currentMode = 'live'
    })

    it('leaves live event names untouched', () => {
        currentMode = 'live'

        expect(resolveEventName('screen_view')).toBe('screen_view')
    })

    it('prefixes developer mode, whichever network it is on', () => {
        currentMode = 'developer'

        expect(resolveEventName('screen_view')).toBe('t_screen_view')
    })
})

describe('logEvent (base)', () => {
    beforeEach(() => {
        providerLogEvent.mockClear()
        currentMode = 'live'
        throwOnGetProvider = false
    })

    it('forwards the raw name and payload unchanged in live mode', () => {
        logEvent('some_event', { foo: 'bar' })

        expect(providerLogEvent).toHaveBeenCalledWith('some_event', {
            foo: 'bar',
        })
    })

    it('prepends the testnet prefix in developer mode', () => {
        currentMode = 'developer'

        logEvent('some_event')

        expect(providerLogEvent).toHaveBeenCalledWith('t_some_event', undefined)
    })

    it('never throws when the underlying logEvent fails', () => {
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
        providerLogEvent.mockImplementationOnce(() => {
            throw new Error('analytics backend exploded')
        })

        expect(() => logEvent('some_event')).not.toThrow()
        expect(warnSpy).toHaveBeenCalledWith(
            '[analytics] Failed to track event',
            { error: expect.any(Error) },
        )

        warnSpy.mockRestore()
    })

    it('never throws when the provider itself is unavailable', () => {
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
        throwOnGetProvider = true

        expect(() => logEvent('some_event')).not.toThrow()
        expect(warnSpy).toHaveBeenCalledWith(
            '[analytics] Failed to track event',
            { error: expect.any(Error) },
        )
        expect(providerLogEvent).not.toHaveBeenCalled()

        warnSpy.mockRestore()
    })
})

describe('createBaseLogger', () => {
    beforeEach(() => {
        currentMode = 'live'
    })

    it('binds to the provided analytics instance and applies the testnet prefix', () => {
        const analytics = { initializeAnalytics: vi.fn(), logEvent: vi.fn() }
        currentMode = 'developer'

        const log = createBaseLogger(analytics)
        log('bound_event', { a: 1 })

        expect(analytics.logEvent).toHaveBeenCalledWith('t_bound_event', {
            a: 1,
        })
    })

    it('swallows errors from the bound analytics instance', () => {
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
        const analytics = {
            initializeAnalytics: vi.fn(),
            logEvent: vi.fn(() => {
                throw new Error('boom')
            }),
        }

        const log = createBaseLogger(analytics)

        expect(() => log('bound_event')).not.toThrow()
        expect(warnSpy).toHaveBeenCalledWith(
            '[analytics] Failed to track event',
            { error: expect.any(Error) },
        )

        warnSpy.mockRestore()
    })
})
