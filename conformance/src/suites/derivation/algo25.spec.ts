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

import { createAlgo25Account, fundAccount } from '../../harness/accounts'
import { algokeyAddressFromMnemonic } from '../../harness/algokey'
import { getConformanceClient } from '../../harness/client'
import { createConformanceKeyStore } from '../../harness/keystore'

describe('algo25 derivation conformance', () => {
    it('matches the algokey oracle', async () => {
        const ks = await createConformanceKeyStore()
        const account = await createAlgo25Account(ks)

        expect(account.address).toBe(
            await algokeyAddressFromMnemonic(account.mnemonic),
        )
    })

    it('funds the algokey-derived address and the chain credits the app-derived one', async () => {
        const ks = await createConformanceKeyStore()
        const account = await createAlgo25Account(ks)

        const oracleAddress = await algokeyAddressFromMnemonic(account.mnemonic)
        await fundAccount(oracleAddress, 1_000_000n)

        // Funding the oracle's address and querying the app's makes this leg
        // sensitive to a wrong derivation: if the two diverged, this account
        // would show a zero balance instead of the assertion failing to even
        // find a mismatched address.
        const info = await getConformanceClient()
            .client.algod.accountInformation(account.address)
            .do()

        expect(BigInt(info.amount)).toBe(1_000_000n)
    })
})
