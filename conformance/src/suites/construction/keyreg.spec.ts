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

import { beforeAll, describe, it } from 'vitest'

import {
    createAlgo25Account,
    fundAccount,
    type ConformanceAccount,
} from '../../harness/accounts'
import type { TxnIntent } from '../../harness/assert/intent'
import { expectConformant } from '../../harness/assert/roundTrip'
import {
    buildTxn,
    signWithKeystore,
    submitAndConfirm,
} from '../../harness/build'
import { getConformanceClient } from '../../harness/client'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'

const balanceOf = async (address: string): Promise<bigint> =>
    (await getConformanceClient().account.getInformation(address)).balance
        .microAlgo

/**
 * Only the offline variant is covered here. An online key registration needs
 * real participation keys (voteKey/selectionKey/stateProofKey/voteFirst/
 * voteLast/voteKeyDilution), and LocalNet's dispenser account has none to
 * hand. Even with a key pair in hand, `TxnIntent` has no projection for those
 * fields (see `harness/assert/intent.ts`'s `READERS`), so an online case
 * could build and submit a transaction but could not assert anything about
 * the participation material it carries — asserting only `type: 'keyreg'`
 * would be a green test that proves nothing about the fields that make an
 * online registration what it is.
 */
describe('key-registration construction conformance', () => {
    let keyStore: ConformanceKeyStore
    let account: ConformanceAccount

    beforeAll(async () => {
        keyStore = await createConformanceKeyStore()
        account = await createAlgo25Account(keyStore)
        await fundAccount(account.address, 1_000_000n)
    })

    it('submits an offline key registration', async () => {
        const senderBalanceBefore = await balanceOf(account.address)

        const txn = await buildTxn(composer => {
            composer.addOfflineKeyRegistration({
                sender: account.address,
            })
        })
        const signedBytes = await signWithKeystore(keyStore, account, txn)
        const { txId } = await submitAndConfirm(signedBytes)

        const intent: TxnIntent = {
            type: 'keyreg',
            sender: account.address,
            fee: txn.fee,
        }

        await expectConformant({
            intent,
            signedBytes,
            txId,
            senderBalanceBefore,
        })
    })
})
