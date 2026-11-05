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

import { useMemo } from 'react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    decodeEvmVerifiedCall,
    useEvmContractAbiQuery,
    type EthereumTransactionView,
    type EvmVerifiedCall,
} from '@perawallet/wallet-core-chain-ethereum'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type UseEthereumVerifiedCallResult =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'decoded'; call: EvmVerifiedCall }
    | { status: 'unrecognised' }
    | { status: 'lookup-failed' }

/**
 * A contract call named from its target's verified ABI, while
 * `contractDecoding` is on. Standard token calls and known contracts' actions
 * keep their own reviews, so neither is looked up. The review never waits on
 * this: it shows the call unrecognised until, or unless, it decodes.
 */
export const useEthereumVerifiedCall = (
    view: Nullable<EthereumTransactionView>,
    scope: ChainScope,
    isEnabled: boolean,
): UseEthereumVerifiedCallResult => {
    const isDecoding = useChainCapability(scope.chainId, 'contractDecoding')
    const isLookedUp =
        isEnabled &&
        isDecoding &&
        view?.kind === 'contract-call' &&
        !!view.to &&
        !!view.selector &&
        !view.call &&
        !view.action
    const { data, isPending, isError } = useEvmContractAbiQuery({
        scope,
        address: view?.to,
        isEnabled: isLookedUp,
    })

    return useMemo(() => {
        if (!isLookedUp || !view) return { status: 'idle' }
        if (isError) return { status: 'lookup-failed' }
        if (isPending || !data) return { status: 'loading' }
        if (data.status === 'unavailable') return { status: 'idle' }
        if (data.status === 'unverified') return { status: 'unrecognised' }
        const call = decodeEvmVerifiedCall(view.data, data)
        return call ? { status: 'decoded', call } : { status: 'unrecognised' }
    }, [isLookedUp, view, isError, isPending, data])
}
