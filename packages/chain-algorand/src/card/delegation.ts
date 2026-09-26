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

import type { CardChainAdapter } from '@perawallet/wallet-core-card'

type DelegationRequests = Pick<
    CardChainAdapter,
    'delegationApprovalRequest' | 'delegatorProgramRequest'
>

export const algorandDelegationRequests: DelegationRequests = {
    // The amount is fixed at "0": Algorand spending is bounded by the signed
    // AutoDraw LogicSig and the Killswitch app, not by an allowance, and
    // Baanx's Algorand reference client sends "0" too.
    delegationApprovalRequest: ({
        address,
        currency,
        txId,
        signData,
        signature,
        token,
    }) => ({
        path: '/v1/delegation/algorand/post-approval',
        data: {
            address,
            network: 'algorand',
            currency,
            amount: '0',
            txHash: txId,
            // Baanx's names, shared with its EVM/Solana contracts: sigHash
            // carries the signature itself, not a hash of it.
            sigData: signData,
            sigHash: signature,
            token,
        },
    }),

    // Baanx rejects unknown fields on this route with a 422.
    delegatorProgramRequest: ({
        currency,
        delegatorAddress,
        lsigBytes,
        cardAddress,
    }) => ({
        path: '/v1/delegation/algorand/delegator-lsig',
        data: {
            currency,
            delegatorAddress,
            lsigBytes,
            cardAddress,
            blockchain: 'algorand',
        },
    }),
}
