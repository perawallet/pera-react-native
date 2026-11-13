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

import { findNativeAsset } from '@perawallet/wallet-core-assets'
import type { AssetRef } from '@perawallet/wallet-core-chain-contract'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'

// ISO 4217 codes people read as money; fund, precious-metal, bond, SDR, test and no-currency codes are left out.
const FIAT_CURRENCY_CODES: ReadonlySet<string> = new Set(
    `AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VED VES VND VUV WST XAF XCD XCG XOF XPF YER ZAR ZMW ZWG ZWL`.split(
        ' ',
    ),
)

/**
 * The currency code `unitName` passes itself off as: the chain's native ticker
 * as the chain spells it, or an upper-cased ISO 4217 code. Unit names are
 * free-form and set by whoever creates the asset, so this only ever feeds a
 * warning, never identity.
 */
export const imitatedCurrencyOf = (
    ref: AssetRef,
    unitName: Optional<string>,
): Nullable<string> => {
    const normalised = unitName?.trim().toUpperCase()
    if (!normalised) return null

    const native = findNativeAsset(ref.chainId)
    if (native?.assetId === ref.assetId) return null
    if (native?.unitName?.toUpperCase() === normalised) return native.unitName

    return FIAT_CURRENCY_CODES.has(normalised) ? normalised : null
}
