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

import { AnalyticsMetadataKey as Key } from '../metadata-keys'

/** Onboarding and account lifecycle (create / import / register / rekey). */
export enum OnboardingEvent {
    CreateNewWallet = 'new_onb_welcome_create_wallet', // Chose "create new wallet" on welcome
    ImportAccount = 'new_onb_welcome_import_wallet', // Chose "import wallet" on welcome
    NameAccount = 'new_onb_welcome_name_wallet', // Named the wallet during onboarding
    CreateAccountNew = 'onb_createacc_recover', // Chose "new account" on the create-account screen
    RecoverAlgo25 = 'onb_createacc_recover_25', // Chose recover with a 25-word (Algo25) passphrase
    RecoverOneKey = 'onb_createacc_recover_24', // Chose recover with a 24-word (OneKey) passphrase
    CreateAccountSkip = 'onb_createacc_skip', // Skipped account creation
    CreateAccountWatch = 'onb_createacc_watch', // Chose to add a watch account
    WatchAccountComplete = 'onb_welcome_watch_complete', // Completed adding a watch account (create/welcome flow)
    BeginPassphrase = 'onb_createacc_pass_begin', // Began the passphrase flow
    CopyPassphrase = 'onb_createacc_pass_copy', // Copied the passphrase
    UnderstandPassphrase = 'onb_createacc_pass_understand', // Acknowledged understanding the passphrase
    VerifyPassphrase = 'onb_createacc_pass_verify', // Started passphrase verification
    VerifyPassphraseComplete = 'onb_pass_verified_complete', // Completed passphrase verification
    SkipCreatePassphrase = 'onb_create_pass_skip_tap', // Skipped creating the passphrase
    SkipWritePassphrase = 'onb_write_pass_skip_tap', // Skipped writing down the passphrase
    SkipRecoverPassphrase = 'onb_rev_pass_skip_tap', // Skipped reviewing the passphrase
    VerifiedSetPinCode = 'onb_verified_setpincode', // Set the PIN code (after verification)
    VerifiedSetPinCodeCompleted = 'onb_verified_setpincode_completed', // Completed setting the PIN
    WatchAccountCreateComplete = 'onb_name_wallet_complete', // Completed watch-account creation (wallet named)
    WatchAccountCreateVerified = 'onb_watchacc_create_verified', // Watch-account creation verified
    WelcomeAccountCreate = 'onb_welcome_account_create', // Chose Create on the welcome screen
    WelcomeAccountRecover = 'onb_welcome_account_recover', // Chose Recover on the welcome screen
    RegisterAccount = 'register', // Registered an account (type: create/ledger/recover/rekeyed/watch)
    RekeyAccount = 'rekey', // Rekeyed an account
}

/** Account registration type sent with {@link OnboardingEvent.RegisterAccount}. */
export type RegistrationType =
    | 'create'
    | 'ledger'
    | 'recover'
    | 'rekeyed'
    | 'watch'

export interface OnboardingRequiredPayloads {
    [OnboardingEvent.RegisterAccount]: {
        [Key.AccountCreationType]: RegistrationType
    }
}
