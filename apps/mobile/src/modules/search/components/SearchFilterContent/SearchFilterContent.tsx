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

import { useState } from 'react'
import { PWSheetLayout, PWSwitch, PWText, PWView } from '@components/core'
import { SEARCH_SCOPES, type SearchScope } from '@perawallet/wallet-core-search'
import { SheetHeader } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type SearchFilterContentProps = {
    scopes: SearchScope[]
    onToggleScope: (scope: SearchScope) => void
}

const SCOPE_LABEL_KEYS: Record<SearchScope, string> = {
    accounts: 'search.filter.accounts',
    contacts: 'search.filter.contacts',
    assets: 'search.filter.assets',
}

export const SearchFilterContent = ({
    scopes,
    onToggleScope,
}: SearchFilterContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    // Static sheet content never sees `scopes` prop updates, so track toggles
    // locally and mirror each change up to the parent.
    const [activeScopes, setActiveScopes] = useState<SearchScope[]>(scopes)

    const handleToggle = (scope: SearchScope) => {
        setActiveScopes(prev =>
            prev.includes(scope)
                ? prev.filter(s => s !== scope)
                : [...prev, scope],
        )
        onToggleScope(scope)
    }

    return (
        <PWSheetLayout
            header={
                <SheetHeader
                    title={t('search.filter.title')}
                    testID='search_filter_sheet'
                />
            }
        >
            <PWView style={styles.body}>
                {SEARCH_SCOPES.map(scope => (
                    <PWView
                        key={scope}
                        style={styles.row}
                    >
                        <PWText variant='body'>
                            {t(SCOPE_LABEL_KEYS[scope])}
                        </PWText>
                        <PWSwitch
                            value={activeScopes.includes(scope)}
                            onValueChange={() => handleToggle(scope)}
                            testID={`search_filter_toggle_${scope}`}
                        />
                    </PWView>
                ))}
            </PWView>
        </PWSheetLayout>
    )
}
