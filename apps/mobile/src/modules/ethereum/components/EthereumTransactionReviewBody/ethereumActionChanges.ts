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

import type { Decimal } from 'decimal.js'
import type { DisplayableAsset } from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import type { BalanceImpactItem } from '@modules/signing'
import type {
    EthereumActionAmount,
    EthereumContractActionPresentation,
} from '../../hooks/useEthereumContractAction'

export type EthereumActionChanges = {
    spend: BalanceImpactItem[]
    receive: BalanceImpactItem[]
    /** The action receives something whose amount the calldata doesn't fix. */
    isReceiveUnknown: boolean
}

type Move = {
    direction: BalanceImpactItem['direction']
    /** Null when the action moves this leg but the calldata doesn't fix how much. */
    fixed: Nullable<{
        asset: DisplayableAsset
        /** Display units of `asset`. */
        value: Decimal
    }>
}

const NO_CHANGES: EthereumActionChanges = {
    spend: [],
    receive: [],
    isReceiveUnknown: false,
}

const unfixed = (direction: Move['direction']): Move => ({
    direction,
    fixed: null,
})

const moveOf = (
    direction: Move['direction'],
    {
        asset,
        value,
        isBaseUnits,
    }: Omit<EthereumActionAmount, 'asset'> & {
        asset: Nullable<DisplayableAsset>
    },
    isFixed = true,
): Move =>
    isFixed && asset && !isBaseUnits
        ? { direction, fixed: { asset, value } }
        : unfixed(direction)

// Only amounts the calldata fixes: a swap's bounded leg, a repay (Aave takes
// min(amount, debt)) or a whole-balance amount is a limit, not what moves.
// The aTokens a supply mints or a withdrawal burns are unfixed legs too.
const movesOf = (
    action: EthereumContractActionPresentation,
    wrappedNative: Nullable<DisplayableAsset>,
): Move[] => {
    switch (action.kind) {
        case 'swap': {
            return [
                moveOf('spend', action.input, action.input.bound === 'exact'),
                moveOf(
                    'receive',
                    action.output,
                    action.output.bound === 'exact',
                ),
            ]
        }
        // Wrapped-native contracts are 1:1 with the native coin.
        case 'wrap':
        case 'unwrap': {
            const isWrap = action.kind === 'wrap'
            const native = moveOf(isWrap ? 'spend' : 'receive', action.amount)
            const wrapped = moveOf(isWrap ? 'receive' : 'spend', {
                ...action.amount,
                asset: wrappedNative,
            })
            return isWrap ? [native, wrapped] : [wrapped, native]
        }
        case 'supply': {
            return [
                moveOf('spend', action.amount, !action.isEntireBalance),
                unfixed('receive'),
            ]
        }
        case 'repay': {
            return [unfixed('spend')]
        }
        case 'withdraw': {
            return [
                unfixed('spend'),
                moveOf('receive', action.amount, !action.isEntireBalance),
            ]
        }
        case 'borrow': {
            return [moveOf('receive', action.amount, !action.isEntireBalance)]
        }
        default: {
            return []
        }
    }
}

/**
 * What a decoded call provably moves in or out of the signer's account, for a
 * review whose simulation didn't answer.
 */
export const ethereumActionChangesOf = (
    action: Nullable<EthereumContractActionPresentation>,
    wrappedNative: Nullable<DisplayableAsset>,
    chainId: ChainId,
    usdPriceOf: (assetId: string) => Optional<Decimal>,
): EthereumActionChanges => {
    if (!action) return NO_CHANGES
    const moves = movesOf(action, wrappedNative)
    // The card has no "unknown" spend row, and its "Nothing" would be false.
    if (moves.some(move => move.direction === 'spend' && !move.fixed)) {
        return NO_CHANGES
    }
    const items = moves.flatMap(({ direction, fixed }): BalanceImpactItem[] =>
        fixed
            ? [
                  {
                      assetId: fixed.asset.assetId,
                      chainId,
                      asset: fixed.asset,
                      isCollectible: false,
                      isPureCollectible: false,
                      direction,
                      amount: fixed.value,
                      isFullBalance: false,
                      isNewAsset: false,
                      usdPrice: usdPriceOf(fixed.asset.assetId),
                  },
              ]
            : [],
    )
    return {
        spend: items.filter(item => item.direction === 'spend'),
        receive: items.filter(item => item.direction === 'receive'),
        isReceiveUnknown: moves.some(
            move => move.direction === 'receive' && !move.fixed,
        ),
    }
}

/** The asset ids `ethereumActionChangesOf` prices. */
export const ethereumActionAssetIdsOf = (
    action: Nullable<EthereumContractActionPresentation>,
    wrappedNative: Nullable<DisplayableAsset>,
): string[] =>
    action
        ? movesOf(action, wrappedNative).flatMap(({ fixed }) =>
              fixed ? [fixed.asset.assetId] : [],
          )
        : []
