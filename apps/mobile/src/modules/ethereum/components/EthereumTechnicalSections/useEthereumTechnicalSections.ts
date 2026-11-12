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

import { useCallback, useMemo } from 'react'
import {
    decodeEvmVerifiedCall,
    useEvmContractAbiQuery,
    type EvmAbiArgument,
} from '@perawallet/wallet-core-chain-ethereum'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { useClipboard } from '@hooks/useClipboard'
import { isKnownContractSite } from '@modules/signing'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'

export type UseEthereumTechnicalSectionsResult = {
    /** A contract call or creation: one with call data to show. */
    isContractCall: boolean
    /** A call names its contract; a creation has none yet. */
    hasTarget: boolean
    /** The call names a function; a creation runs its constructor instead. */
    hasFunction: boolean
    address: string
    shortAddress: string
    /** The well-known contract's name; unset for any other. */
    contractName?: string
    /** The contract's project domain, when the request came from that site. */
    matchedDomain?: string
    isLoading: boolean
    /** The decoded function's name, else the call's 4-byte selector. */
    functionName?: string
    isDecoded: boolean
    arguments: EvmAbiArgument[]
    /** Set when the contract is a proxy: the address of the code it runs. */
    implementation?: string
    handleCopyAddress: () => void
}

const NO_ARGUMENTS: EvmAbiArgument[] = []

export const useEthereumTechnicalSections = (
    presentation: EthereumTransactionPresentation,
    source?: SignRequestSource,
    verifiedOrigin?: string,
): UseEthereumTechnicalSectionsResult => {
    const { view, scope, knownContract } = presentation
    const { copyToClipboard } = useClipboard()
    const isDecoding = useChainCapability(scope.chainId, 'contractDecoding')
    const address = view.to ?? ''
    const isContractCall = view.kind === 'contract-call'
    const hasTarget = isContractCall && !!view.to
    // Unlike the review, an action or token call is decoded too: this is where its parameters are read.
    const isLookedUp = hasTarget && isDecoding && !!view.selector
    const { data, isPending } = useEvmContractAbiQuery({
        scope,
        address: view.to,
        isEnabled: isLookedUp,
    })

    const call = useMemo(
        () =>
            isLookedUp && data?.status === 'verified'
                ? decodeEvmVerifiedCall(view.data, data)
                : null,
        [isLookedUp, data, view.data],
    )

    const handleCopyAddress = useCallback(() => {
        if (!address) return
        void copyToClipboard(
            addressCodecs.get(scope.chainId).normalize(address),
        )
    }, [address, copyToClipboard, scope.chainId])

    const isSiteMatch = isKnownContractSite(
        knownContract?.projectDomain,
        source,
        verifiedOrigin,
    )

    return {
        isContractCall,
        hasTarget,
        hasFunction: hasTarget && !!view.selector,
        address,
        shortAddress: address
            ? addressCodecs.get(scope.chainId).truncate(address)
            : '',
        contractName: knownContract?.name,
        matchedDomain: isSiteMatch ? knownContract?.projectDomain : undefined,
        isLoading: isLookedUp && isPending,
        functionName: call?.functionName ?? view.selector ?? undefined,
        isDecoded: !!call,
        arguments: call?.arguments ?? NO_ARGUMENTS,
        implementation: call?.proxy?.implementation,
        handleCopyAddress,
    }
}
