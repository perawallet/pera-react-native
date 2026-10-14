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

import { Decimal } from 'decimal.js'
import {
    addressOn,
    getAccountChainStateRow,
    getAccountHoldings,
} from '@perawallet/wallet-core-accounts'
import { isNativeAsset } from '@perawallet/wallet-core-chain-contract'
import {
    InvalidSendParamsError,
    type SpendableBalance,
    type SpendableBalanceInput,
} from '@perawallet/wallet-core-transactions'
import { ETHEREUM_CHAIN_ID } from '../chain-id'
import { ethereumDescriptor } from '../descriptor'

const ZERO = new Decimal(0)

// Ethereum holds nothing back and has no close-out: only the gas, paid in
// ether, stands between the balance and MAX.
export const readEthereumSpendableBalance = async ({
    account,
    asset,
    scope,
    fee,
}: SpendableBalanceInput): Promise<SpendableBalance> => {
    const address = addressOn(account, scope)
    if (
        scope.chainId !== ETHEREUM_CHAIN_ID ||
        asset.chainId !== ETHEREUM_CHAIN_ID ||
        !address
    ) {
        throw new InvalidSendParamsError()
    }

    if (!isNativeAsset(asset, ethereumDescriptor)) {
        const holdings = await getAccountHoldings({
            accountAddress: address,
            scope,
        })
        const balance =
            holdings.find(holding => holding.assetId === asset.assetId)
                ?.amount ?? ZERO
        return { balance, max: balance, reserved: ZERO }
    }

    const row = await getAccountChainStateRow({ accountAddress: address, scope })
    const balance = row?.nativeBalance ?? ZERO
    return {
        balance,
        max: Decimal.max(balance.sub(fee), ZERO),
        reserved: ZERO,
    }
}
