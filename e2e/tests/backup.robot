*** Settings ***
Documentation       Passphrase backup reminder on Android and iOS from one suite. The wizard is reachable
...                 only from the banner, and the banner shows only on a funded account, so every case
...                 past the first recovers a funded wallet from the environment and skips without it.
...                 Each case walks from a fresh device to its own step, so any case runs alone.
Resource            ../resources/backup.resource

Suite Setup         Open Pera
Suite Teardown      Run Keywords    Reset To Fresh Wallet    AND    Close Pera
Test Teardown       Capture Failure Screenshot
Test Timeout        ${E2E_TEST_TIMEOUT}
Test Tags           backup


*** Test Cases ***
Unfunded Wallet Gets No Backup Reminder
    [Tags]    id:backup.banner.absent-unfunded    p2
    Start With Unfunded Wallet
    # The banner reveals 800ms after the account screen loads; absence only counts after that.
    Sleep    1.5s
    Page Should Not Contain Element    ${BACKUP_BANNER_CTA}

Passphrase Screen Shows The Wallet's Whole Phrase
    [Tags]    id:backup.passphrase.matches    p1    needs-funded    excludefromci
    Skip If    not $MNEMONIC_FUNDED    MNEMONIC_24_FUNDED is not set.
    Start With Wallet Needing Backup
    Open Passphrase
    Remember Passphrase
    Passphrase Should Match The Wallet

Next Stays Disabled Until The Quiz Is Answered
    [Tags]    id:backup.verify.next-disabled    p1    needs-funded    excludefromci
    Skip If    not $MNEMONIC_FUNDED    MNEMONIC_24_FUNDED is not set.
    Start With Wallet Needing Backup
    Open Verification Quiz
    Page Should Contain Element    ${QUIZ_ITEM_ANY}
    Expect Element    ${BACKUP_VERIFICATION_NEXT}    disabled    timeout=0s    loglevel=NONE

Answering Every Word Correctly Enables Next
    [Tags]    id:backup.verify.correct-enables-next    p2    integration-covered    needs-funded    excludefromci
    Skip If    not $MNEMONIC_FUNDED    MNEMONIC_24_FUNDED is not set.
    Start With Wallet Needing Backup
    Open Verification Quiz
    Answer Quiz Correctly
    Expect Element    ${BACKUP_VERIFICATION_NEXT}    enabled    timeout=3s    retry_interval=0.5s    loglevel=NONE

Completed Backup Clears The Reminder
    [Tags]    id:backup.complete.clears-banner    p1    needs-funded    excludefromci
    Skip If    not $MNEMONIC_FUNDED    MNEMONIC_24_FUNDED is not set.
    Start With Wallet Needing Backup
    Open Verification Quiz
    Answer Quiz Correctly
    Tap    ${BACKUP_VERIFICATION_NEXT}
    Wait Until Page Contains Element    ${BACKUP_SUCCESS_DONE}    timeout=25s
    Tap    ${BACKUP_SUCCESS_DONE}
    Wait Until Page Contains Element    ${MORE_BUTTON}    timeout=30s
    Wait Until Page Does Not Contain Element    ${BACKUP_BANNER_CTA}    timeout=30s
