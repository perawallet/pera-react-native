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

import { describe } from 'vitest'
import { toHex } from 'viem'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { messageSignerContractTests } from '@perawallet/wallet-core-signing/testing'
import {
    createEvmMessageSignerAdapter,
    personalSignMessageRequest,
    typedDataMessageRequest,
} from '../messages'
import {
    eip155IdOf,
    EVM_TEST_CHAINS,
    evmScopeOf,
} from '../../__tests__/evm-chains'
import {
    ETHEREUM_SIGNER_ACCOUNT,
    MAIL_TYPED_DATA,
    SENDER,
    vectorSignature,
} from './fixtures'

for (const chain of EVM_TEST_CHAINS) {
    const scope = evmScopeOf(chain)
    const adapter = createEvmMessageSignerAdapter(chain)
    const account: WalletAccount = {
        ...ETHEREUM_SIGNER_ACCOUNT,
        chains: { [chain.row.id]: ETHEREUM_SIGNER_ACCOUNT.chains.ethereum },
    }
    const requests = [
        personalSignMessageRequest(scope, SENDER, toHex('hello world')),
        typedDataMessageRequest(scope, SENDER, {
            ...MAIL_TYPED_DATA,
            domain: { ...MAIL_TYPED_DATA.domain, chainId: eip155IdOf(chain) },
        }),
    ]
    describe(chain.row.id, () => {
        messageSignerContractTests(() => adapter, {
            scope,
            account,
            accounts: [account],
            requests,
            malformedRequest: typedDataMessageRequest(scope, SENDER, {
                primaryType: 'Mail',
            }),
            unsupportedMethod: 'eth_sign',
            otherSigner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            sign: request => vectorSignature(request.payload),
        })
    })
}
