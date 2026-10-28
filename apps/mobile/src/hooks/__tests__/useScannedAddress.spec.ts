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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    addressCodecs,
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { deeplinkAdapters } from '@perawallet/wallet-core-deeplinks'
import { algorandAddressCodec } from '@packages/chain-algorand/src/accounts/address-codec'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import { registerDeeplinkAdapters } from '@test-utils/deeplink-adapters'
import { useScannedAddress } from '../useScannedAddress'

const mockErrorToast = vi.fn()

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: { chain?: string }) =>
            params?.chain ? `${key}:${params.chain}` : key,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ errorToast: mockErrorToast }),
}))

const ALGORAND_ADDRESS =
    '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA'
const ETHEREUM_ADDRESS = '0x52908400098527886E0F7030069857D2E4169EE7'
const CHAIN_IDS: ChainId[] = [LEGACY_CHAIN_ID]

beforeEach(() => {
    addressCodecs.register(algorandAddressCodec)
    registerEthereumChain()
    registerDeeplinkAdapters()
})

afterEach(() => {
    addressCodecs.reset()
    deeplinkAdapters.reset()
})

describe('useScannedAddress', () => {
    it('returns a bare address on the field chain and stays quiet', () => {
        const { result } = renderHook(() => useScannedAddress(CHAIN_IDS))

        expect(result.current(ALGORAND_ADDRESS)).toBe(ALGORAND_ADDRESS)
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it('returns the address a same-chain URI names', () => {
        const { result } = renderHook(() => useScannedAddress(CHAIN_IDS))

        expect(result.current(`algorand://${ALGORAND_ADDRESS}?amount=1`)).toBe(
            ALGORAND_ADDRESS,
        )
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it('names the chain when the address belongs to another one', () => {
        const { result } = renderHook(() => useScannedAddress(CHAIN_IDS))

        expect(result.current(ETHEREUM_ADDRESS)).toBeNull()
        expect(mockErrorToast).toHaveBeenCalledWith(
            expect.any(String),
            'address_entry.other_chain_qr_body:Ethereum',
            { delayLength: 'short' },
        )
    })

    it('toasts and returns null when the QR carries no address', () => {
        const { result } = renderHook(() => useScannedAddress(CHAIN_IDS))

        expect(result.current('perawallet://app/home')).toBeNull()
        expect(mockErrorToast).toHaveBeenCalledTimes(1)
    })

    // Without the delay the toast animates in while the scanner's native Modal
    // is still sliding out, so it plays behind it.
    it('delays the toast so it lands after the scanner Modal has closed', () => {
        const { result } = renderHook(() => useScannedAddress(CHAIN_IDS))

        result.current('perawallet://app/home')

        expect(mockErrorToast).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            { delayLength: 'short' },
        )
    })
})
