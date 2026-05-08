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

import { ActivityIndicator } from 'react-native'
import { useTheme } from '@rneui/themed'
import { PWIcon, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { useStyles } from './styles'

export type SignerStatus = 'signed' | 'declined' | 'pending' | 'unsigned'

export type SignerStatusListItemProps = {
    address: string
    status: SignerStatus
}

export const SignerStatusListItem = ({
    address,
    status,
}: SignerStatusListItemProps) => {
    const styles = useStyles()
    const { theme } = useTheme()

    return (
        <PWView
            style={styles.container}
            testID={`signer_status_item_${address}`}
        >
            <AddressDisplay
                address={address}
                showCopy={false}
                forceShowIcon
                style={styles.addressDisplay}
            />
            <PWView testID={`signer_status_icon_${status}_${address}`}>
                {status === 'signed' && (
                    <PWIcon
                        name='check'
                        size='md'
                        variant='positive'
                    />
                )}
                {status === 'declined' && (
                    <PWIcon
                        name='cross'
                        size='md'
                        variant='error'
                    />
                )}
                {status === 'pending' && (
                    <ActivityIndicator
                        size='small'
                        color={theme.colors.textGray}
                    />
                )}
                {status === 'unsigned' && (
                    <PWIcon
                        name='minus'
                        size='md'
                        variant='secondary'
                    />
                )}
            </PWView>
        </PWView>
    )
}
