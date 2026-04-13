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

import { PWImage, PWText, PWView } from '@components/core'
import { useProvidersQuery } from '@perawallet/wallet-core-swaps'
import { useStyles } from './styles'

export type SwapProviderDisplayProps = {
    providerName: string | undefined
    providerDisplayName: string | undefined
}

export const SwapProviderDisplay = ({
    providerName,
    providerDisplayName,
}: SwapProviderDisplayProps) => {
    const styles = useStyles()
    const { data: providers } = useProvidersQuery()

    const provider = providers?.find(item => item.name === providerName)
    const label = providerDisplayName ?? providerName ?? '-'

    return (
        <PWView style={styles.container}>
            {provider?.iconUrl && (
                <PWImage
                    source={{ uri: provider.iconUrl }}
                    width={16}
                    height={16}
                    containerStyle={styles.logo}
                />
            )}
            <PWText style={styles.label}>{label}</PWText>
        </PWView>
    )
}
