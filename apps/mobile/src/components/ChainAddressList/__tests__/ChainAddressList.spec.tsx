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

import { fireEvent, render, screen, waitFor } from '@test-utils/render'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { ChainAddressList } from '../ChainAddressList'

const mockCopyToClipboard = vi.fn()

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

const CHAINS = [
    {
        chainId: 'algorand' as ChainId,
        displayName: 'Algorand',
        address: 'ALGO…1234',
        copyValue: 'ALGOFULL1234',
    },
    {
        chainId: 'ethereum' as ChainId,
        displayName: 'Ethereum',
        address: '0xAb…cD',
        copyValue: '0xAbFULLcD',
    },
]

describe('ChainAddressList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("shows each network's name beside its shortened address", () => {
        render(
            <ChainAddressList
                chains={CHAINS}
                testIDPrefix='list'
            />,
        )

        const ethereum = screen.getByTestId('list_ethereum')
        expect(ethereum.textContent).toBe('Ethereum0xAb…cD')
        expect(screen.getByTestId('list_algorand')).toBeTruthy()
    })

    it('copies the full address, not the shortened one, on long-press', async () => {
        render(
            <ChainAddressList
                chains={CHAINS}
                testIDPrefix='list'
            />,
        )

        fireEvent.contextMenu(screen.getByTestId('list_ethereum'))

        await waitFor(() =>
            expect(mockCopyToClipboard).toHaveBeenCalledWith('0xAbFULLcD'),
        )
    })
})
