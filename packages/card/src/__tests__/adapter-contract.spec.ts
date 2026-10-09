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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { CardEscrowNotConfiguredError } from '../api/escrow/errors'
import { cardContractTests } from './adapter-contract'
import { fakeCardAdapter } from './fakeCardAdapter'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'testnet' }
const UNCONFIGURED: ChainScope = { chainId: 'algorand', networkId: 'betanet' }
const isConfigured = (scope: ChainScope) =>
    scope.networkId === SCOPE.networkId

const account = { address: 'FUNDING' } as WalletAccount
const rekeyed = { address: 'REKEYED' } as WalletAccount
const insufficient = new Error('insufficient')

const adapter = fakeCardAdapter({
    settlementAsset: scope => (isConfigured(scope) ? '1' : null),
    buildManualDeposit: async (_params, scope) => {
        if (!isConfigured(scope)) throw new CardEscrowNotConfiguredError()
        return [{} as never]
    },
    fundingSourceEligibility: candidate => ({
        canFund: candidate !== rekeyed,
        canProveOwnership: true,
        canAutoDraw: true,
    }),
    describeError: error =>
        error === insufficient ? 'insufficient-native-balance' : null,
    transactionUrl: (hash, legNetwork) =>
        legNetwork === 'chain' ? `https://explorer/tx/${hash}` : null,
})

cardContractTests(() => adapter, {
    scope: SCOPE,
    unconfiguredScope: UNCONFIGURED,
    delegationApproval: {
        address: 'FUNDING',
        currency: 'usdc',
        txId: 'TX1',
        signData: { data: 'ZGF0YQ==', authenticatorData: 'YXV0aA==' },
        signature: 'c2ln',
        token: 'tok',
    },
    balance: { address: 'FUNDING', assetId: '1', arrangeNoHolding: () => {} },
    deposit: {
        params: { sender: 'FUNDING', cardAddress: 'CARD', amount: 1n },
        arrangeBuild: () => {},
    },
    eligibility: { account, ineligibleAccount: rekeyed },
    insufficientBalanceError: insufficient,
    ownLegNetwork: 'chain',
    foreignLegNetwork: 'other',
})
