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

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { RampToken } from '@perawallet/wallet-core-onramp'
import { getKnownAssetId } from '@perawallet/wallet-core-assets'
import { algorandRampAdapter as adapter } from '../adapter'

const { mockEnsureOptIn } = vi.hoisted(() => ({ mockEnsureOptIn: vi.fn() }))

vi.mock('../useEnsureDestinationOptIn', () => ({
    useEnsureDestinationOptIn: () => ({ ensureOptIn: mockEnsureOptIn }),
}))

const MAINNET: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const TESTNET: ChainScope = { chainId: 'algorand', networkId: 'testnet' }
const ALGORAND_CAIP2 = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'

const token = (overrides: Partial<RampToken>): RampToken =>
    ({
        id: '31566704',
        symbol: 'USDC',
        name: 'USDC',
        network: { id: 'ALGORAND', name: 'Algorand', logo: null },
        ...overrides,
    }) as RampToken

describe('algorandRampAdapter', () => {
    it('asks the ramp catalogue for ALGO and USDC on Algorand', () => {
        expect(adapter.destinationTokenIds).toEqual(['ALGO', 'USDC_ALGORAND'])
    })

    it('recognises ALGO by its asset id', () => {
        expect(adapter.isNativeToken(token({ id: '0', symbol: 'XALGO' }))).toBe(
            true,
        )
    })

    it('recognises ALGO by its catalogue id', () => {
        expect(
            adapter.isNativeToken(token({ id: 'ALGO', symbol: 'XALGO' })),
        ).toBe(true)
    })

    it('never takes a catalogue token for ALGO by its ticker', () => {
        const lookAlike = token({ id: 'ALGO_LOOKALIKE', symbol: 'ALGO' })

        expect(adapter.isNativeToken(lookAlike)).toBe(false)
        expect(adapter.toAssetId(lookAlike, MAINNET)).toBeNull()
    })

    it('does not treat another asset as ALGO', () => {
        expect(adapter.isNativeToken(token({}))).toBe(false)
    })

    it('ignores an ALGO ticker on a token that has another asset id', () => {
        expect(adapter.isNativeToken(token({ symbol: 'ALGO' }))).toBe(false)
    })

    it('names the Algorand ramp network', () => {
        expect(adapter.rampNetworkIds).toEqual(['ALGORAND'])
    })

    it('recognises ALGO by its CAIP-19 id', () => {
        expect(
            adapter.isNativeToken(
                token({ id: 'X', caip19: `${ALGORAND_CAIP2}/slip44:283` }),
            ),
        ).toBe(true)
        expect(
            adapter.isNativeToken(
                token({ id: 'ALGO', caip19: `${ALGORAND_CAIP2}/asa:31566704` }),
            ),
        ).toBe(false)
    })

    it("pins ALGO to the native asset id whatever the provider's id is", () => {
        expect(
            adapter.toAssetId(token({ id: 'ALGO', symbol: 'ALGO' }), MAINNET),
        ).toBe('0')
    })

    it('keeps a numeric provider id', () => {
        expect(adapter.toAssetId(token({}), MAINNET)).toBe('31566704')
    })

    it('reads the ASA id from the CAIP-19 id', () => {
        expect(
            adapter.toAssetId(
                token({
                    id: 'USDC_ALGORAND',
                    caip19: `${ALGORAND_CAIP2}/asa:42`,
                }),
                MAINNET,
            ),
        ).toBe('42')
    })

    it("resolves the USDC catalogue id to the network's USDC", () => {
        const usdc = token({ id: 'USDC_ALGORAND' })

        expect(adapter.toAssetId(usdc, MAINNET)).toBe('31566704')
        expect(adapter.toAssetId(usdc, TESTNET)).toBe(
            getKnownAssetId('USDC', TESTNET),
        )
    })

    it('places USDC on no asset where the network has no known USDC', () => {
        const usdc = token({ id: 'USDC_ALGORAND' })

        expect(
            adapter.toAssetId(usdc, {
                chainId: 'algorand',
                networkId: 'betanet',
            }),
        ).toBeNull()
    })

    it('places an unknown catalogue id on no asset', () => {
        expect(adapter.toAssetId(token({ id: 'UNKNOWN' }), MAINNET)).toBeNull()
    })

    it('prepares the destination with the ASA opt-in', () => {
        const { result } = renderHook(() => adapter.useEnsureCanReceive?.())

        expect(result.current).toBe(mockEnsureOptIn)
    })
})
