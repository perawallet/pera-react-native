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

import type { ReactNode } from 'react'
import { ActivityIndicator } from 'react-native'
import { useTheme } from '@rneui/themed'
import { PWButton, PWIcon, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { useStyles } from './styles'

export type SignerStatus = 'signed' | 'declined' | 'pending' | 'unsigned'

export type SignerAction = {
    label: string
    onPress: () => void
    isLoading?: boolean
    /**
     * Visually disables the row's Sign button without changing the label.
     * Used in draft (deferred-propose) mode to enforce one-at-a-time taps:
     * the first per-row Sign bootstraps the backend propose; until it
     * completes, other rows are blocked so we don't race two propose calls
     * on the same draft.
     */
    isDisabled?: boolean
}

export type SignerStatusListItemProps = {
    address: string
    status: SignerStatus
    action?: SignerAction
}

export const SignerStatusListItem = ({
    address,
    status,
    action,
}: SignerStatusListItemProps) => {
    const styles = useStyles()
    const { theme } = useTheme()

    const statusIcons: Record<SignerStatus, ReactNode> = {
        signed: (
            <PWIcon
                name='check'
                size='md'
                variant='positive'
            />
        ),
        declined: (
            <PWIcon
                name='cross'
                size='md'
                variant='error'
            />
        ),
        pending: (
            <ActivityIndicator
                size='small'
                color={theme.colors.textGray}
            />
        ),
        unsigned: (
            <PWIcon
                name='minus'
                size='md'
                variant='secondary'
            />
        ),
    }

    return (
        <PWView
            style={styles.container}
            testID={`signer_status_item_${address}`}
        >
            <AddressDisplay
                address={address}
                showCopy={false}
                forceShowIcon
                contactAvatarVariant='highlighted'
                style={styles.addressDisplay}
            />
            {action ? (
                <PWButton
                    variant='primary'
                    paddingStyle='dense'
                    title={action.label}
                    onPress={action.onPress}
                    isLoading={action.isLoading}
                    isDisabled={action.isDisabled}
                    testID={`signer_status_action_${address}`}
                />
            ) : (
                <PWView testID={`signer_status_icon_${status}_${address}`}>
                    {statusIcons[status]}
                </PWView>
            )}
        </PWView>
    )
}
