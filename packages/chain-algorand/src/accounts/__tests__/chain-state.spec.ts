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
import { Decimal } from 'decimal.js'
import { toAlgorandChainState } from '../chain-state'

describe('toAlgorandChainState', () => {
    it('converts display-unit minBalance to microAlgos and carries the rest', () => {
        const state = toAlgorandChainState({
            minBalance: new Decimal('0.1'),
            status: 'Online',
            authAddress: 'AUTH',
            totalAssetsOptedIn: 1,
            totalCreatedAssets: 2,
            totalAppsOptedIn: 3,
        })

        expect(state).toEqual({
            family: 'algorand',
            minBalance: new Decimal(100000),
            status: 'Online',
            authAddress: 'AUTH',
            totalAssetsOptedIn: 1,
            totalCreatedAssets: 2,
            totalAppsOptedIn: 3,
        })
    })

    it('leaves authAddress out when null', () => {
        expect(toAlgorandChainState({ authAddress: null })).not.toHaveProperty(
            'authAddress',
        )
    })

    it('reads an unknown status as Offline', () => {
        expect(
            toAlgorandChainState({ authAddress: null, status: 'Weird' }).status,
        ).toBe('Offline')
    })

    it('takes the column defaults for a bare authority', () => {
        expect(toAlgorandChainState({ authAddress: 'X' })).toEqual({
            family: 'algorand',
            minBalance: new Decimal(0),
            status: 'Offline',
            authAddress: 'X',
            totalAssetsOptedIn: 0,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
        })
    })
})
