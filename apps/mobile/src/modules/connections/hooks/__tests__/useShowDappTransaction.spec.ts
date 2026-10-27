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
import { renderHook } from '@testing-library/react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import { useShowDappTransaction } from '../useShowDappTransaction'

const mockPushWebView = vi.fn()
const mockTransactionUrl = vi.fn()

vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    getChainDescriptor: vi.fn(),
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

describe('useShowDappTransaction', () => {
    beforeEach(() => {
        mockPushWebView.mockReset()
        mockTransactionUrl.mockReset()
        vi.mocked(getChainDescriptor).mockReturnValue({
            explorer: { transactionUrl: mockTransactionUrl },
        } as unknown as ReturnType<typeof getChainDescriptor>)
    })

    it('Given a network with an explorer, when a dApp asks to show a transaction, then it opens there', () => {
        mockTransactionUrl.mockReturnValue('https://etherscan.io/tx/0xabc')
        const { result } = renderHook(() => useShowDappTransaction())

        result.current({ scope: SCOPE, txId: '0xabc' })

        expect(mockTransactionUrl).toHaveBeenCalledWith('mainnet', '0xabc')
        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://etherscan.io/tx/0xabc',
        })
    })

    it('Given a network with no explorer, when a dApp asks to show a transaction, then nothing opens', () => {
        mockTransactionUrl.mockReturnValue(undefined)
        const { result } = renderHook(() => useShowDappTransaction())

        result.current({ scope: SCOPE, txId: '0xabc' })

        expect(mockPushWebView).not.toHaveBeenCalled()
    })
})
