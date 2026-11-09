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

import { size } from 'viem'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { Address, Hex } from 'viem'
import {
    i18nKey,
    type ChainScope,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import { eip155ChainIdOfNetwork } from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import {
    contractActionSummary,
    decodeEvmContractAction,
    decodePermit2Approval,
} from '../signing/contract-actions'
import {
    findKnownEvmContract,
    wrappedNativeOf,
} from '../signing/known-contracts'
import { ethereumCallSummary } from '../signing/review'
import type { EvmStandardCall } from '../signing/standard-call-types'
import {
    decodeEvmStandardCall,
    isEvmApprovalCall,
    isEvmRevocationCall,
} from '../signing/standard-calls'
import { historyActionSummary, knownContractSubtitle } from './action'

type DecodableCall = { from: Address; to?: Address; data: Hex; value: bigint }

const CONTRACT_INTERACTION = i18nKey(
    'transactions.list_item.contract_interaction',
)
const REVOKE_APPROVAL = i18nKey('transactions.list_item.revoke_approval')

const approvedPartyOf = (standard: EvmStandardCall): Optional<Address> => {
    if (standard.kind === 'set-approval-for-all') return standard.operator
    return 'spender' in standard ? standard.spender : undefined
}

/**
 * Approvals, a Permit2 `approve` among them, are named whatever `isDecoding`; naming a contract
 * call is not. Plain value transfers stay as `ethereumCallSummary` builds them.
 */
export const decodedCallSummary = (
    call: DecodableCall,
    chain: EvmChain,
    scope: ChainScope,
    isDecoding: boolean,
): TransactionSummary => {
    const plain = ethereumCallSummary(call, chain)
    if (call.to && size(call.data) === 0) return plain
    const base: TransactionSummary = {
        ...plain,
        title: { key: CONTRACT_INTERACTION },
        isActionUnknown: true,
    }
    const { to } = call
    if (!to) return base

    const eip155ChainId = eip155ChainIdOfNetwork(chain, scope.networkId)
    const contract =
        eip155ChainId === undefined
            ? undefined
            : findKnownEvmContract(eip155ChainId, to)
    const named = isDecoding ? contract : undefined

    const standard = decodeEvmStandardCall(call)
    if (standard && isEvmApprovalCall(standard)) {
        const approval = historyActionSummary(
            { kind: 'approval', token: to },
            base,
            named,
            chain,
        )
        return {
            ...approval,
            counterparty: approvedPartyOf(standard),
            ...(isEvmRevocationCall(standard) && {
                title: { key: REVOKE_APPROVAL },
            }),
        }
    }

    const permit2 =
        contract?.kind === 'uniswap-permit2'
            ? decodePermit2Approval(call)
            : undefined
    if (permit2) {
        return {
            ...historyActionSummary(
                { kind: 'approval', token: permit2.token },
                base,
                named,
                chain,
            ),
            counterparty: permit2.spender,
            ...(permit2.amount === 0n && { title: { key: REVOKE_APPROVAL } }),
        }
    }

    if (eip155ChainId === undefined || !named) return base
    const action = standard
        ? undefined
        : decodeEvmContractAction(
              { ...call, to },
              named,
              wrappedNativeOf(eip155ChainId),
          )
    return {
        ...(action ? contractActionSummary(action, call, chain) : base),
        subtitle: knownContractSubtitle(named),
    }
}
