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
    CreateNewWallet = 'new_onb_welcome_create_wallet',
    ImportAccount = 'new_onb_welcome_import_wallet',
    NameAccount = 'new_onb_welcome_name_wallet',
    CreateAccountNew = 'onb_createacc_recover',
    RecoverAlgo25 = 'onb_createacc_recover_25',
    RecoverOneKey = 'onb_createacc_recover_24',
    CreateAccountSkip = 'onb_createacc_skip',
    CreateAccountWatch = 'onb_createacc_watch',
    WatchAccountComplete = 'onb_welcome_watch_complete',
    BeginPassphrase = 'onb_createacc_pass_begin',
    CopyPassphrase = 'onb_createacc_pass_copy',
    UnderstandPassphrase = 'onb_createacc_pass_understand',
    VerifyPassphrase = 'onb_createacc_pass_verify',
    VerifyPassphraseComplete = 'onb_pass_verified_complete',
    SkipCreatePassphrase = 'onb_create_pass_skip_tap',
    SkipWritePassphrase = 'onb_write_pass_skip_tap',
    SkipRecoverPassphrase = 'onb_rev_pass_skip_tap',
    VerifiedSetPinCode = 'onb_verified_setpincode',
    VerifiedSetPinCodeCompleted = 'onb_verified_setpincode_completed',
    WatchAccountCreateComplete = 'onb_name_wallet_complete',
    WatchAccountCreateVerified = 'onb_watchacc_create_verified',
    WelcomeAccountCreate = 'onb_welcome_account_create',
    WelcomeAccountRecover = 'onb_welcome_account_recover',
    RegisterAccount = 'register',
    RekeyAccount = 'rekey',
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
