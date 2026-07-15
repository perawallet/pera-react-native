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

// The swap configuration UI collects slippage as a percent (e.g. "1" for 1%),
// but the Pera Swap quotes API expects a decimal fraction on the request
// (e.g. "0.01" for 1%, validated as <= 0.9999).
export const percentToApiSlippage = (percent: string): string =>
    new Decimal(percent).div(100).toString()

// Quotes return slippage as a decimal fraction (e.g. "0.01" for 1%) and
// the UI needs to render it as a percent.
export const apiSlippageToPercent = (slippage: Decimal): string =>
    slippage.mul(100).toString()
