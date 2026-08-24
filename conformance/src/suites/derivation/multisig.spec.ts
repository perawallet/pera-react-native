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

import algosdk from 'algosdk'
import { describe, expect, it } from 'vitest'

import { generateMultisigAddress } from '@perawallet/wallet-core-blockchain/utils/multisig'

import {
    createAlgo25Account,
    fundAccount,
    type ConformanceAccount,
} from '../../harness/accounts'
import { getConformanceClient } from '../../harness/client'
import { createConformanceKeyStore } from '../../harness/keystore'

describe('multisig derivation conformance', () => {
    it('matches algosdk.multisigAddress for a fixed member set', async () => {
        const ks = await createConformanceKeyStore()
        const members: ConformanceAccount[] = [
            await createAlgo25Account(ks),
            await createAlgo25Account(ks),
            await createAlgo25Account(ks),
        ]
        const version = 1
        const threshold = 2

        const address = generateMultisigAddress(
            version,
            threshold,
            members.map(member => member.address),
        )

        expect(address).toBe(
            algosdk
                .multisigAddress({
                    version,
                    threshold,
                    addrs: members.map(member => member.address),
                })
                .toString(),
        )
    })

    it('is the address the chain credits', async () => {
        const ks = await createConformanceKeyStore()
        const members: ConformanceAccount[] = [
            await createAlgo25Account(ks),
            await createAlgo25Account(ks),
            await createAlgo25Account(ks),
        ]
        const address = generateMultisigAddress(
            1,
            2,
            members.map(member => member.address),
        )
        await fundAccount(address, 1_000_000n)

        const info = await getConformanceClient()
            .client.algod.accountInformation(address)
            .do()

        expect(BigInt(info.amount)).toBe(1_000_000n)
    })
})
