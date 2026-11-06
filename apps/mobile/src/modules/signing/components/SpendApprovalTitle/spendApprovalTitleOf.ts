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

import type { Optional } from '@perawallet/wallet-core-shared'
import type { useLanguage } from '@hooks/useLanguage'

type Translate = ReturnType<typeof useLanguage>['t']

/**
 * "Allow {spender} to use your {asset}", falling back to "another address"
 * when the spender isn't in the registry and to "your assets" when the token's
 * unit isn't known.
 */
export const spendApprovalTitleOf = (
    t: Translate,
    {
        spenderName,
        unitName,
    }: { spenderName: Optional<string>; unitName: Optional<string> },
): string => {
    if (spenderName) {
        return unitName
            ? t('signing.spend_approval.allow_title', {
                  spender: spenderName,
                  asset: unitName,
              })
            : t('signing.spend_approval.allow_title_assets', {
                  spender: spenderName,
              })
    }
    return unitName
        ? t('signing.spend_approval.allow_title_unknown', { asset: unitName })
        : t('signing.spend_approval.allow_title_unknown_assets')
}
