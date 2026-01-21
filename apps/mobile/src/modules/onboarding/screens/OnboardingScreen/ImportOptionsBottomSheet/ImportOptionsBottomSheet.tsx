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

import React from 'react'
import {
    PWBottomSheet,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useStyles } from './styles'

export type ImportOptionsBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    onUniversalWalletPress: () => void
    onAlgo25Press: () => void
}

export const ImportOptionsBottomSheet = ({
    isVisible,
    onClose,
    onUniversalWalletPress,
    onAlgo25Press,
}: ImportOptionsBottomSheetProps) => {
    const styles = useStyles()

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
        >
            <PWView style={styles.container}>
                <PWView style={styles.header}>
                    <PWTouchableOpacity
                        onPress={onClose}
                        style={styles.closeButton}
                    >
                        <PWIcon
                            name='cross'
                            variant='secondary'
                        />
                    </PWTouchableOpacity>

                    <PWText
                        variant='h4'
                        style={styles.title}
                    >
                        Select your Mnemonic type
                    </PWText>
                </PWView>

                <PWView style={styles.optionsContainer}>
                    <PWTouchableOpacity
                        onPress={onUniversalWalletPress}
                        style={styles.optionBox}
                    >
                        <PWView style={styles.optionContent}>
                            <PWView style={styles.optionTopContent}>
                                <PWText
                                    variant='h3'
                                    style={styles.optionTitle}
                                >
                                    Universal Wallet
                                </PWText>
                                <PWText
                                    variant='body'
                                    style={styles.optionCaption}
                                >
                                    Wallet that lets you derive new accounts,
                                    all using the same mnemonic
                                </PWText>
                            </PWView>
                            <PWText
                                variant='link'
                                style={styles.optionLink}
                            >
                                24 words mnemonic keys
                            </PWText>
                        </PWView>

                        <PWView style={styles.rightIconContainer}>
                            <PWIcon
                                name='chevron-right'
                                size='sm'
                                variant='secondary'
                            />
                        </PWView>
                    </PWTouchableOpacity>

                    <PWTouchableOpacity
                        onPress={onAlgo25Press}
                        style={styles.optionBox}
                    >
                        <PWView style={styles.optionContent}>
                            <PWView style={styles.optionTopContent}>
                                <PWText
                                    variant='h3'
                                    style={styles.optionTitle}
                                >
                                    ALGO25
                                </PWText>
                                <PWText
                                    variant='body'
                                    style={styles.optionCaption}
                                >
                                    Legacy format that is specific to Algorand
                                    ecosystem
                                </PWText>
                            </PWView>
                            <PWText
                                variant='link'
                                style={styles.optionLink}
                            >
                                24 words mnemonic keys
                            </PWText>
                        </PWView>

                        <PWView style={styles.rightIconContainer}>
                            <PWIcon
                                name='chevron-right'
                                size='sm'
                                variant='secondary'
                            />
                        </PWView>
                    </PWTouchableOpacity>
                </PWView>
            </PWView>
        </PWBottomSheet>
    )
}
