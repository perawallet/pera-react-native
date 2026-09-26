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
import { ChainAdapterNotRegisteredError } from '@perawallet/wallet-core-chain-contract'
import { PeraServiceUnavailableError } from '@perawallet/wallet-core-shared'
import {
    assetInboxFor,
    sendFlowChainAdapters,
    type AssetInboxSendFlow,
} from '../chain-adapter'

const fakeAssetInbox = (): AssetInboxSendFlow => ({
    buildSendTxs: vi.fn(),
    buildClaimTxs: vi.fn(),
    buildRejectTxs: vi.fn(),
})

describe('assetInboxFor', () => {
    beforeEach(() => {
        sendFlowChainAdapters.reset()
    })

    it("resolves a legacy network to its chain's asset inbox", () => {
        const assetInbox = fakeAssetInbox()
        sendFlowChainAdapters.register({ chainId: 'algorand', assetInbox })

        expect(assetInboxFor('testnet')).toBe(assetInbox)
    })

    it('names the missing feature when no adapter is registered', () => {
        expect(() => assetInboxFor('mainnet')).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() => assetInboxFor('mainnet')).toThrow(
            'No send flow adapter is registered for chain "algorand"',
        )
    })

    it('fails closed when the chain has no asset inbox', () => {
        sendFlowChainAdapters.register({ chainId: 'algorand' })

        expect(() => assetInboxFor('mainnet')).toThrow(
            PeraServiceUnavailableError,
        )
    })
})
