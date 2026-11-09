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
    findAccountByAddressOn,
    useAccountChainOptionsResolver,
    useAllAccounts,
    useCanSignWithCheck,
    useSelectedAccountId,
} from '@perawallet/wallet-core-accounts'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { isChainId } from '@perawallet/wallet-core-chain-contract'
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

const isScope = (value: unknown): boolean => {
    const scope = value as Nullable<Partial<Record<string, unknown>>>
    return !!scope && isChainId(scope.chainId) && isString(scope.networkId)
}

// A cross-chain record that lost this must not pass as a same-chain one: its
// output id would be read on the source chain.
const isReceiveTargetValid = (value: unknown): boolean => {
    if (value === undefined) return true
    const receive = value as Nullable<Partial<Record<string, unknown>>>
    return (
        !!receive && isScope(receive.scope) && isString(receive.accountAddress)
    )
}

// The record comes back from storage, so it is checked rather than trusted.
const toFreshIntent = (value: unknown, now: number): Nullable<StoredIntent> => {
    const record = value as Nullable<Partial<Record<string, unknown>>>
    if (!record || typeof record.createdAt !== 'number') return null
    if (now - record.createdAt > TAB_RESUME_MAX_AGE_MS) return null
    if (!isString(record.accountAddress) || !isChainId(record.chainId)) {
        return null
    }
    if (
        record.flow === 'swap' &&
        isString(record.assetInId) &&
        isString(record.assetOutId) &&
        isString(record.payAmount) &&
        isReceiveTargetValid(record.receive)
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
    const { setSelectedAccountId } = useSelectedAccountId()
    const openSendFunds = useSendFundsDeeplink()
    const canSwap = useCapability({ platform: 'swapTab', anyChain: 'swap' })
    const swapChainOptionsOf = useAccountChainOptionsResolver('swap', {
        isSignerRequired: true,
    })
    const canSignOn = useCanSignWithCheck()

    return useCallback(() => {
        void (async () => {
            let intent: Nullable<StoredIntent>
            try {
                intent = toFreshIntent(await takeTabResumeIntent(), Date.now())
            } catch (error) {
                logger.warn('Could not read the flow to resume in this tab', {
                    error,
                })
                return
            }
            if (!intent) return
            const account = findAccountByAddressOn(
                accounts,
                intent.chainId,
                intent.accountAddress,
            )
            if (!account) return
            const receive = intent.flow === 'swap' ? intent.receive : undefined
            const receivingAccount =
                receive &&
                findAccountByAddressOn(
                    accounts,
                    receive.scope.chainId,
                    receive.accountAddress,
                )
            // Reopening with another receiver would pay an account other than
            // the one the user confirmed.
            if (
                receive &&
                (!receivingAccount ||
                    !canSignOn(receivingAccount, receive.scope.chainId))
            ) {
                return
            }
            // The Swap tab isn't registered while the capability is off, and
            // the intent's asset ids mean nothing on any chain but its own.
            const { chainId } = intent
            if (
                intent.flow === 'swap' &&
                (!canSwap ||
                    !swapChainOptionsOf(account)
                        .filter(option => option.isEnabled)
                        .map(option => option.chainId)
                        .includes(chainId))
            ) {
                return
            }
            // Before the screen mounts: Swap resets its form when the account
            // changes, and Send signs with the selected account.
            setSelectedAccountId(account.id)

            if (intent.flow === 'swap') {
                navigate('TabBar', {
                    screen: 'Swap',
                    params: {
                        assetIn: { chainId, assetId: intent.assetInId },
                        ...(receive && receivingAccount
                            ? {
                                  receive: {
                                      scope: receive.scope,
                                      assetId: intent.assetOutId,
                                      accountId: receivingAccount.id,
                                  },
                              }
                            : {
                                  assetOut: {
                                      chainId,
                                      assetId: intent.assetOutId,
                                  },
                              }),
                        payAmount: intent.payAmount,
                    },
                })
                return
            }
            // The intent's account is looked up on the chain the flow ran on.
            openSendFunds({
                asset: { chainId, assetId: intent.assetId },
                destination: intent.destination,
                amount: new Decimal(intent.amount),
                note: intent.note,
                shouldContinueToConfirm: true,
            })
        })()
    }, [
        accounts,
        setSelectedAccountId,
        navigate,
        openSendFunds,
        canSwap,
        swapChainOptionsOf,
        canSignOn,
    ])
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
                const result = value as Nullable<
                    Partial<Record<'title' | 'body' | 'createdAt', unknown>>
                >
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
