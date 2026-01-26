/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { PWSwitch, PWText, PWView } from '@components/core'
import { RemoteConfigKeys } from '@perawallet/wallet-core-platform-integration'
import { useStyles } from './styles'
import { useFeatureFlagOverrides } from './useFeatureFlagOverrides'
import { useLanguage } from '@hooks/useLanguage'

export const FeatureFlagOverrides = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        configOverrides,
        expanded,
        toggleExpand,
        toggleOverride,
        prettifyKey,
    } = useFeatureFlagOverrides()

    return (
        <PWView style={styles.container}>
            {Object.keys(RemoteConfigKeys).map(key => (
                <PWView
                    key={key}
                    style={styles.flagContainer}
                >
                    <PWView style={styles.row}>
                        <PWView>
                            <PWText
                                variant='h4'
                                style={styles.flagTitle}
                            >
                                {prettifyKey(key)}
                            </PWText>
                            <PWText
                                variant='caption'
                                style={styles.flagCaption}
                            >
                                {configOverrides[key]
                                    ? t('settings.developer.enabled')
                                    : t('settings.developer.disabled')}
                                : {key}
                            </PWText>
                        </PWView>
                        <PWSwitch
                            value={expanded.includes(key)}
                            onValueChange={() => toggleExpand(key)}
                        />
                    </PWView>

                    {expanded.includes(key) && (
                        <PWView style={styles.row}>
                            <PWText>
                                {t('settings.developer.overridden')}:{' '}
                                {configOverrides[key]
                                    ? t('settings.developer.enabled')
                                    : t('settings.developer.disabled')}
                            </PWText>
                            <PWSwitch
                                value={configOverrides[key] === true}
                                onValueChange={() => toggleOverride(key)}
                            />
                        </PWView>
                    )}
                </PWView>
            ))}
        </PWView>
    )
}
