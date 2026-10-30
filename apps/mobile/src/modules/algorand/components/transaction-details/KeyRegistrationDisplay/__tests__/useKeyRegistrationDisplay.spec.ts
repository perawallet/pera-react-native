/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { AlgorandTransactionView } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { useKeyRegistrationDisplay } from '../useKeyRegistrationDisplay'

const transaction = (
    overrides: Partial<AlgorandTransactionView> = {},
): AlgorandTransactionView =>
    ({
        id: 'TX_ID',
        keyregTransaction: {
            voteParticipationKey: new Uint8Array([1, 2, 3]),
        },
        ...overrides,
    }) as AlgorandTransactionView

describe('useKeyRegistrationDisplay', () => {
    it('reports an online key registration with its participation keys', () => {
        const {result} = renderHook(() =>
            useKeyRegistrationDisplay({transaction: transaction()}),
        )

        expect(result.current.keyRegType).toBe('online')
        expect(result.current.participationKeys.vote).toBe('AQID')
    })

    it('warns when the transaction carries no id', () => {
        const {result} = renderHook(() =>
            useKeyRegistrationDisplay({transaction: transaction({id: ''})}),
        )

        expect(result.current.showWarnings).toBe(true)
    })
})
