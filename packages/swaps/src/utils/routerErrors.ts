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

import { isPeraNetworkError } from '@perawallet/wallet-core-shared'

const QUOTE_GONE_CODES: readonly string[] = [
    'quote_not_found',
    'quote_already_used',
]

/** The order call refused the quote as expired or spent: re-quote, don't fail. */
export const isSwapQuoteGoneError = (error: unknown): boolean =>
    isPeraNetworkError(error) &&
    error.backendCode !== undefined &&
    QUOTE_GONE_CODES.includes(error.backendCode)
