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

import { PWView } from '@components/core'
import { RoundButton } from '@components/RoundButton'
import type { SheetOption } from '@components/SheetOptionRow'
import { useStyles } from './styles'

export type AccountTopActionsProps = {
    actions: SheetOption[]
}

export const AccountTopActions = ({ actions }: AccountTopActionsProps) => {
    const styles = useStyles()

    return (
        <PWView style={styles.topActions}>
            {actions.map(action => (
                <RoundButton
                    key={action.id}
                    icon={action.icon}
                    title={action.title}
                    titleNumberOfLines={2}
                    variant={
                        action.variant === 'destructive'
                            ? 'destructive'
                            : 'secondary'
                    }
                    onPress={action.onPress}
                    disabled={action.disabled}
                    testID={`account_option_${action.id}`}
                    style={styles.topAction}
                />
            ))}
        </PWView>
    )
}
