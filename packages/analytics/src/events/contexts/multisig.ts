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

/**
 * Multisig (joint account) creation, invite and pending-transaction flows.
 * Account-detail menu items for joint accounts live in `AccountDetailsEvent`.
 */
export enum MultisigEvent {
    WelcomePressed = 'onb_jointAccount_welcome_press', // Continued from joint-account welcome
    AddAccount = 'onb_jointAccount_addAccount_press', // Tapped add account
    EditAccount = 'onb_jointAccount_editAccount_press', // Tapped edit account
    RemoveAddress = 'onb_jointAccount_removeAddress_press', // Removed an address
    AddAccountContinue = 'onb_jointAccount_addAcc_continue_press', // Continued after adding accounts
    AddAccountContinueFromInbox = 'inbox_jointAccount_nameAccount_press', // Continued to name account (from inbox)
    ThresholdContinue = 'onb_jointAccount_thresholdContinue_press', // Continued after setting the threshold
    NameAccount = 'onb_jointAccount_nameAccount_press', // Named the joint account
    InfoScreenProceed = 'onb_jointAccount_infoScr_proceed_press', // Proceeded from the info screen
    InfoScreenGoBack = 'onb_jointAccount_infoScreen_goBack_press', // Went back from the info screen
    CancelTransaction = 'jointAccount_cancelTx_press', // Cancelled a joint-account transaction
    ConfirmTransaction = 'jointAccount_confirmTx_slide', // Slid to confirm a joint-account transaction
    DeclinePendingTransaction = 'jointAccount_declinePendingTx_press', // Declined a pending transaction
    CloseForNow = 'jointAccount_closeForNow_press', // Tapped "close for now"
    InvitePressed = 'inbox_jointAccount_invite_press', // Opened a joint-account invite (from inbox)
    InviteIgnorePressed = 'inbox_jointAccount_invite_ignore_press', // Ignored an invite
    InviteAddPressed = 'inbox_jointAccount_invite_add_press', // Accepted/added from an invite
    ShowPendingTransaction = 'inbox_jointAccount_pendingTx_press', // Opened a pending transaction (from inbox)
    ClosePendingTransaction = 'inbox_jointAccount_pendingTx_close_press', // Closed a pending transaction
}
