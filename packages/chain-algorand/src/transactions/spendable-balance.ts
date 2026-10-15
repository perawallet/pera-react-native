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
    fetchOnChainAccountState,
    getAccountChainStateRow,
    getAccountHoldings,
    isDelegatedAccount,
} from '@perawallet/wallet-core-accounts'
import {
    i18nKey,
    isNativeAsset,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    baseUnitsToDisplayUnits,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    InvalidSendParamsError,
    type ChainNotice,
    type RecipientWarningInput,
    type ReserveNotice,
    type SpendableBalance,
    type SpendableBalanceInput,
} from '@perawallet/wallet-core-transactions'
import { getMinimumFeeConfig } from '../blockchain'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandDescriptor } from '../descriptor'

const MIN_BALANCE_TITLE_KEY = i18nKey('send_funds.input.min_balance_title')
const MIN_BALANCE_AMOUNT_KEY = i18nKey('send_funds.input.min_balance_amount')
const MIN_BALANCE_BODY_KEY = i18nKey('send_funds.input.min_balance_body')
const REKEYED_TITLE_KEY = i18nKey('send_funds.input.rekeyed_min_balance_title')
const REKEYED_AMOUNT_KEY = i18nKey(
    'send_funds.input.rekeyed_min_balance_amount',
)
const REKEYED_BODY_KEY = i18nKey('send_funds.input.rekeyed_min_balance_body')
const CLOSE_ACCOUNT_TITLE_KEY = i18nKey('send_funds.close_account.title')
const CLOSE_ACCOUNT_BODY_KEY = i18nKey('send_funds.close_account.body')
const RECIPIENT_TITLE_KEY = i18nKey(
    'send_funds.confirmation.recipient_below_mbr.title',
)
const RECIPIENT_BODY_KEY = i18nKey(
    'send_funds.confirmation.recipient_below_mbr.body',
)

const ZERO = new Decimal(0)

const toAlgo = (microAlgos: Decimal): string =>
    baseUnitsToDisplayUnits(
        microAlgos,
        algorandDescriptor.nativeAsset.decimals,
    ).toString()

const reserveNoticeFor = (
    isRekeyed: boolean,
    minBalance: string,
): ReserveNotice =>
    isRekeyed
        ? {
              title: { key: REKEYED_TITLE_KEY },
              body: [
                  { key: REKEYED_AMOUNT_KEY, params: { minBalance } },
                  { key: REKEYED_BODY_KEY },
              ],
              isFirm: true,
          }
        : {
              title: { key: MIN_BALANCE_TITLE_KEY },
              body: [
                  { key: MIN_BALANCE_AMOUNT_KEY, params: { minBalance } },
                  { key: MIN_BALANCE_BODY_KEY },
              ],
              isFirm: false,
          }

const readTokenBalance = async (
    accountAddress: string,
    scope: ChainScope,
    assetId: string,
): Promise<Decimal> => {
    const holdings = await getAccountHoldings({ accountAddress, scope })
    return holdings.find(holding => holding.assetId === assetId)?.amount ?? ZERO
}

export const readAlgorandSpendableBalance = async ({
    account,
    asset,
    scope,
    fee,
}: SpendableBalanceInput): Promise<SpendableBalance> => {
    const address = addressOn(account, scope)
    if (
        scope.chainId !== ALGORAND_CHAIN_ID ||
        asset.chainId !== ALGORAND_CHAIN_ID ||
        !address
    ) {
        throw new InvalidSendParamsError()
    }

    if (!isNativeAsset(asset, algorandDescriptor)) {
        const balance = await readTokenBalance(address, scope, asset.assetId)
        return { balance, max: balance, reserved: ZERO }
    }

    const row = await getAccountChainStateRow({
        accountAddress: address,
        scope,
    })
    const balance = row?.nativeBalance ?? ZERO
    const chainState = row?.chainData
    const isAlgorandState = chainState?.family === 'algorand'
    const minBalance = isAlgorandState ? chainState.minBalance : ZERO
    const assetsOptedIn = isAlgorandState ? chainState.totalAssetsOptedIn : 0
    // A rekeyed account can never close out: the rekey would be lost and the
    // account left unusable.
    const isRekeyed = isDelegatedAccount(account, scope.chainId)
    const minBalanceDisplay = toAlgo(minBalance)

    // An unraised minimum balance is what makes the close possible: the
    // opt-in count alone misses app opt-ins, created assets and boxes, each of
    // which the node would reject the close-out for.
    const canEmpty =
        !isRekeyed &&
        assetsOptedIn === 0 &&
        minBalance.lte(getMinimumFeeConfig().baseAccountMbr.toString())

    return {
        balance,
        max: Decimal.max(balance.sub(minBalance).sub(fee), ZERO),
        reserved: minBalance,
        reserveNotice: reserveNoticeFor(isRekeyed, minBalanceDisplay),
        ...(canEmpty
            ? {
                  emptyAccount: {
                      amount: Decimal.max(balance.sub(fee), ZERO),
                      notice: {
                          title: { key: CLOSE_ACCOUNT_TITLE_KEY },
                          body: [
                              {
                                  key: CLOSE_ACCOUNT_BODY_KEY,
                                  params: { minBalance: minBalanceDisplay },
                              },
                          ],
                      },
                  },
              }
            : {}),
    }
}

// The ledger allows leaving a receiver at exactly 0 (a zero-amount note
// payment to an empty account); only a positive balance below the minimum
// balance fails on-chain.
export const readAlgorandRecipientWarning = async ({
    recipient,
    asset,
    amount,
    scope,
}: RecipientWarningInput): Promise<Optional<ChainNotice>> => {
    if (!isNativeAsset(asset, algorandDescriptor)) return undefined

    const state = await fetchOnChainAccountState(recipient, scope)
    const balanceAfter = state.nativeBalanceBaseUnits.add(amount)
    if (balanceAfter.isZero() || balanceAfter.gte(state.reserveBalance)) {
        return undefined
    }

    return {
        title: { key: RECIPIENT_TITLE_KEY },
        body: [
            {
                key: RECIPIENT_BODY_KEY,
                params: { min: toAlgo(state.reserveBalance) },
            },
        ],
    }
}

/** Microalgos of minimum balance each extra asset holding locks. */
export const algorandHoldingReserve = (_scope: ChainScope): Decimal =>
    new Decimal(getMinimumFeeConfig().assetMbr.toString())
