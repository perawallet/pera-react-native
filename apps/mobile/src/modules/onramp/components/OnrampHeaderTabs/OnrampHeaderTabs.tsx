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

import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type OnrampTab = 'fund' | 'history'

export type OnrampHeaderTabsProps = {
    activeTab: OnrampTab
    onTabChange: (tab: OnrampTab) => void
    /** Tabs to mark with a "needs attention" dot (e.g. pending orders). */
    badges?: Partial<Record<OnrampTab, boolean>>
}

const TABS: { key: OnrampTab; labelKey: string }[] = [
    { key: 'fund', labelKey: 'onramp.tabs.fund' },
    { key: 'history', labelKey: 'onramp.tabs.history' },
]

export const OnrampHeaderTabs = ({
    activeTab,
    onTabChange,
    badges,
}: OnrampHeaderTabsProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.container}>
            {TABS.map(({ key, labelKey }) => {
                const isActive = activeTab === key
                return (
                    <PWTouchableOpacity
                        key={key}
                        onPress={() => onTabChange(key)}
                        style={styles.tab}
                        testID={`onramp-tab-${key}`}
                    >
                        <PWText
                            variant='h1'
                            style={isActive ? styles.activeLabel : styles.label}
                        >
                            {t(labelKey)}
                        </PWText>
                        {badges?.[key] && (
                            <PWView
                                style={styles.badge}
                                testID={`onramp-tab-${key}-badge`}
                            />
                        )}
                    </PWTouchableOpacity>
                )
            })}
        </PWView>
    )
}
