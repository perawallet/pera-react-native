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
import type { PeraAsset } from '@perawallet/wallet-core-assets'
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
}

type Move = {
    direction: BalanceImpactItem['direction']
    asset: Nullable<PeraAsset>
    /** Display units of `asset`. */
    value: Decimal
}

const NO_CHANGES: EthereumActionChanges = { spend: [], receive: [] }

const moveOf = (
    direction: Move['direction'],
    { asset, value, isBaseUnits }: EthereumActionAmount,
): Move[] => (isBaseUnits ? [] : [{ direction, asset, value }])

// Only amounts the calldata fixes: a swap's bounded leg or a whole-balance
// withdrawal is a limit, not what moves.
const movesOf = (
    action: EthereumContractActionPresentation,
    wrappedNative: Nullable<PeraAsset>,
): Move[] => {
    switch (action.kind) {
        case 'swap': {
            return [
                ...(action.input.bound === 'exact'
                    ? moveOf('spend', action.input)
                    : []),
                ...(action.output.bound === 'exact'
                    ? moveOf('receive', action.output)
                    : []),
            ]
        }
        // Wrapped-native contracts are 1:1 with the native coin.
        case 'wrap':
        case 'unwrap': {
            const isWrap = action.kind === 'wrap'
            const wrapped: Move[] = wrappedNative
                ? [
                      {
                          direction: isWrap ? 'receive' : 'spend',
                          asset: wrappedNative,
                          value: action.amount.value,
                      },
                  ]
                : []
            const native = moveOf(isWrap ? 'spend' : 'receive', action.amount)
            return isWrap ? [...native, ...wrapped] : [...wrapped, ...native]
        }
        case 'supply':
        case 'repay': {
            return action.isEntireBalance ? [] : moveOf('spend', action.amount)
        }
        case 'withdraw':
        case 'borrow': {
            return action.isEntireBalance
                ? []
                : moveOf('receive', action.amount)
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
    wrappedNative: Nullable<PeraAsset>,
    chainId: ChainId,
    usdPriceOf: (assetId: string) => Optional<Decimal>,
): EthereumActionChanges => {
    if (!action) return NO_CHANGES
    const items = movesOf(action, wrappedNative).flatMap(
        ({ direction, asset, value }): BalanceImpactItem[] =>
            asset
                ? [
                      {
                          assetId: asset.assetId,
                          chainId,
                          asset,
                          isCollectible: false,
                          isPureCollectible: false,
                          direction,
                          amount: value,
                          isFullBalance: false,
                          isNewAsset: false,
                          usdPrice: usdPriceOf(asset.assetId),
                      },
                  ]
                : [],
    )
    return {
        spend: items.filter(item => item.direction === 'spend'),
        receive: items.filter(item => item.direction === 'receive'),
    }
}

/** The asset ids `ethereumActionChangesOf` prices. */
export const ethereumActionAssetIdsOf = (
    action: Nullable<EthereumContractActionPresentation>,
    wrappedNative: Nullable<PeraAsset>,
): string[] =>
    action
        ? movesOf(action, wrappedNative).flatMap(({ asset }) =>
              asset ? [asset.assetId] : [],
          )
        : []
