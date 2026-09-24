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

const mocks = vi.hoisted(() => {
    const calls: string[] = []
    const record = (name: string) =>
        vi.fn(() => {
            calls.push(name)
        })
    return {
        calls,
        registerAppBottomSheets: record('registerAppBottomSheets'),
        registerLocaleTour: record('registerLocaleTour'),
        initNetworkStatus: vi.fn(() => {
            calls.push('initNetworkStatus')
            return Promise.resolve()
        }),
        initDecimalConfig: record('initDecimalConfig'),
        preventAutoHideAsync: vi.fn(() => {
            calls.push('preventAutoHideAsync')
            return Promise.resolve(true)
        }),
    }
})

vi.mock('../bottom-sheet-registrations', () => ({
    registerAppBottomSheets: mocks.registerAppBottomSheets,
}))
vi.mock('@modules/locale-tour/register', () => ({
    registerLocaleTour: mocks.registerLocaleTour,
}))
vi.mock('@modules/network', () => ({
    initNetworkStatus: mocks.initNetworkStatus,
}))
vi.mock('@perawallet/wallet-core-shared', () => ({
    initDecimalConfig: mocks.initDecimalConfig,
}))
vi.mock('expo-splash-screen', () => ({
    preventAutoHideAsync: mocks.preventAutoHideAsync,
}))

import { initRuntime } from '../preReact'

describe('initRuntime (native)', () => {
    beforeEach(() => {
        mocks.calls.length = 0
        vi.clearAllMocks()
    })

    it('has no effect until called, so the entry decides when startup runs', () => {
        expect(mocks.calls).toEqual([])
    })

    it('registers sheets and the tour, seeds network status, configures Decimal and holds the splash', () => {
        initRuntime()

        expect(mocks.calls).toEqual([
            'registerAppBottomSheets',
            'registerLocaleTour',
            'initNetworkStatus',
            'initDecimalConfig',
            'preventAutoHideAsync',
        ])
    })
})
