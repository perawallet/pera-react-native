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

import { DEFAULT_PRECISION } from '@perawallet/wallet-core-shared'

/**
 * Base currency all internal prices are denominated in before conversion.
 *
 * (ALGO as a selectable currency uses the shared `ALGO_ASSET_NAME`.)
 */
export const USD_CURRENCY_ID = 'USD'

/** Display/entry precision for fiat amounts. */
export const FIAT_DECIMAL_PLACES = DEFAULT_PRECISION
