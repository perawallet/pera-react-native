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

import { toDecimal, toEnumValueOrNull } from '@perawallet/wallet-core-shared'
import {
    type CardWalletBalance,
    type CardWalletHistoryEntry,
    TransactionSign,
    type WalletWithdrawResult,
} from '../../models'
import type {
    WalletBalanceApiResponse,
    WalletHistoryEntryApiResponse,
    WalletWithdrawApiResponse,
} from './schema'

export const transformWalletBalance = (
    response: WalletBalanceApiResponse,
): CardWalletBalance => ({
    id: response.id,
    balance: toDecimal(response.balance),
    currency: response.currency,
    isWithdrawable: response.isWithdrawable ?? false,
})

export const transformWalletWithdraw = (
    response: WalletWithdrawApiResponse,
): WalletWithdrawResult => ({
    txHash: response.txHash,
    network: response.network,
    isConfirmed: response.confirmed ?? false,
})

export const transformWalletHistoryEntry = (
    response: WalletHistoryEntryApiResponse,
): CardWalletHistoryEntry => ({
    name: response.name,
    amount: toDecimal(response.amount),
    currency: response.currency,
    // Baanx sends the direction lowercase; the shared enum is uppercase.
    sign: toEnumValueOrNull(TransactionSign, response.sign.toUpperCase()),
    dateTime: response.date,
})
