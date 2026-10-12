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

import {
    encodeAddress,
    encodeUnsignedTransaction,
    makePaymentTxnWithSuggestedParamsFromObject,
} from 'algosdk'
import { multisigContractTests } from '@perawallet/wallet-core-multisig/testing'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { algorandMultisigAdapter } from '../adapter'

const parameters = {
    version: 1,
    threshold: 2,
    addresses: [1, 2, 3].map(fill =>
        encodeAddress(new Uint8Array(32).fill(fill)),
    ),
}
const joint = algorandMultisigAdapter.deriveAddress(parameters)

multisigContractTests(() => algorandMultisigAdapter, {
    parameters,
    rawTransactionBase64: encodeToBase64(
        encodeUnsignedTransaction(
            makePaymentTxnWithSuggestedParamsFromObject({
                sender: joint,
                receiver: joint,
                amount: 1n,
                suggestedParams: {
                    fee: 1000n,
                    minFee: 1000n,
                    firstValid: 1n,
                    lastValid: 1001n,
                    genesisID: 'testnet-v1.0',
                    genesisHash: new Uint8Array(32).fill(9),
                },
            }),
        ),
    ),
    malformedAddress: 'NOT_AN_ALGORAND_ADDRESS',
    participantScheme: 'ed25519',
    nonParticipantScheme: 'falcon-1024',
})
