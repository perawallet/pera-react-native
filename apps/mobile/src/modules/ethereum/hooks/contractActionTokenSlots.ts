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
import type {
    EvmActionAsset,
    EvmContractAction,
} from '@perawallet/wallet-core-chain-ethereum'
import type { Optional } from '@perawallet/wallet-core-shared'

type TokenSlot = { assetId: string; baseUnits: Optional<Decimal> }

const NO_TOKEN: TokenSlot = { assetId: '', baseUnits: undefined }

const tokenOf = (asset: EvmActionAsset, baseUnits: Decimal): TokenSlot =>
    asset.kind === 'token' ? { assetId: asset.contract, baseUnits } : NO_TOKEN

// The three token records an action needs, in the order `present` reads them;
// the third is the swap's fee token, whose record sizes every fee, and a
// liquidity add's two deposits take the first two.
export const tokenSlotsOf = (
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
        case 'repay':
        case 'bridge': {
            return [tokenOf(action.asset, action.amount), NO_TOKEN, NO_TOKEN]
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
