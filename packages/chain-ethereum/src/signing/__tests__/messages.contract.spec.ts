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

import { toHex } from 'viem'
import { messageSignerContractTests } from '@perawallet/wallet-core-signing/testing'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    ethereumMessageSignerAdapter,
    personalSignMessageRequest,
    typedDataMessageRequest,
} from '../messages'
import {
    ETHEREUM_SIGNER_ACCOUNT,
    MAIL_TYPED_DATA,
    SENDER,
    vectorSignature,
} from './fixtures'

const scope: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

messageSignerContractTests(() => ethereumMessageSignerAdapter, {
    scope,
    account: ETHEREUM_SIGNER_ACCOUNT,
    accounts: [ETHEREUM_SIGNER_ACCOUNT],
    requests: [
        personalSignMessageRequest(scope, SENDER, toHex('hello world')),
        typedDataMessageRequest(scope, SENDER, MAIL_TYPED_DATA),
    ],
    malformedRequest: typedDataMessageRequest(scope, SENDER, {
        primaryType: 'Mail',
    }),
    unsupportedMethod: 'eth_sign',
    otherSigner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    sign: request => vectorSignature(request.payload),
})
