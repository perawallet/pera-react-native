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

import {
    i18nKey,
    type FeePreset,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'

// Record keeps this exhaustive: a new preset fails to compile until labelled.
export const FEE_PRESET_LABELS: Record<FeePreset, I18nKey> = {
    slow: i18nKey('send_funds.fee.slow'),
    normal: i18nKey('send_funds.fee.normal'),
    fast: i18nKey('send_funds.fee.fast'),
}
