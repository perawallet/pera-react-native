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

import React, { PropsWithChildren } from 'react'
import { useAutoLockListener } from './useAutoLockListener'
import { useStyles } from './AutoLockGuard.style'
import { PWView } from '@components/core'
import { PinEntry } from '../PinEntry'
import { useLanguage } from '@hooks/useLanguage'
import { LockoutView } from './LockoutView'
import { useLockScreen } from './useLockScreen'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LoadingView } from '@components/LoadingView'
import { Modal } from 'react-native'

export const AutoLockGuard = ({ children }: PropsWithChildren) => {
    const { isLocked, isChecking, unlock, handleResetData } =
        useAutoLockListener()
    const {
        hasError,
        isLockedOut,
        remainingSeconds,
        handlePinComplete,
        handleErrorAnimationComplete,
    } = useLockScreen({ onUnlock: unlock })
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { t } = useLanguage()

    // we return the loading/lock screen as an overlay to allow the
    // main screen to pre-load
    return (
        <>
            {isChecking && <PWView style={styles.overlayContainer}>
                <LoadingView variant='circle' />
            </PWView>}
            {isLocked && (<Modal visible={true} animationType='slide'>

                <PWView style={styles.container}>
                    {isLockedOut ? (
                        <PWView style={styles.container}>
                            <LockoutView
                                remainingSeconds={remainingSeconds}
                                onResetData={handleResetData}
                            />
                        </PWView>
                    ) : (
                        <PWView style={styles.container}>
                            <PinEntry
                                title={t('security.pin.unlock_title')}
                                onPinComplete={handlePinComplete}
                                hasError={hasError}
                                onErrorAnimationComplete={
                                    handleErrorAnimationComplete
                                }
                            />
                        </PWView>
                    )}
                </PWView>
            </Modal>)}
            {children}
        </>
    )
}
