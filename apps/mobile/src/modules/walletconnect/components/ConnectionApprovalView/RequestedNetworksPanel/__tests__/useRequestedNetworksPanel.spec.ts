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

import { renderHook } from '@testing-library/react'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { RequestedNetwork } from '../../useConnectionApprovalView'
import { useRequestedNetworksPanel } from '../useRequestedNetworksPanel'

const network = (
    chainId: string,
    isAdded: boolean,
    isRequired = false,
): RequestedNetwork => ({
    chainId: chainId as ChainId,
    name: chainId,
    isAdded,
    isRequired,
    canAdd: !isAdded,
    isAdding: false,
    isTestnet: false,
})

const ids = (networks: RequestedNetwork[]) => networks.map(n => n.chainId)

describe('useRequestedNetworksPanel', () => {
    it('groups added networks first, keeps proposal order and counts the hidden ones', () => {
        const requested = [
            network('bsc', false),
            network('ethereum', true),
            network('base', true),
            network('arbitrum', false),
            network('avalanche', false),
            network('polygon', false),
        ]

        const { result } = renderHook(() =>
            useRequestedNetworksPanel(requested),
        )

        expect(ids(result.current.collapsedNetworks)).toEqual([
            'ethereum',
            'base',
        ])
        expect(result.current.hiddenNetworkCount).toBe(4)
        expect(ids(result.current.leadingNetworks)).toEqual([
            'ethereum',
            'base',
        ])
        expect(ids(result.current.optionalNetworks)).toEqual([
            'bsc',
            'arbitrum',
            'avalanche',
            'polygon',
        ])
        expect(result.current.hasOptionalNote).toBe(true)
        expect(result.current.isInitiallyExpanded).toBe(false)
    })

    it('hides nothing when two networks are requested', () => {
        const requested = [network('ethereum', true), network('base', false)]

        const { result } = renderHook(() =>
            useRequestedNetworksPanel(requested),
        )

        expect(result.current.hiddenNetworkCount).toBe(0)
    })

    it('starts open without the optional note when none is added', () => {
        const requested = [network('ethereum', false), network('base', false)]

        const { result } = renderHook(() =>
            useRequestedNetworksPanel(requested),
        )

        expect(result.current.isInitiallyExpanded).toBe(true)
        expect(result.current.hasOptionalNote).toBe(false)
    })

    it('has no optional networks and no note when all are added', () => {
        const requested = [network('ethereum', true), network('base', true)]

        const { result } = renderHook(() =>
            useRequestedNetworksPanel(requested),
        )

        expect(result.current.optionalNetworks).toEqual([])
        expect(result.current.hasOptionalNote).toBe(false)
    })

    it('keeps a required network that is not added above the optional note', () => {
        const requested = [
            network('algorand', true),
            network('bsc', false),
            network('ethereum', false, true),
        ]

        const { result } = renderHook(() =>
            useRequestedNetworksPanel(requested),
        )

        expect(ids(result.current.leadingNetworks)).toEqual([
            'algorand',
            'ethereum',
        ])
        expect(ids(result.current.optionalNetworks)).toEqual(['bsc'])
        expect(result.current.hasOptionalNote).toBe(true)
    })

    it('starts open when a required network is not added yet', () => {
        const requested = [
            network('algorand', true),
            network('ethereum', false, true),
        ]

        const { result } = renderHook(() =>
            useRequestedNetworksPanel(requested),
        )

        expect(result.current.isInitiallyExpanded).toBe(true)
        expect(result.current.hasOptionalNote).toBe(false)
    })

    it('moves a network to the added group once it is added', () => {
        const { result, rerender } = renderHook(
            ({ requested }) => useRequestedNetworksPanel(requested),
            {
                initialProps: {
                    requested: [
                        network('ethereum', true),
                        network('base', false),
                    ],
                },
            },
        )

        rerender({
            requested: [network('ethereum', true), network('base', true)],
        })

        expect(ids(result.current.leadingNetworks)).toEqual([
            'ethereum',
            'base',
        ])
        expect(result.current.optionalNetworks).toEqual([])
    })
})
