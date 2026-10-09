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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { BroadcasterChainAdapter } from '../broadcaster'
import { SubmissionError } from '../pipeline/errors'
import { broadcasterContractTests } from './broadcaster-contract'
import { fakeBroadcasterAdapter } from './fakeBroadcaster'

// A second chain that exists only to pressure-test the contract: a
// transaction's id is its bytes in hex, and the node is a switch the arrange
// callbacks flip.
const FIXTURE_CHAIN_ID = 'fixturehex' as ChainId

type NodeMode = 'accepts' | 'knows' | 'rejects' | 'silent'

const node: { mode: NodeMode; confirms: boolean } = {
    mode: 'accepts',
    confirms: false,
}

const idOf = (bytes: Uint8Array) =>
    Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')

const nodeError = (code: string) =>
    Object.assign(new Error(`node: ${code}`), { code })

const fixtureBroadcaster: BroadcasterChainAdapter = {
    ...fakeBroadcasterAdapter(),
    chainId: FIXTURE_CHAIN_ID,
    submit: async (_scope, signedTransactions) => {
        const ids = signedTransactions.map(idOf)
        switch (node.mode) {
            case 'accepts':
            case 'knows':
                return ids
            case 'rejects':
                throw new SubmissionError(
                    ids,
                    'rejected-by-node',
                    nodeError('rejected'),
                )
            case 'silent':
                throw new SubmissionError(
                    ids,
                    'unknown-outcome',
                    nodeError('no_answer'),
                )
        }
    },
    waitForConfirmation: async (_scope, txIds) => {
        if (txIds.length === 0 || node.confirms) return
        throw new Error('not confirmed within the wait window')
    },
}

const SIGNED = [new Uint8Array([0xfe, 0x01])]

broadcasterContractTests(() => fixtureBroadcaster, {
    scope: { chainId: FIXTURE_CHAIN_ID, networkId: 'testnet' },
    signedTransactions: SIGNED,
    txIds: SIGNED.map(idOf),
    arrangeAccepted: () => {
        node.mode = 'accepts'
    },
    arrangeAlreadyKnown: () => {
        node.mode = 'knows'
    },
    arrangeRejected: () => {
        node.mode = 'rejects'
    },
    arrangeUnreachable: () => {
        node.mode = 'silent'
    },
    arrangeConfirmed: () => {
        node.confirms = true
    },
    arrangeNeverConfirmed: () => {
        node.confirms = false
    },
})
