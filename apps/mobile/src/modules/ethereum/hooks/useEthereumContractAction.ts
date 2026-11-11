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
import { Decimal } from 'decimal.js'
import { useNativeAsset, type PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type {
    EthereumTransactionView,
    EvmActionAsset,
    EvmContractAction,
    EvmLiquidityPosition,
    EvmSwapLeg,
} from '@perawallet/wallet-core-chain-ethereum'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import {
    baseUnitsToDisplayUnits,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useBaseUnitsAmount } from '@hooks/useBaseUnitsAmount'
import {
    useEthereumContractLabel,
    type EthereumContractLabel,
} from './useEthereumContractLabel'
import type { EthereumAmount } from './useEthereumStandardCall'

export type EthereumActionAmount = EthereumAmount & {
    /** The token's record can't be read, so `value` is raw base units and the row must say so. */
    isBaseUnits: boolean
}

export type EthereumBoundedAmount = EthereumActionAmount & {
    bound: EvmSwapLeg['bound']
}

export type EthereumSwapFeePresentation = {
    token: string
    recipient: string
    size:
        | { kind: 'percent'; percent: Decimal }
        | { kind: 'amount'; amount: EthereumActionAmount }
}

/** A call to a known contract as review shows it, once its tokens say what they are. */
export type EthereumContractActionPresentation =
    | {
          kind: 'swap'
          input: EthereumBoundedAmount
          output: EthereumBoundedAmount
          fees: EthereumSwapFeePresentation[]
      }
    | { kind: 'wrap' | 'unwrap'; amount: EthereumActionAmount }
    | {
          kind: 'supply' | 'withdraw' | 'borrow' | 'repay'
          assetContract: string
          /** Whole balance or debt: `amount` is then the largest uint256, not a figure to show. */
          amount: EthereumActionAmount
          isEntireBalance: boolean
      }
    | {
          kind: 'add-liquidity'
          /** Each is the most the position manager can take; empty on an increase, whose calldata doesn't name the tokens. */
          deposits: EthereumBoundedAmount[]
          position: EvmLiquidityPosition
      }
    | { kind: 'remove-liquidity'; tokenId: string; isClosing: boolean }

export type UseEthereumContractActionResult = {
    contractAction: Nullable<EthereumContractActionPresentation>
    knownContract: Nullable<EthereumContractLabel>
    isLoading: boolean
}

type TokenSlot = { assetId: string; baseUnits: Optional<Decimal> }

const NO_TOKEN: TokenSlot = { assetId: '', baseUnits: undefined }

const tokenOf = (asset: EvmActionAsset, baseUnits: Decimal): TokenSlot =>
    asset.kind === 'token' ? { assetId: asset.contract, baseUnits } : NO_TOKEN

// The three token records an action needs, in the order `present` reads them;
// the third is the swap's fee token, whose record sizes every fee, and a
// liquidity add's two deposits take the first two.
const tokenSlotsOf = (
    action: Optional<EvmContractAction>,
): [TokenSlot, TokenSlot, TokenSlot] => {
    switch (action?.kind) {
        case 'swap': {
            const [fee] = action.fees
            return [
                tokenOf(action.input.asset, action.input.amount),
                tokenOf(action.output.asset, action.output.amount),
                { assetId: fee?.token ?? '', baseUnits: undefined },
            ]
        }
        case 'supply':
        case 'withdraw':
        case 'borrow':
        case 'repay': {
            return [
                { assetId: action.asset, baseUnits: action.amount },
                NO_TOKEN,
                NO_TOKEN,
            ]
        }
        case 'add-liquidity': {
            const [first, second] = action.deposits
            return [
                first ? tokenOf(first.asset, first.maxAmount) : NO_TOKEN,
                second ? tokenOf(second.asset, second.maxAmount) : NO_TOKEN,
                NO_TOKEN,
            ]
        }
        default: {
            return [NO_TOKEN, NO_TOKEN, NO_TOKEN]
        }
    }
}

type TokenAmount = ReturnType<typeof useBaseUnitsAmount>

const tokenAmountOf = (
    { asset, value, isLoading }: TokenAmount,
    baseUnits: Decimal,
): EthereumActionAmount => ({
    asset,
    value: value ?? baseUnits,
    isBaseUnits: !asset && !isLoading,
})

// The fee token's slot carries no amount: each fee is sized against its record here.
const feeAmountOf = (
    { asset, isLoading }: TokenAmount,
    baseUnits: Decimal,
): EthereumActionAmount => ({
    asset,
    value: asset
        ? baseUnitsToDisplayUnits(baseUnits, asset.decimals)
        : baseUnits,
    isBaseUnits: !asset && !isLoading,
})

const nativeAmountOf = (
    nativeAsset: PeraAsset,
    wei: Decimal,
): EthereumActionAmount => ({
    asset: nativeAsset,
    value: baseUnitsToDisplayUnits(wei, nativeAsset.decimals),
    isBaseUnits: false,
})

const BIPS_PER_PERCENT = 100

const present = (
    action: EvmContractAction,
    nativeAsset: PeraAsset,
    [first, second, feeToken]: [TokenAmount, TokenAmount, TokenAmount],
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
                fees: action.fees.map(({ token, recipient, size }) => ({
                    token,
                    recipient,
                    size:
                        size.kind === 'bips'
                            ? {
                                  kind: 'percent',
                                  percent: new Decimal(size.bips).div(
                                      BIPS_PER_PERCENT,
                                  ),
                              }
                            : {
                                  kind: 'amount',
                                  amount: feeAmountOf(feeToken, size.amount),
                              },
                })),
            }
        }
        // The registry lists only wrapped-native contracts, 1:1 with the
        // chain's native coin, so no token record is needed to size either.
        case 'wrap':
        case 'unwrap': {
            return {
                kind: action.kind,
                amount: nativeAmountOf(nativeAsset, action.amount),
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
        case 'add-liquidity': {
            return {
                kind: 'add-liquidity',
                deposits: action.deposits.map(
                    ({ asset, maxAmount }, index) => ({
                        ...(asset.kind === 'native'
                            ? nativeAmountOf(nativeAsset, maxAmount)
                            : tokenAmountOf(
                                  index === 0 ? first : second,
                                  maxAmount,
                              )),
                        bound: 'at-most' as const,
                    }),
                ),
                position: action.position,
            }
        }
        case 'remove-liquidity': {
            return {
                kind: 'remove-liquidity',
                tokenId: action.tokenId,
                isClosing: action.isClosing,
            }
        }
    }
}

