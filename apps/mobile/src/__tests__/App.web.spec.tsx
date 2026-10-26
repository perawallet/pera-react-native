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

import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@test-utils/render'
import { App } from '../App.web'

const mocks = vi.hoisted(() => ({
    hydratePlatform: vi.fn(() => Promise.resolve()),
    installOffscreenStorageShim: vi.fn(),
    runOffscreenApp: vi.fn(() => Promise.resolve()),
    registerHardwareWalletTransports: vi.fn(),
    registerChainAdapters: vi.fn(),
    markDatabaseResetNoticePending: vi.fn(),
    submitAndAutoRefresh: vi.fn(() => Promise.resolve(['0xh'])),
}))

vi.mock('@perawallet/wallet-extension-platform-chrome/bootstrap', () => ({
    getSurface: () => 'offscreen',
    hydratePlatform: mocks.hydratePlatform,
    installOffscreenStorageShim: mocks.installOffscreenStorageShim,
}))
vi.mock('@browser/offscreen/runOffscreenApp', () => ({
    runOffscreenApp: mocks.runOffscreenApp,
}))
vi.mock('../bootstrap/hardware-wallet-transports', () => ({
    registerHardwareWalletTransports: mocks.registerHardwareWalletTransports,
}))
vi.mock('../bootstrap/databaseResetNotice', () => ({
    markDatabaseResetNoticePending: mocks.markDatabaseResetNoticePending,
}))
vi.mock('../bootstrap/chain-adapters', () => ({
    registerChainAdapters: mocks.registerChainAdapters,
}))
vi.mock('@perawallet/wallet-core-signing', () => ({
    submitAndAutoRefresh: mocks.submitAndAutoRefresh,
}))

describe('App (web) on the offscreen surface', () => {
    it('hands the app chain registration to the offscreen document after hydration', async () => {
        render(<App />)

        await waitFor(() =>
            expect(mocks.runOffscreenApp).toHaveBeenCalledOnce(),
        )
        expect(mocks.runOffscreenApp).toHaveBeenCalledWith({
            registerChainAdapters: mocks.registerChainAdapters,
            onDatabaseReset: mocks.markDatabaseResetNoticePending,
            submitSignedTransactions: expect.any(Function),
        })
        expect(mocks.hydratePlatform.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.runOffscreenApp.mock.invocationCallOrder[0],
        )
    })

    it('hands the offscreen document a broadcast on the signed transactions’ own scope', async () => {
        render(<App />)
        await waitFor(() =>
            expect(mocks.runOffscreenApp).toHaveBeenCalledOnce(),
        )
        const [{ submitSignedTransactions }] = mocks.runOffscreenApp.mock
            .calls[0] as unknown as [
            {
                submitSignedTransactions: (
                    signed: unknown[],
                ) => Promise<string[]>
            },
        ]
        const scope = { chainId: 'ethereum', networkId: 'sepolia' }
        const signed = [{ scope, id: '0xh', bytes: new Uint8Array([1]) }]

        await expect(submitSignedTransactions(signed)).resolves.toEqual(['0xh'])
        expect(mocks.submitAndAutoRefresh).toHaveBeenCalledWith(scope, signed)
    })
})
