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

import React, { useEffect, useState } from 'react'
import './i18n'
import { Text } from 'react-native'
import { QueryProvider } from './providers/QueryProvider'
import { useBootstrapper } from './bootstrap/boostrap'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { Persister } from '@tanstack/react-query-persist-client'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { RootComponent } from './components/root/RootComponent'
import BootSplash from 'react-native-bootsplash'
import { NotifierWrapper } from 'react-native-notifier'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { TokenProvider } from './providers/TokenProvider'
import { useLanguage } from './hooks/language'

function App() {
    const [persister, setPersister] = useState<Persister>()

    const [bootstrapped, setBootstrapped] = useState(false)
    const [fcmToken, setFcmToken] = useState<string | null>(null)
    const bootstrap = useBootstrapper()
    const { t } = useLanguage()

    useEffect(() => {
        if (!bootstrapped) {
            bootstrap().then(({ platformServices, token }) => {
                setFcmToken(token ?? null)
                const kvService = platformServices.keyValueStorage
                const reactQueryPersistor = createAsyncStoragePersister({
                    storage: kvService,
                })

                setPersister(reactQueryPersistor)
                setBootstrapped(true)

                //we defer the hiding so the initial layout can happen
                setTimeout(() => {
                    BootSplash.hide({ fade: true })
                }, 200)
            })
        }
    }, [bootstrapped, bootstrap])

    return (
        <SafeAreaProvider>
            {!bootstrapped && <Text>{t('common.loading.label')}</Text>}
            {bootstrapped && persister && (
                <GestureHandlerRootView>
                    <NotifierWrapper>
                        <TokenProvider token={fcmToken}>
                            <QueryProvider persister={persister}>
                                <RootComponent />
                            </QueryProvider>
                        </TokenProvider>
                    </NotifierWrapper>
                </GestureHandlerRootView>
            )}
        </SafeAreaProvider>
    )
}

export default App
