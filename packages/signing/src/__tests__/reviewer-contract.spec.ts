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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { ReviewerChainAdapter } from '../chain-adapter'
import type { AnalysisContext, SignableGroup } from '../pipeline/types'
import { fakeReviewerAdapter } from './fakeReviewerAdapter'
import { reviewerContractTests } from './reviewer-contract'

// A second chain that exists only to pressure-test the contract: its
// transactions are plain records, it warns about the ones marked risky and
// about every call it can't read.
const FIXTURE_CHAIN_ID = 'fixturehex' as ChainId

type FixtureTxn = {
    sender: string
    fee: bigint
    isRisky?: boolean
    isOpaque?: boolean
    networkId?: string
}

const WALLET = 'fx01'

const txnsOf = (group: SignableGroup): FixtureTxn[] =>
    group.data.type === 'transactions'
        ? (group.data.transactions as unknown as FixtureTxn[])
        : []

const signsFor = (group: SignableGroup, context: AnalysisContext) =>
    context.accounts.some(a => a.address === group.signerAddress)

const isOnOtherNetwork = (group: SignableGroup, context: AnalysisContext) =>
    txnsOf(group).some(
        txn =>
            txn.networkId !== undefined &&
            txn.networkId !== context.scope.networkId,
    )

const fixtureReviewer: ReviewerChainAdapter = {
    ...fakeReviewerAdapter(),
    chainId: FIXTURE_CHAIN_ID,
    decoder: {
        decode: async (group, context) => {
            if (isOnOtherNetwork(group, context)) {
                throw new Error('built for another network')
            }
            const isSigner = signsFor(group, context)
            return {
                totalFees: isSigner
                    ? txnsOf(group).reduce((sum, txn) => sum + txn.fee, 0n)
                    : 0n,
                transactionSummaries: txnsOf(group).map(txn => ({
                    type: txn.isOpaque
                        ? ('unknown' as const)
                        : ('payment' as const),
                    sender: txn.sender,
                })),
                signableAddresses: isSigner ? [group.signerAddress] : [],
            }
        },
    },
    warnings: {
        detect: (group, decoded) =>
            decoded.signableAddresses.length > 0 &&
            (txnsOf(group).some(t => t.isRisky) ||
                decoded.transactionSummaries.some(s => s.type === 'unknown'))
                ? [
                      {
                          type: 'suspicious',
                          severity: 'warning',
                          message: 'risky',
                      },
                  ]
                : [],
    },
    policy: { autoApproveLocal: analysis => analysis.warnings.length === 0 },
}

const groupOf = (signerAddress: string, txns: FixtureTxn[]): SignableGroup =>
    ({
        signerAddress,
        source: { type: 'local' },
        data: {
            type: 'transactions',
            transactions: txns,
            indicesToSign: txns.map((_, i) => i),
        },
    }) as unknown as SignableGroup

reviewerContractTests(() => fixtureReviewer, {
    context: {
        scope: { chainId: FIXTURE_CHAIN_ID, networkId: 'testnet' },
        accounts: [{ address: WALLET } as WalletAccount],
    },
    plainGroup: groupOf(WALLET, [{ sender: WALLET, fee: 3n }]),
    riskyGroup: groupOf(WALLET, [{ sender: WALLET, fee: 3n, isRisky: true }]),
    foreignGroup: groupOf('fx02', [{ sender: 'fx02', fee: 3n, isRisky: true }]),
    opaqueGroup: groupOf(WALLET, [{ sender: WALLET, fee: 3n, isOpaque: true }]),
    wrongNetworkGroup: groupOf(WALLET, [
        { sender: WALLET, fee: 3n, networkId: 'mainnet' },
    ]),
    messageGroup: {
        signerAddress: WALLET,
        source: { type: 'local' },
        data: { type: 'arbitrary-data', data: [] },
    } as unknown as SignableGroup,
})
