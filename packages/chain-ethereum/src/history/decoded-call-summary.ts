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
import type { Address } from 'viem'
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
} from '../signing/contract-actions'
import {
    findKnownEvmContract,
    wrappedNativeOf,
} from '../signing/known-contracts'
import { ethereumCallSummary } from '../signing/review'
import { decodeEvmStandardCall } from '../signing/standard-calls'
import {
    approvalActionOfCall,
    type EvmDecodableCall,
    historyActionSummary,
    knownContractSubtitle,
} from './action'

// A pending call may deploy a contract, so it can have no `to`.
type DecodableCall = Omit<EvmDecodableCall, 'to'> & { to?: Address }

const CONTRACT_INTERACTION = i18nKey(
    'transactions.list_item.contract_interaction',
)

/**
 * A call this wallet is about to send, before History has its row. Approvals,
 * a Permit2 `approve` among them, are named whatever `isDecoding`; naming a
 * contract call is not. Plain value transfers stay as `ethereumCallSummary`
 * builds them.
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

    const approval = approvalActionOfCall(
        { ...call, to },
        contract,
        eip155ChainId,
    )
    if (approval) return historyActionSummary(approval, base, named, chain)

    if (eip155ChainId === undefined || !named) return base
    const action = decodeEvmStandardCall(call)
        ? undefined
        : decodeEvmContractAction(
              { ...call, to },
              named,
              wrappedNativeOf(eip155ChainId),
          )
    return {
        ...(action ? contractActionSummary(action, call, chain) : base),
        ...knownContractSubtitle(named),
    }
}
