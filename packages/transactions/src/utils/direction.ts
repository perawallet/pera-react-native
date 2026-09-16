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

import type { TransactionHistoryItem } from '../models/types'

/**
 * The account debited by a transaction.
 *
 * `sender` authorizes a transaction; on an asset clawback that is the clawback
 * authority, while the holding leaves someone else's account entirely. Reading
 * direction off `sender` therefore renders a seizure as an incoming transfer,
 * which is why every row label, icon and amount sign goes through here.
 */
export const getDebitedAddress = (item: TransactionHistoryItem): string =>
    item.assetSender ?? item.sender

/** Whether `address` is the account this transaction takes funds from. */
export const isOutgoingFor = (
    item: TransactionHistoryItem,
    address: string,
): boolean => getDebitedAddress(item) === address
