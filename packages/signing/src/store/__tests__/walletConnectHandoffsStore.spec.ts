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

import { describe, it, expect, beforeEach } from 'vitest'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    migrateWalletConnectHandoffsState,
    useWalletConnectHandoffsStore,
} from '../walletConnectHandoffsStore'

const v1Record = (signRequestId: string, network: string) => ({
    signRequestId,
    multisigAddress: 'MSIG_ADDR',
    msigMetadata: { version: 1, threshold: 2, addresses: ['A', 'B'] },
    expectedRawTransactionsBase64: ['cmF3'],
    deviceId: 'device-1',
    network,
    sourceType: 'walletconnect',
    proposerAddress: 'A',
    registeredAt: 1_700_000_000_000,
    recovery: {
        clientId: 'wc-client-1',
        payloadId: 7,
        indicesToSign: [0],
        totalLength: 1,
    },
})

describe('migrateWalletConnectHandoffsState', () => {
    it('moves a v1 network onto the Algorand scope, other fields unchanged', () => {
        const { network: _network, ...rest } = v1Record('req-1', 'testnet')

        const migrated = migrateWalletConnectHandoffsState(
            { handoffs: { 'req-1': v1Record('req-1', 'testnet') } },
            1,
        )

        expect(migrated.handoffs).toEqual({
            'req-1': {
                ...rest,
                scope: { chainId: 'algorand', networkId: 'testnet' },
            },
        })
    })

    it('drops a v1 record whose network this build does not know', () => {
        const migrated = migrateWalletConnectHandoffsState(
            {
                handoffs: {
                    'req-1': v1Record('req-1', 'mainnet'),
                    'req-2': v1Record('req-2', 'devnet'),
                },
            },
            1,
        )

        expect(Object.keys(migrated.handoffs)).toEqual(['req-1'])
    })

    it('leaves v2 state untouched', () => {
        const { network: _network, ...rest } = v1Record('req-1', 'testnet')
        const state = {
            handoffs: {
                'req-1': {
                    ...rest,
                    scope: { chainId: 'algorand', networkId: 'testnet' },
                },
            },
        }

        expect(migrateWalletConnectHandoffsState(state, 2)).toEqual(state)
    })
})

describe('useWalletConnectHandoffsStore', () => {
    beforeEach(() => useWalletConnectHandoffsStore.getState().resetState())

    it('replays a pending v1 testnet handoff under the Algorand testnet scope', async () => {
        getProvider().keyValueStorage.setItem(
            'wallet-connect-handoffs-store',
            JSON.stringify({
                state: { handoffs: { 'req-1': v1Record('req-1', 'testnet') } },
                version: 1,
            }),
        )

        await useWalletConnectHandoffsStore.persist.rehydrate()

        const handoff =
            useWalletConnectHandoffsStore.getState().handoffs['req-1']
        expect(handoff?.scope).toEqual({
            chainId: 'algorand',
            networkId: 'testnet',
        })
        expect(handoff).not.toHaveProperty('network')
        expect(handoff?.recovery?.clientId).toBe('wc-client-1')
    })
})
