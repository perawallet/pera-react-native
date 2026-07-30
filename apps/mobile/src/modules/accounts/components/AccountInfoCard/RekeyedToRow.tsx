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

import { useCallback } from 'react'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import {
    getAccountDisplayName,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    dedupeSecondaryLabel,
    truncateAlgorandAddress,
} from '@perawallet/wallet-core-shared'
import { useClipboard } from '@hooks/useClipboard'
import { AccountIcon } from '../AccountIcon'
import type { useStyles } from './styles'

type RekeyedToRowProps = {
    authAccount?: WalletAccount
    authAddress: string
    onUndoRekey?: () => void
    styles: ReturnType<typeof useStyles>
    labelText: string
    undoLabel: string
}

export const RekeyedToRow = ({
    authAccount,
    authAddress,
    onUndoRekey,
    styles,
    labelText,
    undoLabel,
}: RekeyedToRowProps) => {
    const { copyToClipboard } = useClipboard()
    const address = authAccount?.address ?? authAddress
    const truncated = truncateAlgorandAddress(address)
    const title = authAccount ? getAccountDisplayName(authAccount) : truncated
    const secondary = dedupeSecondaryLabel(title, truncated)

    const handleCopyAddress = useCallback(() => {
        void copyToClipboard(address)
    }, [copyToClipboard, address])

    return (
        <PWView style={styles.rekeyedSection}>
            <PWText
                variant='body'
                style={styles.labelText}
            >
                {labelText}
            </PWText>
            <PWView style={styles.rekeyedRow}>
                {authAccount && (
                    <AccountIcon
                        account={authAccount}
                        size='lg'
                    />
                )}
                <PWTouchableOpacity
                    style={styles.rekeyedAddressTouchable}
                    onPress={handleCopyAddress}
                    onLongPress={handleCopyAddress}
                    hitSlop={8}
                >
                    <PWView style={styles.rekeyedRowText}>
                        <PWText
                            variant='bodyLarge'
                            numberOfLines={1}
                        >
                            {title}
                        </PWText>
                        {!!secondary && (
                            <PWText
                                variant='caption'
                                style={styles.rekeyedSubtitle}
                                numberOfLines={1}
                            >
                                {secondary}
                            </PWText>
                        )}
                    </PWView>
                    <PWIcon
                        name='copy'
                        size='sm'
                        variant='secondary'
                    />
                </PWTouchableOpacity>
                {onUndoRekey && (
                    <PWTouchableOpacity
                        style={styles.rekeyedUndo}
                        onPress={onUndoRekey}
                        hitSlop={8}
                    >
                        <PWText
                            variant='bodySemibold'
                            style={styles.rekeyedUndoLink}
                        >
                            {undoLabel}
                        </PWText>
                    </PWTouchableOpacity>
                )}
            </PWView>
        </PWView>
    )
}
