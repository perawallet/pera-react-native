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

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useRef,
    PropsWithChildren,
} from 'react'
import { AppState, AppStateStatus, Modal, StyleSheet, View } from 'react-native'
import { useAppLock } from '@perawallet/wallet-core-security'
import { PinLockScreen } from '@modules/security/screens/PinLockScreen'
import { useDeleteAllData } from '@modules/settings/hooks/useDeleteAllData'

type AppLockContextType = {
    isLocked: boolean
    unlock: () => void
    lock: () => void
}

const AppLockContext = createContext<AppLockContextType>({
    isLocked: false,
    unlock: () => { },
    lock: () => { },
})

export const useAppLockContext = () => useContext(AppLockContext)

export const AppLockProvider = ({ children }: PropsWithChildren) => {
    const {
        isPinEnabled,
        recordBackground,
        recordForeground,
    } = useAppLock()
    const deleteAllData = useDeleteAllData()

    const [isLocked, setIsLocked] = useState(false)
    const appState = useRef(AppState.currentState)
    const hasInitialized = useRef(false)

    useEffect(() => {
        if (!hasInitialized.current && isPinEnabled) {
            setIsLocked(true)
            hasInitialized.current = true
        }
    }, [isPinEnabled])

    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (
                appState.current === 'active' &&
                nextAppState.match(/inactive|background/)
            ) {
                recordBackground()
            } else if (
                appState.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                if (isPinEnabled && recordForeground()) {
                    setIsLocked(true)
                }
            }

            appState.current = nextAppState
        }

        const subscription = AppState.addEventListener(
            'change',
            handleAppStateChange,
        )

        return () => {
            subscription.remove()
        }
    }, [isPinEnabled, recordBackground, recordForeground])

    const unlock = useCallback(() => {
        setIsLocked(false)
    }, [])

    const lock = useCallback(() => {
        if (isPinEnabled) {
            setIsLocked(true)
        }
    }, [isPinEnabled])

    const handleResetData = useCallback(async () => {
        await deleteAllData()
        setIsLocked(false)
    }, [deleteAllData])

    return (
        <AppLockContext.Provider value={{ isLocked, unlock, lock }}>
            {children}
            <Modal
                visible={isLocked && isPinEnabled}
                animationType='fade'
                transparent={false}
                statusBarTranslucent
            >
                <View style={styles.lockContainer}>
                    <PinLockScreen
                        onUnlock={unlock}
                        onResetData={handleResetData}
                    />
                </View>
            </Modal>
        </AppLockContext.Provider>
    )
}

const styles = StyleSheet.create({
    lockContainer: {
        flex: 1,
    },
})
