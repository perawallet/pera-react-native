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
import { useInfoButton } from '@components/InfoButton'
import { useLanguage } from '@hooks/useLanguage'

/** Opens the sheet a history row's suspicious badge opens, from an asset's own badge. */
export const useSuspiciousTokenInfo = (): (() => void) => {
    const { t } = useLanguage()
    const { openInfo } = useInfoButton({
        title: t('asset_details.token_warning.suspicious_title'),
        children: t('asset_details.token_warning.body'),
    })
    return openInfo
}
