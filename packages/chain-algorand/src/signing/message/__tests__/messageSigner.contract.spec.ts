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

import { beforeEach } from 'vitest'
import { useAccountChainStateStore } from '@perawallet/wallet-core-accounts'
import { getSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    arbitraryDataMessageRequest,
    authDataMessageRequest,
} from '@perawallet/wallet-core-signing'
import { messageSignerContractTests } from '@perawallet/wallet-core-signing/testing'
import { ALGORAND_CHAIN_ID } from '../../../chain-id'
import { algorandMessageSignerAdapter } from '../../adapter'
import {
    messageAccount,
    otherMessageAddress,
    signWithMessageKey,
    siwaAuthPayload,
} from './messageFixtures'

beforeEach(() => {
    useAccountChainStateStore.getState().resetState()
})

const scope = getSelectedScope(ALGORAND_CHAIN_ID)

messageSignerContractTests(() => algorandMessageSignerAdapter, {
    scope,
    account: messageAccount,
    accounts: [messageAccount],
    requests: [
        arbitraryDataMessageRequest(scope, messageAccount.address, 'aGVsbG8='),
        authDataMessageRequest(
            scope,
            messageAccount.address,
            siwaAuthPayload(messageAccount.address),
        ),
    ],
    malformedRequest: authDataMessageRequest(scope, messageAccount.address, {
        ...siwaAuthPayload(messageAccount.address),
        authData: {
            ...siwaAuthPayload(messageAccount.address).authData,
            data: 'bm90IGNhbm9uaWNhbCBqc29u',
        },
    }),
    unsupportedMethod: 'algo_signData',
    otherSigner: otherMessageAddress,
    sign: request => signWithMessageKey([request.payload])[0],
})
