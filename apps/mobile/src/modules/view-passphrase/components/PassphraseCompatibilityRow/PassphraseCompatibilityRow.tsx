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

import type { I18nKey } from '@perawallet/wallet-core-chain-contract'
import { PWText, PWView } from '@components/core'
import { InfoButton } from '@components/InfoButton'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type PassphraseCompatibilityRowProps = {
    compatibilityKeys: readonly I18nKey[]
    testID?: string
}

export const PassphraseCompatibilityRow = ({
    compatibilityKeys,
    testID = 'view_passphrase_bottom_sheet_compatibility',
}: PassphraseCompatibilityRowProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const title = t('view_passphrase.compatibility.title')

    return (
        <InfoButton
            title={title}
            testID={testID}
            trigger={
                <PWText
                    variant='bodySemibold'
                    style={styles.label}
                >
                    {title}
                </PWText>
            }
        >
            <PWView style={styles.body}>
                {compatibilityKeys.map(key => (
                    <PWText key={key}>{t(key)}</PWText>
                ))}
                <PWText>{t('view_passphrase.compatibility.warning')}</PWText>
            </PWView>
        </InfoButton>
    )
}
