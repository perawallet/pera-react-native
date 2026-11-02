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
import type { Decimal } from 'decimal.js'
import { useNativeAsset, type PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type {
    EthereumTransactionView,
    EvmActionAsset,
    EvmContractAction,
    EvmContractLabel,
    EvmSwapLeg,
} from '@perawallet/wallet-core-chain-ethereum'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import {
    baseUnitsToDisplayUnits,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useBaseUnitsAmount } from '@hooks/useBaseUnitsAmount'
import type { EthereumAmount } from './useEthereumStandardCall'

export type EthereumBoundedAmount = EthereumAmount & {
    bound: EvmSwapLeg['bound']
}

/** A call to a known contract as review shows it, once its tokens say what they are. */
export type EthereumContractActionPresentation =
    | {
          kind: 'swap'
          input: EthereumBoundedAmount
          output: EthereumBoundedAmount
      }
    | { kind: 'wrap' | 'unwrap'; amount: EthereumAmount }
    | {
          kind: 'supply' | 'withdraw' | 'borrow' | 'repay'
          assetContract: string
          /** Whole balance or debt: `amount` is then the largest uint256, not a figure to show. */
          amount: EthereumAmount
          isEntireBalance: boolean
      }

export type UseEthereumContractActionResult = {
    contractAction: Nullable<EthereumContractActionPresentation>
    knownContract: Nullable<EvmContractLabel>
    isLoading: boolean
}

type TokenSlot = { assetId: string; baseUnits: Optional<Decimal> }

const NO_TOKEN: TokenSlot = { assetId: '', baseUnits: undefined }

const tokenOf = (asset: EvmActionAsset, baseUnits: Decimal): TokenSlot =>
    asset.kind === 'token' ? { assetId: asset.contract, baseUnits } : NO_TOKEN

// The two token records an action needs, in the order `present` reads them.
const tokenSlotsOf = (
    action: Optional<EvmContractAction>,
    wrappedToken: string,
): [TokenSlot, TokenSlot] => {
    switch (action?.kind) {
        case 'swap': {
            return [
                tokenOf(action.input.asset, action.input.amount),
                tokenOf(action.output.asset, action.output.amount),
            ]
        }
        case 'unwrap': {
            return [
                { assetId: wrappedToken, baseUnits: action.amount },
                NO_TOKEN,
            ]
        }
        case 'supply':
        case 'withdraw':
        case 'borrow':
        case 'repay': {
            return [
                { assetId: action.asset, baseUnits: action.amount },
                NO_TOKEN,
            ]
        }
        default: {
            return [NO_TOKEN, NO_TOKEN]
        }
    }
}

type TokenAmount = ReturnType<typeof useBaseUnitsAmount>

const tokenAmountOf = (
    resolved: TokenAmount,
    baseUnits: Decimal,
): EthereumAmount => ({
    asset: resolved.asset,
    value: resolved.value ?? baseUnits,
})

const nativeAmountOf = (
    nativeAsset: PeraAsset,
    wei: Decimal,
): EthereumAmount => ({
    asset: nativeAsset,
    value: baseUnitsToDisplayUnits(wei, nativeAsset.decimals),
})

const present = (
    action: EvmContractAction,
    nativeAsset: PeraAsset,
    [first, second]: [TokenAmount, TokenAmount],
): EthereumContractActionPresentation => {
    const leg = (
        { asset, amount, bound }: EvmSwapLeg,
        resolved: TokenAmount,
    ): EthereumBoundedAmount => ({
        ...(asset.kind === 'native'
            ? nativeAmountOf(nativeAsset, amount)
            : tokenAmountOf(resolved, amount)),
        bound,
    })
    switch (action.kind) {
        case 'swap': {
            return {
                kind: 'swap',
                input: leg(action.input, first),
                output: leg(action.output, second),
            }
        }
        case 'wrap': {
            return {
                kind: 'wrap',
                amount: nativeAmountOf(nativeAsset, action.amount),
            }
        }
        case 'unwrap': {
            return {
                kind: 'unwrap',
                amount: tokenAmountOf(first, action.amount),
            }
        }
        case 'supply':
        case 'withdraw':
        case 'borrow':
        case 'repay': {
            return {
                kind: action.kind,
                assetContract: action.asset,
                amount: tokenAmountOf(first, action.amount),
                isEntireBalance: action.isEntireBalance,
            }
        }
    }
}

/**
 * Reads a call to a known contract and what its calldata proves it does,
 * while `contractDecoding` is on; a standard token call keeps its own review.
 * Token amounts show in display units when the token's record is known and as
 * raw base units otherwise.
 */
export const useEthereumContractAction = (
    view: Nullable<EthereumTransactionView>,
    scope: ChainScope,
): UseEthereumContractActionResult => {
    const isDecoding = useChainCapability(scope.chainId, 'contractDecoding')
    const isActive = isDecoding && !!view && !view.call
    const knownContract = (isActive && view.knownContract) || null
    const action = isActive ? view.action : undefined
    const nativeAsset = useNativeAsset(scope)

    const [firstSlot, secondSlot] = tokenSlotsOf(action, view?.to ?? '')
    const first = useBaseUnitsAmount(
        firstSlot.assetId,
        firstSlot.baseUnits,
        scope,
    )
    const second = useBaseUnitsAmount(
        secondSlot.assetId,
        secondSlot.baseUnits,
        scope,
    )

    return useMemo(
        () => ({
            knownContract,
            contractAction: action
                ? present(action, nativeAsset, [first, second])
                : null,
            isLoading: first.isLoading || second.isLoading,
        }),
        [knownContract, action, nativeAsset, first, second],
    )
}
