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
import { knownEvmContractLabelOf } from '../known-contract-label'

const PERMIT2 = '0x000000000022d473030f116ddee9f6b43ac78ba3'

describe('knownEvmContractLabelOf', () => {
    it("names a registry contract on the scope's network, whatever its address case", () => {
        expect(
            knownEvmContractLabelOf(
                { chainId: 'ethereum', networkId: 'mainnet' },
                PERMIT2,
            ),
        ).toMatchObject({ name: 'Permit2' })
    })

    it('names nothing on a chain that is not EVM', () => {
        expect(
            knownEvmContractLabelOf(
                { chainId: 'algorand', networkId: 'mainnet' },
                PERMIT2,
            ),
        ).toBeUndefined()
    })
})
