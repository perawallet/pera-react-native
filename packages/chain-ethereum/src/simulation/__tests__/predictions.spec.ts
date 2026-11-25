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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    clearPredictions,
    predictedBalanceChangesOf,
    rememberPrediction,
    type PredictedCall,
} from '../predictions'
import type { EvmTransactionSimulation } from '../types'

const SCOPE: ChainScope = { chainId: 'base', networkId: 'mainnet' }
const CALL: PredictedCall = {
    from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    value: new Decimal('0'),
    data: '0x80500d20',
}
const WITHDRAW: EvmTransactionSimulation = {
    status: 'success',
    blockNumber: 1,
    approvalChanges: [],
    assetChanges: [
        { assetId: 'native', standard: 'native', amount: new Decimal('3000') },
        {
            assetId: '0xA0d9C1e9F4bB0C7aA7E1e2b6c7b7F4a6E0dDfC24',
            standard: 'erc20',
            amount: new Decimal('-2990'),
        },
        { assetId: '0xdead', standard: 'erc20', amount: new Decimal('0') },
    ],
}

describe('simulation predictions', () => {
    beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }))
    afterEach(() => {
        vi.useRealTimers()
        clearPredictions()
    })

    it('gives back the non-zero changes a successful simulation predicted, spent first', () => {
        rememberPrediction(SCOPE, CALL, WITHDRAW)

        const changes = predictedBalanceChangesOf(SCOPE, CALL)

        expect(
            changes?.map(({ assetRef, value }) => [
                assetRef.chainId,
                assetRef.assetId,
                value.toFixed(),
            ]),
        ).toEqual([
            ['base', '0xA0d9C1e9F4bB0C7aA7E1e2b6c7b7F4a6E0dDfC24', '-2990'],
            ['base', 'native', '3000'],
        ])
    })

    it('matches the signed call whatever the case of its addresses and calldata', () => {
        rememberPrediction(SCOPE, CALL, WITHDRAW)

        expect(
            predictedBalanceChangesOf(SCOPE, {
                ...CALL,
                from: CALL.from.toLowerCase(),
                to: CALL.to.toUpperCase().replace('0X', '0x'),
                data: '0x80500D20',
            }),
        ).toBeDefined()
    })

    it.each([
        ['another network', { chainId: 'base', networkId: 'sepolia' }, CALL],
        ['another value', SCOPE, { ...CALL, value: new Decimal('1') }],
        ['other calldata', SCOPE, { ...CALL, data: '0x00' as const }],
    ] as const)('predicts nothing for %s', (_label, scope, call) => {
        rememberPrediction(SCOPE, CALL, WITHDRAW)

        expect(predictedBalanceChangesOf(scope, call)).toBeUndefined()
    })

    it('forgets a prediction once it is stale', () => {
        rememberPrediction(SCOPE, CALL, WITHDRAW)
        vi.setSystemTime(Date.now() + 10 * 60_000 + 1)

        expect(predictedBalanceChangesOf(SCOPE, CALL)).toBeUndefined()
    })

    it.each<[string, EvmTransactionSimulation]>([
        ['a reverted simulation', { status: 'reverted', revertReason: null }],
        ['an unavailable simulation', { status: 'unavailable' }],
        ['a simulation that moves nothing', { ...WITHDRAW, assetChanges: [] }],
    ])('remembers nothing from %s', (_label, simulation) => {
        rememberPrediction(SCOPE, CALL, simulation)

        expect(predictedBalanceChangesOf(SCOPE, CALL)).toBeUndefined()
    })
})
