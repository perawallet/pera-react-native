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

import { describe, expect, it, vi } from 'vitest'
import {
    EVM_RPC_PIN_DOMAINS,
    evmPinnedHosts,
    evmSslPinningFlag,
} from '../pinned-hosts'
import { BASE, ETHEREUM } from '../../__tests__/evm-chains'

const mocks = vi.hoisted(() => ({
    chainEndpointsFor: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-config', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-config')
    >()),
    chainEndpointsFor: mocks.chainEndpointsFor,
}))

describe('evmSslPinningFlag', () => {
    it('gives each chain its own flag, since the registry keys groups by flag', () => {
        expect(evmSslPinningFlag('ethereum')).toBe(
            'enable_ssl_pinning_ethereum_rpc',
        )
        expect(evmSslPinningFlag('base')).not.toBe(
            evmSslPinningFlag('ethereum'),
        )
    })
})

describe('evmPinnedHosts', () => {
    it("lists every built-in URL of the chain's networks, in order", () => {
        mocks.chainEndpointsFor.mockReturnValue({
            mainnet: ['https://a.chain.perawallet.app', 'https://b.example'],
            sepolia: ['https://sepolia.chain.perawallet.app'],
        })

        expect(evmPinnedHosts(ETHEREUM)).toEqual({
            flag: 'enable_ssl_pinning_ethereum_rpc',
            urls: [
                'https://a.chain.perawallet.app',
                'https://b.example',
                'https://sepolia.chain.perawallet.app',
            ],
            domains: EVM_RPC_PIN_DOMAINS,
        })
        expect(mocks.chainEndpointsFor).toHaveBeenCalledWith('ethereum')
    })

    it('pins only under the Pera domain', () => {
        mocks.chainEndpointsFor.mockReturnValue({})

        expect(evmPinnedHosts(BASE)).toMatchObject({
            flag: 'enable_ssl_pinning_base_rpc',
            urls: [],
            domains: ['perawallet.app'],
        })
    })
})
