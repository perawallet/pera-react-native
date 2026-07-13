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
/* oxlint-disable react-native/no-inline-styles, react-native/no-color-literals -- temporary M1 bootstrap; replaced by makeStyles shell in milestone 3 */

import React, { useEffect, useState } from 'react'
// oxlint-disable-next-line no-restricted-imports -- temporary M1 bootstrap
// screen; the real web shell (milestone 3) uses @components/core. Kept off
// the core barrel to keep the web dependency graph minimal while the
// pipeline is proven.
// guardrails-ignore-next-line: no-primitive-rn-components -- temporary M1 bootstrap; PW components used in milestone 3
import { Text, View } from 'react-native'
import {
    getPlatformServices,
    hydratePlatform,
} from '@perawallet/wallet-extension-platform-driver'

export const App = (): React.JSX.Element => {
    const [status, setStatus] = useState('hydrating platform…')

    useEffect(() => {
        const bootstrap = async (): Promise<void> => {
            await hydratePlatform()
            const services = getPlatformServices()
            services.keyValueStorage.setItem('web-bootstrap-smoke', 'ok')
            const roundtrip = services.keyValueStorage.getItem(
                'web-bootstrap-smoke',
            )
            const version = services.deviceInfo.getAppVersion()
            const platform = services.deviceInfo.getDevicePlatform()
            setStatus(
                `Pera Wallet ${version} on ${platform} — storage ${roundtrip}`,
            )
        }
        bootstrap().catch(error => {
            setStatus(`bootstrap failed: ${String(error)}`)
        })
    }, [])

    return (
        <View
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
            <Text testID='bootstrap-status'>{status}</Text>
        </View>
    )
}
