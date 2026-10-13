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
import {
    ChainAdapterNotRegisteredError,
    scopeForLegacyNetwork,
} from '@perawallet/wallet-core-chain-contract'
import { PeraServiceUnavailableError } from '@perawallet/wallet-core-shared'
import {
    buildKeyRegistrationTx,
    sendFlowChainAdapters,
    sendFlowFeatureFor,
    type AssetInboxSendFlow,
    type SendFlowChainAdapter,
} from '../chain-adapter'

const scope = scopeForLegacyNetwork('testnet')

const fakeAssetInbox = (): AssetInboxSendFlow => ({
    buildSendTxs: vi.fn(),
    buildClaimTxs: vi.fn(),
    buildRejectTxs: vi.fn(),
})

const bareAdapter = (): SendFlowChainAdapter => ({
    chainId: 'algorand',
    buildTransferTxs: vi.fn(),
})

describe('sendFlowFeatureFor', () => {
    beforeEach(() => {
        sendFlowChainAdapters.reset()
    })

    it("resolves a legacy network to its chain's asset inbox", () => {
        const assetInbox = fakeAssetInbox()
        sendFlowChainAdapters.register({ ...bareAdapter(), assetInbox })

        expect(sendFlowFeatureFor(scope, 'assetInbox')).toBe(assetInbox)
    })

    it('names the missing feature when no adapter is registered', () => {
        expect(() => sendFlowFeatureFor(scope, 'assetInbox')).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() => sendFlowFeatureFor(scope, 'assetInbox')).toThrow(
            'No send flow adapter is registered for chain "algorand"',
        )
    })

    it.each([
        'express',
        'assetInbox',
        'assetHolding',
        'rekey',
        'keyRegistration',
    ] as const)('fails closed when the chain has no %s feature', feature => {
        sendFlowChainAdapters.register(bareAdapter())

        expect(() => sendFlowFeatureFor(scope, feature)).toThrow(
            PeraServiceUnavailableError,
        )
    })
})

describe('buildKeyRegistrationTx', () => {
    beforeEach(() => {
        sendFlowChainAdapters.reset()
    })

    it("delegates to the scope's chain adapter", async () => {
        const tx = { id: 'keyreg' }
        const buildTx = vi.fn().mockResolvedValue(tx)
        sendFlowChainAdapters.register({
            ...bareAdapter(),
            keyRegistration: { buildTx },
        })
        const params = { kind: 'offline', scope, sender: 'SENDER' } as const

        await expect(buildKeyRegistrationTx(params)).resolves.toBe(tx)
        expect(buildTx).toHaveBeenCalledWith(params)
    })

    it('fails closed on a chain without key registration', async () => {
        sendFlowChainAdapters.register(bareAdapter())

        await expect(
            buildKeyRegistrationTx({ kind: 'offline', scope, sender: 'S' }),
        ).rejects.toBeInstanceOf(PeraServiceUnavailableError)
    })
})
