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

import { useCallback, useEffect } from 'react'
import { Decimal } from 'decimal.js'
import {
    takeTabResumeIntent,
    takeTabResumeResult,
} from '@perawallet/wallet-core-browser-runtime'
import { getSurface } from '@perawallet/wallet-extension-platform-chrome'
import {
    useAllAccounts,
    useSelectedAccountAddress,
} from '@perawallet/wallet-core-accounts'
import { logger } from '@perawallet/wallet-core-shared'
import { useSendFundsDeeplink } from '@modules/deeplink'
import { useCapability } from '@hooks/useCapability'
import { useToast } from '@hooks/useToast'
import type { TabResumeIntent } from '@utils/tabResumeIntent'

// Long enough to read the error and tap "Open in Tab"; short enough that a
// tab opened much later doesn't resurrect an old payment.
export const TAB_RESUME_MAX_AGE_MS = 5 * 60 * 1000

// The popup reopens right after the tab closes; anything older is from a popup
// the browser failed to open, and a toast for it later would be confusing.
export const TAB_RESUME_RESULT_MAX_AGE_MS = 60 * 1000

type StoredIntent = TabResumeIntent & { createdAt: number }

const isString = (value: unknown): value is string =>
    typeof value === 'string' && value.length > 0

// The record comes back from storage, so it is checked rather than trusted.
const toFreshIntent = (value: unknown, now: number): StoredIntent | null => {
    const record = value as Partial<Record<string, unknown>> | null
    if (!record || typeof record.createdAt !== 'number') return null
    if (now - record.createdAt > TAB_RESUME_MAX_AGE_MS) return null
    if (!isString(record.accountAddress)) return null
    if (
        record.flow === 'swap' &&
        isString(record.assetInId) &&
        isString(record.assetOutId) &&
        isString(record.payAmount)
    ) {
        return record as StoredIntent
    }
    if (
        record.flow === 'send' &&
        isString(record.assetId) &&
        isString(record.destination) &&
        isString(record.amount)
    ) {
        return record as StoredIntent
    }
    return null
}

/**
 * Reopens, in this tab, the Swap or Send the toolbar popup handed over
 * (`?flow=resume`), back on the confirmation step the user had reached.
 */
export const useTabResume = (
    navigate: (screen: 'TabBar', params?: object) => void,
): (() => void) => {
    const accounts = useAllAccounts()
    const { setSelectedAccountAddress } = useSelectedAccountAddress()
    const openSendFunds = useSendFundsDeeplink()
    const canSwap = useCapability({ platform: 'swapTab', anyChain: 'swap' })

    return useCallback(() => {
        void (async () => {
            let intent: StoredIntent | null
            try {
                intent = toFreshIntent(await takeTabResumeIntent(), Date.now())
            } catch (error) {
                logger.warn('Could not read the flow to resume in this tab', {
                    error,
                })
                return
            }
            if (!intent) return
            const { accountAddress } = intent
            if (!accounts.some(account => account.address === accountAddress)) {
                return
            }
            // The Swap tab isn't registered while the capability is off.
            if (intent.flow === 'swap' && !canSwap) return
            // Before the screen mounts: Swap resets its form when the account
            // changes, and Send signs with the selected account.
            setSelectedAccountAddress(accountAddress)

            if (intent.flow === 'swap') {
                navigate('TabBar', {
                    screen: 'Swap',
                    params: {
                        assetInId: intent.assetInId,
                        assetOutId: intent.assetOutId,
                        payAmount: intent.payAmount,
                    },
                })
                return
            }
            openSendFunds({
                assetId: intent.assetId,
                destination: intent.destination,
                amount: new Decimal(intent.amount),
                note: intent.note,
                shouldContinueToConfirm: true,
            })
        })()
    }, [accounts, setSelectedAccountAddress, navigate, openSendFunds, canSwap])
}

/**
 * In the toolbar popup the service worker reopened after a resumed flow's tab
 * closed, shows that flow's success toast, so finishing in the tab doesn't
 * end with no confirmation.
 */
export const useTabResumeResultToast = (): void => {
    const { successToast } = useToast()

    useEffect(() => {
        if (getSurface() !== 'popup') return
        void takeTabResumeResult()
            .then(value => {
                const result = value as Partial<
                    Record<'title' | 'body' | 'createdAt', unknown>
                > | null
                if (
                    !result ||
                    typeof result.title !== 'string' ||
                    typeof result.body !== 'string' ||
                    typeof result.createdAt !== 'number' ||
                    Date.now() - result.createdAt > TAB_RESUME_RESULT_MAX_AGE_MS
                ) {
                    return
                }
                successToast(result.title, result.body)
            })
            .catch(() => undefined)
    }, [successToast])
}
