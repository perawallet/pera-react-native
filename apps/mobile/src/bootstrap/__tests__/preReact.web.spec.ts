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
        initDecimalConfig: record('initDecimalConfig'),
        registerAppBottomSheets: record('registerAppBottomSheets'),
        registerChainAdapters: record('registerChainAdapters'),
        updateQueryHeaders: record('updateQueryHeaders'),
        initNetworkStatus: vi.fn(() => {
            calls.push('initNetworkStatus')
            return Promise.resolve()
        }),
    }
})

vi.mock('@perawallet/wallet-core-shared', () => ({
    initDecimalConfig: mocks.initDecimalConfig,
}))
vi.mock('../bottom-sheet-registrations', () => ({
    registerAppBottomSheets: mocks.registerAppBottomSheets,
}))
vi.mock('../chain-adapters', () => ({
    registerChainAdapters: mocks.registerChainAdapters,
}))
vi.mock('../query-headers', () => ({
    updateQueryHeaders: mocks.updateQueryHeaders,
}))
vi.mock('@modules/network', () => ({
    initNetworkStatus: mocks.initNetworkStatus,
}))

import { initRuntime } from '../preReact.web'

describe('initRuntime (web)', () => {
    beforeEach(() => {
        mocks.calls.length = 0
        vi.clearAllMocks()
    })

    it('has no effect until called, so App.web.tsx can hold it until after hydration', () => {
        expect(mocks.calls).toEqual([])
    })

    it('configures Decimal, registers sheets and chain adapters, sets backend headers and seeds network status', () => {
        initRuntime()

        expect(mocks.calls).toEqual([
            'initDecimalConfig',
            'registerAppBottomSheets',
            'registerChainAdapters',
            'updateQueryHeaders',
            'initNetworkStatus',
        ])
    })
})
