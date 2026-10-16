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
import {
    isNativeAsset,
    type AssetRef,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    InvalidSendParamsError,
    type InFlightSpend,
    type SpendableBalance,
    type SpendableBalanceInput,
} from '@perawallet/wallet-core-transactions'
import { ethereumAddressCodec } from '../accounts/address-codec'
import { ETHEREUM_CHAIN_ID } from '../chain-id'
import { ethereumDescriptor } from '../descriptor'

const ZERO = new Decimal(0)

const sumOf = (values: Decimal[]): Decimal =>
    values.reduce((total, value) => total.add(value), ZERO)

// The synced nonce, read at the same block as the balance, is what says a
// send is already off it, not the attempt's status: an attempt can still be
// open after its block is synced, and confirmed before it is.
const unsynced = (
    inFlight: readonly InFlightSpend[],
    latestNonce: Optional<number>,
): readonly InFlightSpend[] =>
    latestNonce === undefined
        ? inFlight
        : inFlight.filter(
              spend => spend.nonce === undefined || spend.nonce >= latestNonce,
          )

const isSameAsset = (a: AssetRef, b: AssetRef): boolean =>
    a.chainId === b.chainId &&
    ethereumAddressCodec.areEqual(a.assetId, b.assetId)

const outflowOf = (inFlight: readonly InFlightSpend[], asset: AssetRef) =>
    sumOf(
        inFlight.flatMap(spend =>
            spend.outflows
                .filter(outflow => isSameAsset(outflow.assetRef, asset))
                .map(outflow => outflow.value),
        ),
    )

// Ethereum has no reserve and no close-out. What stands between the balance
// and MAX is the gas, paid in ether, and what earlier sends already spend: the
// node queues the next send behind them and prices it against the same balance.
export const readEthereumSpendableBalance = async ({
    account,
    asset,
    scope,
    fee,
    inFlight = [],
}: SpendableBalanceInput): Promise<SpendableBalance> => {
    const address = addressOn(account, scope)
    if (
        scope.chainId !== ETHEREUM_CHAIN_ID ||
        asset.chainId !== ETHEREUM_CHAIN_ID ||
        !address
    ) {
        throw new InvalidSendParamsError()
    }

    // Read before the holdings: the sync writes the chain state first, so a
    // read straddling a sync pairs an older nonce with newer holdings, which
    // keeps a mined send held back for a tick rather than freeing an unmined one.
    const row = await getAccountChainStateRow({
        accountAddress: address,
        scope,
    })
    const latestNonce =
        row?.chainData.family === 'evm' ? row.chainData.nonce.latest : undefined
    const pending = unsynced(inFlight, latestNonce)

    if (!isNativeAsset(asset, ethereumDescriptor)) {
        const holdings = await getAccountHoldings({
            accountAddress: address,
            scope,
        })
        const balance =
            holdings.find(holding =>
                ethereumAddressCodec.areEqual(holding.assetId, asset.assetId),
            )?.amount ?? ZERO
        const reserved = outflowOf(pending, asset)
        return {
            balance,
            max: Decimal.max(balance.sub(reserved), ZERO),
            reserved,
        }
    }

    const balance = row?.nativeBalance ?? ZERO
    const reserved = outflowOf(pending, asset).add(
        sumOf(pending.map(spend => spend.maxFee ?? ZERO)),
    )
    return {
        balance,
        max: Decimal.max(balance.sub(reserved).sub(fee), ZERO),
        reserved,
    }
}
