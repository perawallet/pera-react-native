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

import type {
    CardChainAdapter,
    CardDelegationRequest,
} from '@perawallet/wallet-core-card'

// Baanx's name for this chain in its network/blockchain fields.
export const BAANX_ALGORAND_NETWORK = 'algorand'

export type AutoDrawDelegationParams = {
    /** Currency code the delegated program covers, as Baanx expects it, e.g. "usdc". */
    currency: string
    /** Delegator (funding-source) address that signed the program. */
    delegatorAddress: string
    /** Base64 of the signed delegated LogicSig account. */
    lsigBytes: string
    /** Escrow card address returned by the backend create-card call. */
    cardAddress: string
}

export const algorandDelegationRequests: Pick<
    CardChainAdapter,
    'delegationApprovalRequest'
> = {
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
            network: BAANX_ALGORAND_NETWORK,
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

}

// Baanx rejects unknown fields on this route with a 422.
export const autoDrawDelegationRequest = ({
    currency,
    delegatorAddress,
    lsigBytes,
    cardAddress,
}: AutoDrawDelegationParams): CardDelegationRequest => ({
    path: '/v1/delegation/algorand/delegator-lsig',
    data: {
        currency,
        delegatorAddress,
        lsigBytes,
        cardAddress,
        blockchain: BAANX_ALGORAND_NETWORK,
    },
})
