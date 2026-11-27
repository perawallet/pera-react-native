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

import { describe, expect, it } from 'vitest'
import type { EthereumTransactionPresentation } from '../../../hooks/useEthereumTransactionPresentation'
import { ethereumEmptyReceiveOf } from '../ethereumEmptyReceive'

const bridge = {
    kind: 'bridge',
    amount: {},
    destinationName: 'Base',
} as unknown as EthereumTransactionPresentation['contractAction']

const presentationOf = (
    overrides: Partial<
        Pick<EthereumTransactionPresentation, 'isTransfer' | 'contractAction'>
    >,
) => ({ isTransfer: false, contractAction: null, ...overrides })

describe('ethereumEmptyReceiveOf', () => {
    it('reads a transfer as nothing, even when it carries a bridge action', () => {
        expect(
            ethereumEmptyReceiveOf(
                presentationOf({ isTransfer: true, contractAction: bridge }),
            ),
        ).toEqual({ kind: 'nothing' })
    })

    it('reads a decoded bridge as paid on the destination network, by name', () => {
        expect(
            ethereumEmptyReceiveOf(presentationOf({ contractAction: bridge })),
        ).toEqual({ kind: 'other-network', networkName: 'Base' })
    })

    it('leaves the network unnamed when the bridge destination is not one Pera carries', () => {
        const unnamed = {
            kind: 'bridge',
            amount: {},
        } as unknown as EthereumTransactionPresentation['contractAction']

        expect(
            ethereumEmptyReceiveOf(presentationOf({ contractAction: unnamed })),
        ).toEqual({ kind: 'other-network' })
    })

    it.each([
        ['no decoded action', null],
        [
            'another action',
            {
                kind: 'collect-fees',
                tokenId: '1',
            } as unknown as EthereumTransactionPresentation['contractAction'],
        ],
    ])(
        'reads a contract call with %s as not detected',
        (_name, contractAction) => {
            expect(
                ethereumEmptyReceiveOf(presentationOf({ contractAction })),
            ).toEqual({ kind: 'not-detected' })
        },
    )
})
