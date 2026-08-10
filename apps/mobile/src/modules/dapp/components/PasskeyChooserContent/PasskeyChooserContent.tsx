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

// Identity chooser for a discoverable ("usernameless") WebAuthn request.
//
// The RP sent no allowCredentials and this site has more than one passkey, so
// the authenticator core asks rather than asserting the first match — see
// SigningContext.selectCredential. Resolves the sheet with the chosen keyId,
// or dismisses (null), which the core treats as a decline.
//
// Deliberately shaped like EnableRequestScreen's account list — the same
// "which of your identities does this site get" question, so it should look
// like the same decision.
import React from 'react'
import {
    PWIcon,
    PWSheetLayout,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type PasskeyChoice = {
    keyId: string
    displayName?: string
    userName?: string
}

type PasskeyChooserContentProps = {
    /** The RP ID being signed in to, shown so the user knows who is asking. */
    rpId: string
    choices: PasskeyChoice[]
}

export const PasskeyChooserContent = ({
    rpId,
    choices,
}: PasskeyChooserContentProps): React.JSX.Element => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { resolve } = useBottomSheetResult<string>()

    return (
        <PWSheetLayout
            horizontalPadding='none'
            header={<SheetHeader title={t('dapp.passkey.choose.title')} />}
        >
            <PWText
                variant='body'
                style={styles.description}
            >
                {t('dapp.passkey.choose.description', { origin: rpId })}
            </PWText>
            {choices.map(choice => (
                <PWTouchableOpacity
                    key={choice.keyId}
                    style={styles.row}
                    onPress={() => resolve(choice.keyId)}
                    testID={`passkey-choice-${choice.keyId}`}
                >
                    <PWView style={styles.rowText}>
                        <PWText
                            variant='body'
                            style={styles.name}
                            numberOfLines={1}
                        >
                            {/* An RP may send neither label; the key id is the
                                last resort so a row is never blank. */}
                            {choice.displayName ??
                                choice.userName ??
                                choice.keyId}
                        </PWText>
                        {!!choice.userName &&
                            choice.userName !== choice.displayName && (
                                <PWText
                                    variant='caption'
                                    style={styles.secondary}
                                    numberOfLines={1}
                                >
                                    {choice.userName}
                                </PWText>
                            )}
                    </PWView>
                    <PWIcon
                        name='chevron-right'
                        size='sm'
                    />
                </PWTouchableOpacity>
            ))}
        </PWSheetLayout>
    )
}
