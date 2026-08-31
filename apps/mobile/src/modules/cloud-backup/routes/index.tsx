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
    createNativeStackNavigator,
    type NativeStackHeaderProps,
} from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'

import { useCloudBackupStore } from '@perawallet/wallet-core-backup'
import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { NavigationHeader } from '@components/NavigationHeader'
import { PWIcon, PWTouchableOpacity } from '@components/core'
import { fullScreenLayout } from '@layouts/index'
import { screenListeners } from '@routes/listeners'
import { CloudBackupScreen } from '../screens/CloudBackupScreen'
import { CloudBackupSetupScreen } from '../screens/CloudBackupSetupScreen'
import { CloudBackupVerifyScreen } from '../screens/CloudBackupVerifyScreen'
import { CloudBackupOverviewScreen } from '../screens/CloudBackupOverviewScreen'
import { CloudBackupRestorePassphraseScreen } from '../screens/CloudBackupRestorePassphraseScreen'
import { CloudBackupRestoreEncryptionKeyScreen } from '../screens/CloudBackupRestoreEncryptionKeyScreen'
import type { CloudBackupStackParamList } from './types'

export type { CloudBackupStackParamList } from './types'

const CloudBackupStack = createNativeStackNavigator<CloudBackupStackParamList>()

const CloudBackupCloseButton = () => {
    const navigation = useNavigation()

    return (
        <PWTouchableOpacity
            onPress={navigation.goBack}
            testID='cloud_backup_close_button'
        >
            <PWIcon name='cross' />
        </PWTouchableOpacity>
    )
}

export const CloudBackupStackNavigator = () => {
    const isConfigured = useCloudBackupStore(state => state.isConfigured())

    return (
        <CloudBackupStack.Navigator
            initialRouteName={
                isConfigured ? 'CloudBackupOverview' : 'CloudBackupHome'
            }
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader {...props} />
                ),
                ...SCREEN_ANIMATION_CONFIG,
            }}
            screenListeners={screenListeners}
            layout={fullScreenLayout}
        >
            <CloudBackupStack.Screen
                name='CloudBackupHome'
                options={{
                    title: '',
                }}
                component={CloudBackupScreen}
            />
            <CloudBackupStack.Screen
                name='CloudBackupSetup'
                options={{
                    title: 'cloud_backup.setup.title',
                    headerLeft: () => <CloudBackupCloseButton />,
                }}
                component={CloudBackupSetupScreen}
            />
            <CloudBackupStack.Screen
                name='CloudBackupVerify'
                options={{
                    title: 'cloud_backup.verify.title',
                }}
                component={CloudBackupVerifyScreen}
            />
            <CloudBackupStack.Screen
                name='CloudBackupOverview'
                options={{
                    title: 'cloud_backup.overview.title',
                }}
                component={CloudBackupOverviewScreen}
            />
            <CloudBackupStack.Screen
                name='CloudBackupRestorePassphrase'
                options={{
                    title: '',
                }}
                component={CloudBackupRestorePassphraseScreen}
            />
            <CloudBackupStack.Screen
                name='CloudBackupRestoreEncryptionKey'
                options={{
                    title: '',
                }}
                component={CloudBackupRestoreEncryptionKeyScreen}
            />
        </CloudBackupStack.Navigator>
    )
}