/**
 * Reads a call to a known contract and what its calldata proves it does,
 * while `contractDecoding` is on; a standard token call keeps its own review.
 * Token amounts show in display units when the token's record is known and as
 * raw base units, flagged `isBaseUnits`, otherwise.
 */
export const useEthereumContractAction = (
    view: Nullable<EthereumTransactionView>,
    scope: ChainScope,
): UseEthereumContractActionResult => {
    const isDecoding = useChainCapability(scope.chainId, 'contractDecoding')
    const isActive = isDecoding && !!view && !view.call
    // Only a contract call's target is looked up: a send's is the recipient, never Pera's business.
    const knownContract = useEthereumContractLabel(
        scope,
        view?.to,
        view?.knownContract,
        isActive && view.kind === 'contract-call',
    )
    const action = isActive ? view.action : undefined
    const nativeAsset = useNativeAsset(scope)

    const [firstSlot, secondSlot, feeSlot] = tokenSlotsOf(action)
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
    const feeToken = useBaseUnitsAmount(
        feeSlot.assetId,
        feeSlot.baseUnits,
        scope,
    )

    return useMemo(
        () => ({
            knownContract,
            contractAction: action
                ? present(action, nativeAsset, [first, second, feeToken])
                : null,
            isLoading:
                first.isLoading || second.isLoading || feeToken.isLoading,
        }),
        [knownContract, action, nativeAsset, first, second, feeToken],
    )
}
