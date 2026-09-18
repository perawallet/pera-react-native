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

import { PWScrollView } from '@components/core'
import { CardFrozenBanner } from '../CardFrozenBanner'
import { PeraCardBalanceSection } from './PeraCardBalanceSection'
import { PeraCardActionButtons } from './PeraCardActionButtons'
import { PeraCardPendingWithdrawal } from './PeraCardPendingWithdrawal'
import { PeraCardCreditsSection } from './PeraCardCreditsSection'
import { PeraCardTransactionsSection } from './PeraCardTransactionsSection'
import { usePeraCardOverview } from './usePeraCardOverview'
import { useStyles } from './styles'

export const PeraCardOverview = () => {
    const styles = useStyles()
    const {
        isAutoFunding,
        currency,
        balance,
        spendablePerTx,
        isSpendableCapped,
        isBalanceLoading,
        credits,
        transactionSections,
        isLoadingTransactions,
        pendingWithdrawal,
        onWithdraw,
        onCompleteWithdrawal,
        onCancelWithdrawal,
        onAddFunds,
        onFundLinkedAccount,
        onShowAllTransactions,
        onPressTransaction,
        onCreditPress,
    } = usePeraCardOverview()

    return (
        <PWScrollView contentContainerStyle={styles.content}>
            <CardFrozenBanner />

            <PeraCardBalanceSection
                balance={balance}
                isLoading={isBalanceLoading}
                currency={currency}
                spendablePerTx={spendablePerTx}
                isCapped={isSpendableCapped}
            />

            {pendingWithdrawal && (
                <PeraCardPendingWithdrawal
                    amount={pendingWithdrawal.amount}
                    currency={currency}
                    secondsUntilReady={pendingWithdrawal.secondsUntilReady}
                    isReady={pendingWithdrawal.isReady}
                    isCompleting={pendingWithdrawal.isCompleting}
                    isCancelling={pendingWithdrawal.isCancelling}
                    onComplete={onCompleteWithdrawal}
                    onCancel={onCancelWithdrawal}
                />
            )}

            <PeraCardActionButtons
                isAutoFunding={isAutoFunding}
                isWithdrawDisabled={pendingWithdrawal !== null}
                onWithdraw={onWithdraw}
                onAddFunds={onAddFunds}
                onFundLinkedAccount={onFundLinkedAccount}
            />

            <PeraCardCreditsSection
                credits={credits}
                currency={currency}
                onCreditPress={onCreditPress}
            />

            <PeraCardTransactionsSection
                sections={transactionSections}
                isLoading={isLoadingTransactions}
                onShowAll={onShowAllTransactions}
                onPressTransaction={onPressTransaction}
            />
        </PWScrollView>
    )
}
