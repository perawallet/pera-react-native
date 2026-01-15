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

import { PWView } from '@components/core/PWView'
import {
    RemoteConfigKeys,
    useRemoteConfigOverrides,
} from '@perawallet/wallet-core-platform-integration'
import { PWSwitch } from '@components/core/PWSwitch'
import { PWText } from '@components/core/PWText'
import { useStyles } from './styles'

export const FeatureFlagOverrides = () => {
    const styles = useStyles()
    const { configOverrides, setConfigOverride } = useRemoteConfigOverrides()

    const toggleOverride = (key: string) => {
        const value = configOverrides[key]
        if (value === undefined) {
            setConfigOverride(key, true)
        } else {
            setConfigOverride(key, null)
        }
    }

    return (
        <PWView style={styles.container}>
            {Object.values(RemoteConfigKeys).map(key => (
                <PWView
                    key={key}
                    style={styles.row}
                >
                    <PWText>{key}</PWText>
                    <PWSwitch
                        value={configOverrides[key] === true}
                        onValueChange={() => toggleOverride(key)}
                    />
                </PWView>
            ))}
        </PWView>
    )
}
