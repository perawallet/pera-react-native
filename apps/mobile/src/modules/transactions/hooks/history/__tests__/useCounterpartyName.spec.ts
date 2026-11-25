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
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { useResolvedAddress } from '@hooks/useResolvedAddress'
import { useCounterpartyName } from '../useCounterpartyName'

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useChainCapability: vi.fn(),
    getChainDescriptor: (chainId: string) => ({
        family: chainId === 'algorand' ? 'algorand' : 'evm',
    }),
}))

vi.mock('@hooks/useResolvedAddress', () => ({
    useResolvedAddress: vi.fn(() => ({
        displayName: 'resolved',
        isNamed: false,
        isResolving: false,
    })),
}))

describe('useCounterpartyName', () => {
    beforeEach(() => {
        vi.mocked(useResolvedAddress).mockClear()
        vi.mocked(useAllAccounts).mockReturnValue([])
        vi.mocked(useContacts).mockReturnValue({
            contacts: [],
        } as unknown as ReturnType<typeof useContacts>)
    })

    it('looks the name up on a chain with a name service', () => {
        vi.mocked(useChainCapability).mockReturnValue(true)

        const { result } = renderHook(() =>
            useCounterpartyName('ADDR', 'algorand'),
        )

        expect(result.current).toBe('resolved')
        expect(useChainCapability).toHaveBeenCalledWith(
            'algorand',
            'nameService',
        )
        expect(useResolvedAddress).toHaveBeenCalledWith(
            'ADDR',
            expect.objectContaining({ chainId: 'algorand' }),
            { enabled: true },
        )
    })

    it("only truncates with the chain's codec on a chain without one", () => {
        vi.mocked(useChainCapability).mockReturnValue(false)

        renderHook(() => useCounterpartyName('0xabc', 'ethereum'))

        expect(useResolvedAddress).toHaveBeenCalledWith(
            '0xabc',
            expect.objectContaining({ chainId: 'ethereum' }),
            { enabled: false },
        )
    })

    it('skips the lookup when there is no counterparty', () => {
        vi.mocked(useChainCapability).mockReturnValue(true)

        renderHook(() => useCounterpartyName('', 'algorand'))

        expect(useResolvedAddress).toHaveBeenCalledWith(
            '',
            expect.objectContaining({ chainId: 'algorand' }),
            { enabled: false },
        )
    })

    it("names one of the wallet's own accounts, without asking the name service", () => {
        vi.mocked(useChainCapability).mockReturnValue(true)
        vi.mocked(useAllAccounts).mockReturnValue([
            { name: 'Savings', chains: { ethereum: { address: '0xabc' } } },
        ] as unknown as ReturnType<typeof useAllAccounts>)

        const { result } = renderHook(() =>
            useCounterpartyName('0xabc', 'ethereum'),
        )

        expect(result.current).toBe('Savings')
        expect(useResolvedAddress).toHaveBeenCalledWith(
            '0xabc',
            expect.anything(),
            { enabled: false },
        )
    })

    it('names a contact holding the address on that chain family, without asking the name service', () => {
        vi.mocked(useChainCapability).mockReturnValue(true)
        vi.mocked(useContacts).mockReturnValue({
            contacts: [{ name: 'Alice', addresses: { evm: '0xabc' } }],
        } as unknown as ReturnType<typeof useContacts>)

        const { result } = renderHook(() =>
            useCounterpartyName('0xabc', 'ethereum'),
        )

        expect(result.current).toBe('Alice')
        expect(useResolvedAddress).toHaveBeenCalledWith(
            '0xabc',
            expect.anything(),
            { enabled: false },
        )
    })
})
