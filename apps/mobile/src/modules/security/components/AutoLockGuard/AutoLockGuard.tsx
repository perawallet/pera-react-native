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

import React, { type PropsWithChildren } from 'react'
import { useAutoLockListener } from './useAutoLockListener'
import { useStyles } from './AutoLockGuard.style'
import { PWView, PWLoadingOverlay } from '@components/core'
import { PinEntry } from '../PinEntry'
import { useLanguage } from '@hooks/useLanguage'
import { LockOverlayProvider } from '@hooks/useIsLockOverlayVisible'
import { LockoutView } from './LockoutView'
import { useLockScreen } from './useLockScreen'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FullScreenLoadingView } from '@components/FullScreenLoadingView'

export const AutoLockGuard = ({ children }: PropsWithChildren) => {
    const { isLocked, isChecking, unlock, handleResetData } =
        useAutoLockListener()
    const {
        hasError,
        isLockedOut,
        remainingSeconds,
        isDuressWipeInProgress,
        handlePinComplete,
        handleErrorAnimationComplete,
    } = useLockScreen({ onUnlock: unlock, isLocked })
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { t } = useLanguage()

    const showLoadingOverlay = isChecking
    const showLockOverlay = isLocked && !isChecking
    const isGuardActive = showLoadingOverlay || showLockOverlay

    return (
        <>
            <PWView
                style={[
                    styles.childrenContainer,
                    isGuardActive && styles.childrenHidden,
                ]}
                // The children are invisible but still mounted and laid out, so
                // they remain hit-testable without this — a tap could reach a
                // control the user cannot see.
                pointerEvents={isGuardActive ? 'none' : 'auto'}
            >
                <LockOverlayProvider value={isGuardActive}>
                    {children}
                </LockOverlayProvider>
            </PWView>
            {showLoadingOverlay && (
                <PWView style={styles.loadingOverlay}>
                    <FullScreenLoadingView />
                </PWView>
            )}
            {showLockOverlay && (
                <PWView style={styles.lockOverlay}>
                    {isLockedOut ? (
                        <LockoutView
                            remainingSeconds={remainingSeconds}
                            onResetData={handleResetData}
                        />
                    ) : (
                        <PinEntry
                            title={t('security.pin.unlock_title')}
                            onPinComplete={pin => void handlePinComplete(pin)}
                            hasError={hasError}
                            onErrorAnimationComplete={
                                handleErrorAnimationComplete
                            }
                        />
                    )}
                </PWView>
            )}
            <PWLoadingOverlay
                isVisible={isDuressWipeInProgress}
                title={t('security.pin.logging_in')}
            />
        </>
    )
}
