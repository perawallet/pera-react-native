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

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    type ReactElement,
    type RefObject,
} from 'react'
import { type View } from 'react-native'
import {
    useIsFocused,
    useNavigation,
} from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { PWIcon, PWText, PWView } from '@components/core'
import { AccountDisplay } from '@components/AccountDisplay'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { useSendScope } from '@modules/transactions/hooks'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { UserPreferences } from '@constants/user-preferences'
import { SHORT_PROMPT_DISPLAY_DELAY } from '@constants/ui'
import { AddNoteContent } from '@modules/transactions/components/send-funds/AddNoteContent'
import { SendFundsInfoContent } from '@modules/transactions/components/send-funds/SendFundsInfoContent'
import type { SendFundsStackParamList } from '@modules/transactions/routes/send-funds/types'
import { useAmountKeyboardInput } from './useAmountKeyboardInput'
import type { useInputScreen } from './useInputScreen'
import { useStyles } from './styles'

export type UseInputScreenActionsProps = Pick<
    ReturnType<typeof useInputScreen>,
    | 'asset'
    | 'accountAssetBalance'
    | 'isBalanceReady'
    | 'cryptoValue'
    | 'isResolvingDestination'
    | 'handleKey'
    | 'handlePaste'
    | 'handleNext'
> & {
    canSelectAsset?: boolean
    onFinished?: () => void
}

export type UseInputScreenActionsResult = {
    openNote: () => void
    openInfo: () => void
    handleBack: () => void
    headerLeft: ReactElement
    headerRight: ReactElement
    headerTitle: ReactElement
    amountRef: RefObject<Nullable<View>>
}

export const useInputScreenActions = ({
    asset,
    accountAssetBalance,
    isBalanceReady,
    cryptoValue,
    isResolvingDestination,
    handleKey,
    handlePaste,
    handleNext,
    canSelectAsset,
    onFinished,
}: UseInputScreenActionsProps): UseInputScreenActionsResult => {
    const styles = useStyles()
    const navigation =
        useNavigation<StackNavigationProp<SendFundsStackParamList>>()
    const selectedAccount = useSelectedAccount()
    const scope = useSendScope()
    const { t } = useLanguage()
    const { request: requestBottomSheet } = useBottomSheet()
    const isFocused = useIsFocused()

    const openNote = useCallback(() => {
        void requestBottomSheet({
            contents: <AddNoteContent />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet])

    const openInfo = useCallback(() => {
        void requestBottomSheet({
            contents: <SendFundsInfoContent />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet])

    const { getPreference } = usePreferences()
    const hasAgreed = getPreference(UserPreferences.transactionInfoAgreed)
    const hasAutoOpenedRef = useRef(false)
    useEffect(() => {
        if (hasAgreed || hasAutoOpenedRef.current) return
        hasAutoOpenedRef.current = true
        const timer = setTimeout(() => {
            openInfo()
        }, SHORT_PROMPT_DISPLAY_DELAY)
        return () => clearTimeout(timer)
    }, [hasAgreed, openInfo])

    const handleBack = useCallback(() => {
        if (canSelectAsset) {
            navigation.navigate('AssetSelection')
        } else {
            onFinished?.()
        }
    }, [canSelectAsset, navigation, onFinished])

    // Memoize the header nodes so their identities stay stable across renders.
    // useNavigationHeader lists them as effect deps and calls setOptions; passing
    // fresh JSX every render re-fires the effect → setOptions → re-render loop
    // ("Maximum update depth exceeded" on the async-loading ASA path).
    const headerLeft = useMemo(
        () => (
            <PWIcon
                name={canSelectAsset ? 'chevron-left' : 'cross'}
                onPress={handleBack}
            />
        ),
        [canSelectAsset, handleBack],
    )
    const headerRight = useMemo(
        () => (
            <PWIcon
                name='info'
                onPress={openInfo}
            />
        ),
        [openInfo],
    )
    const headerTitle = useMemo(
        () => (
            <PWView style={styles.headerTitleContainer}>
                <PWText>
                    {t('send_funds.input_view.title', {
                        asset: asset?.name,
                    })}
                </PWText>
                <AccountDisplay
                    account={selectedAccount ?? undefined}
                    chainId={scope.chainId}
                    style={styles.accountDisplay}
                    iconProps={{ size: 'sm' }}
                    showChevron={false}
                    compact
                />
            </PWView>
        ),
        [styles, t, asset?.name, selectedAccount, scope.chainId],
    )

    const amountRef = useRef<View>(null)
    useAmountKeyboardInput({
        onKey: handleKey,
        onPaste: handlePaste,
        onSubmit: () => {
            if (cryptoValue) void handleNext()
        },
        amountRef,
        isActive:
            isFocused &&
            !!asset &&
            !!accountAssetBalance &&
            isBalanceReady &&
            !isResolvingDestination,
    })

    return {
        openNote,
        openInfo,
        handleBack,
        headerLeft,
        headerRight,
        headerTitle,
        amountRef,
    }
}
