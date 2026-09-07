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

import { PWButton, PWText, PWView } from '@components/core'
import type { ParamListBase } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useStyles } from '../styles'

type MigrationDevToolsRowProps = {
    navigation: NativeStackNavigationProp<ParamListBase>
}

export const MigrationDevToolsRow = ({
    navigation,
}: MigrationDevToolsRowProps) => {
    const styles = useStyles()
    return (
        <>
            <PWView style={styles.devToolsDivider} />
            <PWText
                variant='caption'
                style={styles.devToolsLabel}
            >
                Dev tools
            </PWText>
            <PWView style={styles.devToolsRow}>
                <PWView style={styles.devToolsButton}>
                    <PWButton
                        variant='secondary'
                        title='Migrations info'
                        onPress={() => navigation.push('MigrationInfo')}
                    />
                </PWView>
                <PWView style={styles.devToolsButton}>
                    <PWButton
                        variant='secondary'
                        title='Simulator'
                        onPress={() => navigation.push('MigrationSimulator')}
                    />
                </PWView>
            </PWView>
        </>
    )
}
