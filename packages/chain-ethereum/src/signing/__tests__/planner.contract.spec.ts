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

import { transactionPlannerContractTests } from '@perawallet/wallet-core-chain-contract/testing'
import {
    i18nKey,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { SIGNING_ACCESS_DOMAIN } from '@perawallet/wallet-core-kms/constants'
import { createEvmPlannerAdapter } from '../adapter'
import {
    eip155IdOf,
    EVM_TEST_CHAINS,
    evmScopeOf,
} from '../../__tests__/evm-chains'
import type { EvmChain } from '../../chains/types'
import { SENDER, TRANSFER, createVectorKeyStore } from './fixtures'

const transferFrom = (
    chain: EvmChain,
    payload: unknown,
): UnsignedTransaction => ({
    scope: evmScopeOf(chain),
    payload,
    summary: {
        kind: 'transfer',
        title: { key: i18nKey('test') },
        direction: 'out',
        icon: 'send',
    },
    chainData: { family: 'evm' },
})

const { kms } = createVectorKeyStore()

for (const chain of EVM_TEST_CHAINS) {
    const transfer = { ...TRANSFER, chainId: eip155IdOf(chain) }
    transactionPlannerContractTests(() => createEvmPlannerAdapter(chain), {
        transaction: transferFrom(chain, {
            from: SENDER,
            transaction: transfer,
        }),
        otherTransaction: transferFrom(chain, {
            from: SENDER,
            transaction: { ...transfer, nonce: 2 },
        }),
        malformedTransaction: transferFrom(chain, { transaction: transfer }),
        sign: request =>
            kms.sign('kms-entry-1', request.payload, SIGNING_ACCESS_DOMAIN),
        stranger: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    })
}
