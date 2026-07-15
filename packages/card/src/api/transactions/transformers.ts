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

import { toDecimal, toEnumValue } from '@perawallet/wallet-core-shared'
import {
    TransactionSign,
    TransactionStatus,
    type CardTransaction,
    type FundingSource,
} from '../../models'
import type { CardTransactionApiResponse } from './schema'

type FundingSourceApiResponse = NonNullable<
    CardTransactionApiResponse['fundingSources']
>[number]

const transformFundingSource = (
    response: FundingSourceApiResponse,
): FundingSource => ({
    id: response.id ?? '',
    address: response.address ?? '',
    network: response.network ?? '',
    currency: response.currency ?? '',
    txHash: response.txHash ?? undefined,
    sign: toEnumValue(TransactionSign, response.sign, TransactionSign.Debit),
    status: toEnumValue(
        TransactionStatus,
        response.status,
        TransactionStatus.Pending,
    ),
    amount: toDecimal(response.amount),
    fees: toDecimal(response.fees),
    swapFee: toDecimal(response.swapFee),
    dateTime: response.dateTime ?? '',
})

export const transformCardTransaction = (
    response: CardTransactionApiResponse,
): CardTransaction => ({
    id: response.id,
    cardId: response.cardId ?? '',
    transactionId: response.transactionId ?? '',
    panLast4: response.panLast4 ?? '',
    sign: toEnumValue(TransactionSign, response.sign, TransactionSign.Debit),
    status: toEnumValue(
        TransactionStatus,
        response.status,
        TransactionStatus.Pending,
    ),
    merchantName: response.merchantNameLocation ?? undefined,
    merchantType: response.merchantType ?? undefined,
    mcc: response.mcc != null ? String(response.mcc) : undefined,
    mccCategory: response.mccCategory ?? undefined,
    declineReason: response.declineReason ?? undefined,
    dateTime: response.dateTime ?? '',
    transactionCurrency: response.transactionCurrency ?? '',
    originalCurrency: response.originalCurrency ?? '',
    amountInTransactionCurrency: toDecimal(
        response.amountInTransactionCurrency,
    ),
    feesInTransactionCurrency: toDecimal(response.feesInTransactionCurrency),
    amountInOriginalCurrency: toDecimal(response.amountInOriginalCurrency),
    feesInOriginalCurrency: toDecimal(response.feesInOriginalCurrency),
    billingConversionRate: toDecimal(response.billingConversionRate),
    ecbRate: toDecimal(response.ecbRate),
    fundingSources: (response.fundingSources ?? []).map(transformFundingSource),
})
