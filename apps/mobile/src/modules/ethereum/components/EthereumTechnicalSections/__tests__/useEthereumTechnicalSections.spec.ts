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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    decodeEvmVerifiedCall,
    useEvmContractAbiQuery,
} from '@perawallet/wallet-core-chain-ethereum'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import type { EthereumTransactionPresentation } from '../../../hooks/useEthereumTransactionPresentation'
import { useEthereumTechnicalSections } from '../useEthereumTechnicalSections'

vi.mock('@perawallet/wallet-core-chain-ethereum', async importOriginal => ({
    ...(await importOriginal<object>()),
    useEvmContractAbiQuery: vi.fn(),
    decodeEvmVerifiedCall: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    useChainCapability: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-chain-contract', async importOriginal => ({
    ...(await importOriginal<object>()),
    addressCodecs: {
        get: () => ({
            truncate: (address: string) => `short:${address}`,
            normalize: (address: string) => `norm:${address}`,
        }),
    },
}))

const mockCopy = vi.hoisted(() => vi.fn())
vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mockCopy }),
}))

vi.mock('@modules/signing', () => ({
    isKnownContractSite: (
        domain?: string,
        _source?: unknown,
        origin?: string,
    ) => !!domain && !!origin?.includes(domain),
}))

const presentationOf = (
    view: Partial<EthereumTransactionPresentation['view']>,
    knownContract: EthereumTransactionPresentation['knownContract'] = null,
) =>
    ({
        scope: { chainId: 'ethereum', networkId: 'sepolia' },
        knownContract,
        view: {
            kind: 'contract-call',
            to: '0xpool',
            selector: '0x617ba037',
            data: '0x617ba037',
            ...view,
        },
    }) as unknown as EthereumTransactionPresentation

const sectionsOf = (
    presentation: EthereumTransactionPresentation,
    verifiedOrigin?: string,
) =>
    renderHook(() =>
        useEthereumTechnicalSections(presentation, undefined, verifiedOrigin),
    ).result.current

describe('useEthereumTechnicalSections', () => {
    beforeEach(() => {
        vi.mocked(useChainCapability).mockReturnValue(true)
        vi.mocked(useEvmContractAbiQuery).mockReturnValue({
            data: undefined,
            isPending: true,
        } as ReturnType<typeof useEvmContractAbiQuery>)
        vi.mocked(decodeEvmVerifiedCall).mockReturnValue(undefined)
    })

    it('decodes a verified call into its function, arguments and proxy implementation', () => {
        vi.mocked(useEvmContractAbiQuery).mockReturnValue({
            data: { status: 'verified' },
            isPending: false,
        } as ReturnType<typeof useEvmContractAbiQuery>)
        vi.mocked(decodeEvmVerifiedCall).mockReturnValue({
            functionName: 'supply',
            arguments: [{ name: 'asset' }],
            proxy: { implementation: '0ximpl' },
        } as unknown as ReturnType<typeof decodeEvmVerifiedCall>)

        expect(sectionsOf(presentationOf({}))).toMatchObject({
            isDecoded: true,
            isLoading: false,
            functionName: 'supply',
            arguments: [{ name: 'asset' }],
            implementation: '0ximpl',
        })
    })

    it('falls back to the selector while the contract is unverified or loading', () => {
        const sections = sectionsOf(presentationOf({}))

        expect(sections).toMatchObject({
            isDecoded: false,
            isLoading: true,
            functionName: '0x617ba037',
            arguments: [],
        })
    })

    it('never looks the contract up when decoding is off for the chain', () => {
        vi.mocked(useChainCapability).mockReturnValue(false)

        const sections = sectionsOf(presentationOf({}))

        expect(vi.mocked(useEvmContractAbiQuery)).toHaveBeenCalledWith(
            expect.objectContaining({ isEnabled: false }),
        )
        expect(sections.isLoading).toBe(false)
    })

    it('has no target or function for a contract creation', () => {
        const sections = sectionsOf(
            presentationOf({ to: undefined, selector: undefined }),
        )

        expect(sections).toMatchObject({
            isContractCall: true,
            hasTarget: false,
            hasFunction: false,
            shortAddress: '',
        })
    })

    it('names a known contract, and its domain only when the request came from that site', () => {
        const aave = { name: 'Aave V3 Pool', projectDomain: 'aave.com' }

        expect(
            sectionsOf(
                presentationOf({}, aave as never),
                'https://app.aave.com',
            ),
        ).toMatchObject({
            contractName: 'Aave V3 Pool',
            matchedDomain: 'aave.com',
        })
        expect(
            sectionsOf(presentationOf({}, aave as never), 'https://evil.xyz')
                .matchedDomain,
        ).toBeUndefined()
    })

    it('copies the normalised contract address', () => {
        const { handleCopyAddress, shortAddress } = sectionsOf(
            presentationOf({}),
        )

        act(() => handleCopyAddress())

        expect(shortAddress).toBe('short:0xpool')
        expect(mockCopy).toHaveBeenCalledWith('norm:0xpool')
    })
})
