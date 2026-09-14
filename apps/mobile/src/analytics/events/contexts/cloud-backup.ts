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

/**
 * Cloud backup onboarding, setup, restore and overview actions. Keys differ
 * from the analytics spec where its key is misspelled or longer than 38
 * characters: Firebase rejects names past 40, and testnet adds a `t_` prefix.
 */
export enum CloudBackupEvent {
    IntroContinue = 'backupscr_onboarding_continue', // Dismissed the first-time intro prompt
    SetUpNew = 'backupscr_cloud_new', // Chose to set up a new backup
    Restore = 'backupscr_cloud_restore', // Chose to restore an existing backup
    SetupProceed = 'backupscr_setup_proceed', // Proceeded past the generated credentials
    VerifyProceed = 'backupscr_verify_proceed', // Submitted the passphrase quiz
    ConfirmCopyKey = 'backupscr_encryptedKey_copy', // Copied the encryption key on the confirm sheet
    ConfirmShowCredentials = 'backupscr_encryptedKey_showCredentials', // Went back to see the credentials again
    ConfirmStoredCheck = 'backupscr_encryptedKey_yesCheck', // Ticked "I stored my encryption key"
    ConfirmEnable = 'backupscr_encryptedKey_backup', // Enabled the backup from the confirm sheet
    RestoreScanQr = 'backupscr_recoverBackup_scanQR', // Picked QR scan on the restore options sheet
    RestoreEnterManually = 'backupscr_recoverBackup_enterManually', // Picked manual entry on the restore options sheet
    RestorePassphraseProceed = 'backupscr_recoverBackup_verify_proceed', // Continued past the entered passphrase
    RestoreEncryptionKeyProceed = 'backupscr_recoverBackup_encKey_proceed', // Started the restore with the entered key
    OverviewAccounts = 'backupscr_cloudBackup_accounts_edit', // Opened backed-up accounts
    OverviewContacts = 'backupscr_cloudBackup_contacts_edit', // Opened backed-up contacts
    OverviewCredentialAddress = 'backupscr_cloudBackup_credAddress', // Opened the backup credentials
    OverviewSyncDevices = 'backupscr_cloudBackup_sync', // Started sync with other devices
    OverviewTurnOff = 'backupscr_cloudBackup_disable', // Opened the turn-off sheet
    TurnOffKeep = 'backupscr_cloudBackup_disable_keep', // Kept the backup enabled
    TurnOffDisable = 'backupscr_cloudBackup_disable_disable', // Turned the backup off
    TurnOffRemove = 'backupscr_cloudBackup_disable_remove', // Turned the backup off and removed it
    AccountsReview = 'backupscr_accounts_review', // Opened the accounts review
    AccountsBackUp = 'backupscr_accounts_backup', // Backed up an account from the device list
    ReviewAddFromBackupToggle = 'backupscr_accounts_review_fromBackup', // Toggled the add-from-backup accordion
    ReviewAdd = 'backupscr_accounts_review_add', // Added an account from the backup
    ReviewDelete = 'backupscr_accounts_review_delete', // Asked to delete an account from the backup
    ReviewDeleteConfirm = 'backupscr_accounts_review_delete_yes', // Confirmed that delete
    ReviewDeleteCancel = 'backupscr_accounts_review_delete_no', // Cancelled that delete
    ReviewBackUp = 'backupscr_accounts_review_backup', // Backed up a not-backed-up account
    CredentialsCopyPassphrase = 'backupscr_credentials_copyPassphrase', // Copied the passphrase from the credentials sheet
    CredentialsCopyKey = 'backupscr_credentials_copyKey', // Copied the encryption key from the credentials sheet
    CredentialsStore = 'backupscr_credentials_store', // Tapped "Store your Credentials Securely"
}
