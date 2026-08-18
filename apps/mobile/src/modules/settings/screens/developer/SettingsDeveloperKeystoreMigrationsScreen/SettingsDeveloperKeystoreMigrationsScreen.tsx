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

import { Alert } from 'react-native'

import { PWButton, PWScreen, PWText, PWView } from '@components/core'
import { useSettingsDeveloperKeystoreMigrationsScreen } from './useSettingsDeveloperKeystoreMigrationsScreen'
import { useStyles } from './styles'

export const SettingsDeveloperKeystoreMigrationsScreen = () => {
    const styles = useStyles()
    const { modules, resetModule } =
        useSettingsDeveloperKeystoreMigrationsScreen()

    const confirmReset = (id: string, label: string) => {
        Alert.alert(
            `Reset ${label} migrations?`,
            "Clears this module's recorded revisions so they re-run on the next " +
                'app launch. Repairs is the normal recovery lever. Resetting ' +
                'Preflight or Keystore core re-splits passkey credentials, and ' +
                'that split persists until Repairs also re-runs — reset Repairs ' +
                'too before relaunching. Takes effect only after you fully close ' +
                'and reopen Pera.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: () => {
                        resetModule(id)
                        Alert.alert(
                            'Ledger reset',
                            `${label} will re-run on next launch. Fully close and reopen Pera now.`,
                        )
                    },
                },
            ],
        )
    }

    return (
        <PWScreen>
            <PWView style={styles.container}>
                <PWText variant='caption'>
                    Recorded keystore-migration revisions. Reset a module to
                    force its revisions to re-run on next launch (per-module —
                    never all at once).
                </PWText>
                {modules.map(module => (
                    <PWView
                        key={module.id}
                        style={styles.moduleRow}
                    >
                        <PWView style={styles.moduleInfo}>
                            <PWText>{module.label}</PWText>
                            <PWText variant='caption'>
                                {module.revision
                                    ? `at rev ${module.revision.id} · ${module.revision.name}`
                                    : 'not yet run'}
                            </PWText>
                        </PWView>
                        <PWButton
                            variant='secondary'
                            title='Reset'
                            isDisabled={!module.revision}
                            onPress={() =>
                                confirmReset(module.id, module.label)
                            }
                            testID={`keystore_migration_reset_${module.id}`}
                        />
                    </PWView>
                ))}
            </PWView>
        </PWScreen>
    )
}
