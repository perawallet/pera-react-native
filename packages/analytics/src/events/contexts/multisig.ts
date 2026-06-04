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
    WelcomePressed = 'onb_jointAccount_welcome_press',
    AddAccount = 'onb_jointAccount_addAccount_press',
    EditAccount = 'onb_jointAccount_editAccount_press',
    RemoveAddress = 'onb_jointAccount_removeAddress_press',
    AddAccountContinue = 'onb_jointAccount_addAcc_continue_press',
    AddAccountContinueFromInbox = 'inbox_jointAccount_nameAccount_press',
    ThresholdContinue = 'onb_jointAccount_thresholdContinue_press',
    NameAccount = 'onb_jointAccount_nameAccount_press',
    InfoScreenProceed = 'onb_jointAccount_infoScr_proceed_press',
    InfoScreenGoBack = 'onb_jointAccount_infoScreen_goBack_press',
    CancelTransaction = 'jointAccount_cancelTx_press',
    ConfirmTransaction = 'jointAccount_confirmTx_slide',
    DeclinePendingTransaction = 'jointAccount_declinePendingTx_press',
    CloseForNow = 'jointAccount_closeForNow_press',
    InvitePressed = 'inbox_jointAccount_invite_press',
    InviteIgnorePressed = 'inbox_jointAccount_invite_ignore_press',
    InviteAddPressed = 'inbox_jointAccount_invite_add_press',
    ShowPendingTransaction = 'inbox_jointAccount_pendingTx_press',
    ClosePendingTransaction = 'inbox_jointAccount_pendingTx_close_press',
}
