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

import type { AnalyticsMetadataKey as Key } from '../metadata-keys'

/**
 * Pera Card (Baanx) flows. Raw values come verbatim from the design team's
 * analytics spec (Figma "Analytics" section), including the mixed `card_`/`cards_`
 * prefixes and casing — do not normalize, dashboards key on these exact strings.
 */
export enum CardEvent {
    OnboardingCreate = 'card_onboarding_create', // Tapped "Create a Baanx Account" on the intro screen
    OnboardingRecover = 'card_onboarding_recover', // Tapped "I already have an account" on the intro screen
    RecoverSignIn = 'card_onboarding_recover_signin', // Submitted the sign-in form
    RecoverForgotPassword = 'card_onboarding_recover_forgotpass', // Tapped "Forgot Password?" (flow not live yet)
    CreateCountrySelect = 'card_onboarding_create_countrySelect', // Picked a country on the account form (country id)
    CreateConfirmEmail = 'card_onboarding_create_confirmEmail', // Submitted the account/email form
    CreateEmailVerification = 'card_onboarding_create_emailVerification', // Submitted the email verification code
    CreateEmailVerifySendAgain = 'card_onboarding_create_emailVerify_sendAgain', // Requested a new email verification code
    CreatePassword = 'card_onboarding_create_createPassword', // Submitted the password form
    CreateSubmitDocs = 'card_onboarding_create_submitDocs', // Started identity verification (opens Veriff)
    CreateLogout = 'card_onboarding_create_logout', // Logged out during onboarding
    CreateVerifyAccountContinue = 'card_onboarding_create_verifyAccount_continue', // Submitted personal details
    CreateVerifyAccountContinue2 = 'card_onboarding_create_verifyAccount_continue2', // Submitted residential address
    CreateConnectWallet = 'card_onboarding_create_connectWallet', // Tapped connect account on the status checklist
    CreateVerifyAccount = 'card_onboarding_create_verifyAccount', // Tapped verify identity on the status checklist
    CreateVerifyAccountSelect = 'card_onboarding_create_verifyAccount_select', // Picked a funding account in the account sheet
    CreateCard = 'card_onboarding_create_createCard', // Tapped "Create Pera Card" on the status checklist
    CreateCardAutoFunding = 'card_onboarding_create_createCard_autoFunding', // Chose auto funding on the status checklist
    CreateCardManualFunding = 'card_onboarding_create_createCard_manualFunding', // Chose manual funding on the status checklist
    CreateCardChangeAccount = 'card_onboarding_create_createCard_changeAccount', // Tapped change account on the status checklist
    CreateArbTxProceed = 'card_onboarding_create_arbtxProceed', // Proceeded on the ownership-signing step
    CreateArbTxConfirm = 'card_onboarding_create_arbtxProceed_confirm', // Approved the card ARC-60 signing request
    CreateArbTxClose = 'card_onboarding_create_arbtxProceed_close', // Rejected/dismissed the card ARC-60 signing request
    CreateFinalizeTxProceed = 'card_onboarding_create_finalizeCardTxProceed', // Proceeded on the authorize (auto-funding) step
    CreateFinalizeTxConfirm = 'card_onboarding_create_finalizeCardTxProceed_confirm', // Approved the auto-funding authorization
    CreateFinalizeTxCancel = 'card_onboarding_create_finalizeCardTxProceed_cancel', // Rejected auto-funding (falls back to manual)
    HomeOverviewTab = 'card_home_overview', // Switched to the Overview tab on the dashboard
    HomeCardDetailsTab = 'card_home_cardDetails', // Switched to the Card Details tab on the dashboard
    HomeAddFunds = 'card_home_addFunds', // Tapped Add Funds on the dashboard
    HomeWithdraw = 'card_home_withdraw', // Tapped Withdraw on the dashboard
    HomeGetUsdc = 'card_home_getUSDC', // Tapped Get USDC on the dashboard (feature not live yet)
    HomeShowAll = 'card_home_showAll', // Tapped show-all on the dashboard transactions list
    HomeFundingType = 'card_home_fundingType', // Tapped the funding-type switch
    DetailsRevealCard = 'cards_cardDetails_revealCard', // Revealed the card details
    DetailsChangeAccount = 'cards_cardDetails_changeAccount', // Tapped connect/change funding account
    DetailsSetPin = 'cards_cardDetails_setPin', // Tapped Set PIN
    DetailsAddToApple = 'cards_cardDetails_addtoApple', // Tapped Add to Apple Wallet
    DetailsAddToGoogle = 'cards_cardDetails_addtoGoogle', // Tapped Add to Google Wallet
    DetailsFreeze = 'cards_cardDetails_freeze', // Opened the freeze-card sheet
    DetailsReportLostCard = 'cards_cardDetails_reportLostCard', // Opened report lost/stolen card
    DetailsReportSusCard = 'cards_cardDetails_reportSusCard', // Started the report-suspicious-activity flow
    AddFundsCurrency = 'card_addFunds_currency', // Picked the asset to fund with (asset id)
    AddFundsDeposit = 'card_addFunds_deposit', // Tapped Deposit on Add Funds
    AddFundsConfirm = 'card_addFunds_confirm', // Confirmed the funding swap
    SelectFundingAuto = 'cards_selectFunding_auto', // Chose auto funding in the select-funding sheet
    SelectFundingManual = 'cards_selectFunding_manual', // Chose manual funding in the select-funding sheet
    SelectFundingApply = 'cards_selectFunding_apply', // Applied the funding-type selection
    TransactionsSelect = 'cards_transactions_select', // Tapped a row in the transactions list
    TransactionsTransactionTab = 'cards_transactions_transaction', // Switched to the Transaction tab on transaction detail
    TransactionsMerchantTab = 'cards_transactions_merchant', // Switched to the Merchant tab on transaction detail
    TransactionsCopyTx = 'cards_transactions_copyTx', // Copied the transaction hash
    TransactionsViewExplorer = 'cards_transactions_viewExplorer', // Opened the transaction in the explorer
    TransactionsReportTx = 'cards_transactions_reportTx', // Tapped Report Transaction on transaction detail
    FreezeCard = 'cards_freeze_freezeCard', // Confirmed freezing the card
    FreezeClose = 'cards_freezecard_close', // Dismissed the freeze sheet
    FreezeReactivate = 'cards_freezeCard_reactivate', // Tapped Reactivate on the frozen-card banner
    LostCardFileReport = 'cards_lostCard_fileReport', // Confirmed the lost/stolen report
    LostCardClose = 'cards_lostCard_close', // Dismissed the lost/stolen sheet
    ReportSusClose = 'cards_reportSus_close', // Dismissed the report-suspicious sheet
    ReportSusCancel = 'cards_reportSus_cancel', // Dismissed the "Before we continue" sheet
    ReportSusFileReport = 'cards_reportSus_fileReport', // Confirmed "Before we continue"
    ReportSusReportTx = 'cards_reportSus_reportTx', // Toggled a transaction in the report-transactions sheet
    ReportSusCreateTicket = 'cards_reportSus_createTicket', // Submitted the suspicious-transactions report
}

export interface CardRequiredPayloads {
    [CardEvent.CreateCountrySelect]: {
        [Key.CountryId]: string
    }
    [CardEvent.AddFundsCurrency]: {
        [Key.AssetId]: string
    }
}
