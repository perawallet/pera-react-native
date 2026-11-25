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

import React, { type PropsWithChildren, type ReactNode } from 'react'
import { useAutoLockListener } from './useAutoLockListener'
import { useStyles } from './styles'
import { PWButton, PWLoadingOverlay, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { PinEntry } from '../PinEntry'
import { useLanguage } from '@hooks/useLanguage'
import { LockOverlayProvider } from '@hooks/useIsLockOverlayVisible'
import { AppLockedProvider } from '@hooks/useIsAppLocked'
import { LockoutView } from './LockoutView'
import { useLockScreen } from './useLockScreen'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FullScreenLoadingView } from '@components/FullScreenLoadingView'

type AutoLockGuardProps = PropsWithChildren<{ afterInitialization?: ReactNode }>

export const AutoLockGuard = ({
    children,
    afterInitialization,
}: AutoLockGuardProps) => {
    const {
        isLocked,
        isInitialized,
        isChecking,
        isWipeRecoveryRequired,
        unlock,
        handleResetData,
        retryWipeRecovery,
    } = useAutoLockListener()
    const {
        hasError,
        isLockedOut,
        remainingSeconds,
        isPinUnlockInProgress,
        isBiometricUnlockInProgress,
        handlePinComplete,
        handleErrorAnimationComplete,
    } = useLockScreen({ onUnlock: unlock, isLocked })
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { t } = useLanguage()

    const showLoadingOverlay = isChecking
    const showRecoveryOverlay = isWipeRecoveryRequired && !isChecking
    const showLockOverlay = isLocked && !isChecking && !showRecoveryOverlay
    const isGuardActive =
        showLoadingOverlay || showLockOverlay || showRecoveryOverlay

    return (
        <>
            {isInitialized && !isWipeRecoveryRequired && afterInitialization}
            <PWView
                // Both props toggled below (opacity, pointerEvents) are in
                // Fabric's formsStackingContext set, so without this the guard
                // flip flattens/unflattens this node — Fabric creates the view
                // and reparents the whole app subtree mid-commit. Colliding with
                // the migration splash → home swap, that drops an insert and
                // crashes with `addViewAt ... index=3 count=2`.
                collapsable={false}
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
                    <AppLockedProvider value={isLocked}>
                        {children}
                    </AppLockedProvider>
                </LockOverlayProvider>
            </PWView>
            {showLoadingOverlay && (
                <PWView style={styles.loadingOverlay}>
                    <FullScreenLoadingView />
                </PWView>
            )}
            {showRecoveryOverlay && (
                <PWView style={[styles.lockOverlay, styles.recoveryContent]}>
                    <EmptyView
                        title={t('common.error.title')}
                        body={t('common.error.body')}
                    />
                    <PWButton
                        title={t('common.retry.label')}
                        variant='primary'
                        onPress={retryWipeRecovery}
                    />
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
            {/* A passed fingerprint or a submitted PIN can still take seconds to
                unlock on a slow keystore; the PIN pad must not look like it is
                waiting for input. */}
            <PWLoadingOverlay
                isVisible={isPinUnlockInProgress || isBiometricUnlockInProgress}
                title={t('security.pin.logging_in')}
            />
        </>
    )
}
