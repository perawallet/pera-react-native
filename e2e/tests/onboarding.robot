*** Settings ***
Documentation       Onboarding on Android and iOS from one suite. Every case starts from a device with
...                 no wallet, removing any wallet a previous case left behind, so cases run alone.
...                 Cases that import a wallet read its recovery phrase from the environment and
...                 skip when it is unset.
Resource            ../resources/onboarding.resource

Suite Setup         Open Pera
Suite Teardown      Run Keywords    Reset To Fresh Wallet    AND    Close Pera
Test Teardown       Capture Failure Screenshot
Test Timeout        ${E2E_TEST_TIMEOUT}
Test Tags           onboarding


*** Variables ***
${SECOND_ACCOUNT_NAME}      E2E Second
${WATCH_ACCOUNT_NAME}       E2E Watch


*** Test Cases ***
New Wallet Reaches Home With Its Name
    [Tags]    id:onboarding.create.named    p0    rc    release-gate
    Start Without Wallet
    Create Wallet Named    ${WALLET_NAME}
    Wait Clear Of Startup Prompts
    Selected Account Should Be Named    ${WALLET_NAME}

Confetti Plays After Wallet Creation
    [Tags]    id:onboarding.create.confetti    p2
    Start Without Wallet
    Tap    ${CREATE_WALLET_BUTTON}
    Accept Terms Until    ${ACCOUNT_NAME_INPUT}
    # The naming screen is still sliding in (and on iOS the keyboard lifts the button) when the input appears.
    Wait Until Settled    ${ACCOUNT_FINISH_BUTTON}
    Tap    ${ACCOUNT_FINISH_BUTTON}
    Wait Until Page Contains Element    ${CONFETTI}    timeout=15s

Existing Wallet Offers Add Account
    [Tags]    id:onboarding.existing.add-account-offered    p1
    Start With New Wallet
    Tap    ${ACCOUNT_SELECTION_BUTTON}
    Wait Until Settled    ${ACCOUNT_MENU_ADD_BUTTON}
    Page Should Contain Element    ${ACCOUNT_SWITCHER_ROW_ANY}

Import Lists Every Recovery Method
    [Tags]    id:onboarding.import.options    p0    rc
    Start Without Wallet
    Open Import Options From Welcome
    Page Should Contain Element    ${IMPORT_OPTION_RECOVER_QR}
    Page Should Contain Element    ${IMPORT_OPTION_PAIR_LEDGER}
    Scroll Until Present    ${IMPORT_OPTION_PERA_WEB}
    Scroll Until Present    ${IMPORT_OPTION_ASB}

Algorand Secure Backup Option Opens Its Import Flow
    [Tags]    id:onboarding.import.asb-entry    p1
    Start Without Wallet
    Open Import Options From Welcome
    Scroll Until Tappable    ${IMPORT_OPTION_ASB}
    Tap    ${IMPORT_OPTION_ASB}
    Wait Until Page Contains Element    ${ASB_INFO_CONTINUE}    timeout=20s
    Tap    ${ASB_INFO_CONTINUE}
    Wait Until Page Contains Element    ${ASB_PICK_FILE_BUTTON}    timeout=20s

Pair Ledger Option Opens Its Intro
    [Documentation]    Stops at the intro: anything past it needs a Ledger over Bluetooth.
    [Tags]    id:onboarding.import.ledger-entry    p1
    Start Without Wallet
    Open Import Options From Welcome
    Tap    ${IMPORT_OPTION_PAIR_LEDGER}
    Wait Until Page Contains Element    ${LEDGER_PAIR_START_BUTTON}    timeout=20s
    Page Should Contain Element    ${LEDGER_PAIR_INFO_BUTTON}

Algo25 Wallet Is Recovered From Its 25 Word Phrase
    [Tags]    id:onboarding.import.algo25    p0    needs-funded    excludefromci
    Skip If    not $MNEMONIC_25    MNEMONIC_25_WORD is not set.
    Import From Welcome    ${RECOVER_ALGO25}    MNEMONIC_25_WORD
    Page Should Contain Element    ${ACCOUNT_SELECTION_BUTTON}

Confetti Plays After Wallet Import
    [Tags]    id:onboarding.import.confetti    p2    needs-funded    excludefromci
    Skip If    not $MNEMONIC_25    MNEMONIC_25_WORD is not set.
    ${_}    ${saw_confetti}=    Import From Welcome    ${RECOVER_ALGO25}    MNEMONIC_25_WORD
    IF    not ${saw_confetti}
        Wait Until Page Contains Element    ${CONFETTI}    timeout=5s
    END

Universal Wallet Is Recovered From Its 24 Word Phrase
    [Tags]    id:onboarding.import.universal    p0    needs-funded    excludefromci
    Skip If    not $MNEMONIC_24    MNEMONIC_24_WORD is not set.
    Import From Welcome    ${RECOVER_UNIVERSAL_WALLET}    MNEMONIC_24_WORD
    Page Should Contain Element    ${ACCOUNT_SELECTION_BUTTON}

Universal And Algo25 Wallets Import Side By Side
    [Tags]    id:onboarding.import.universal-then-algo25    p1    needs-funded    excludefromci
    Skip If    not ($MNEMONIC_24 and $MNEMONIC_25)    MNEMONIC_24_WORD and MNEMONIC_25_WORD must both be set.
    Import From Welcome    ${RECOVER_UNIVERSAL_WALLET}    MNEMONIC_24_WORD
    Wait Clear Of Startup Prompts
    Open Add Account
    Tap    ${ADD_ACCOUNT_IMPORT_BUTTON}
    Wait Until Page Contains Element    ${IMPORT_OPTION_RECOVER_WALLET}    timeout=20s
    Enter Recovery Phrase For    ${RECOVER_ALGO25}    MNEMONIC_25_WORD
    Finish Import
    Page Should Contain Element    ${ACCOUNT_SELECTION_BUTTON}

Import Detects Accounts Rekeyed To The Wallet
    [Tags]    id:onboarding.import.rekeyed-detected    p1    needs-funded    excludefromci
    Skip If    not $MNEMONIC_24_REKEYED    MNEMONIC_24_REKEYED_ACCOUNT is not set.
    ${saw_rekeyed}    ${_}=    Import From Welcome    ${RECOVER_UNIVERSAL_WALLET}    MNEMONIC_24_REKEYED_ACCOUNT
    Should Be True    ${saw_rekeyed}    msg=Importing a wallet with rekeyed accounts never offered them.

Rescan After Importing Rekeyed Accounts Finds Nothing New
    [Tags]    id:onboarding.rescan.after-import    p1    needs-funded    excludefromci
    Skip If    not $MNEMONIC_24_REKEYED    MNEMONIC_24_REKEYED_ACCOUNT is not set.
    Import From Welcome    ${RECOVER_UNIVERSAL_WALLET}    MNEMONIC_24_REKEYED_ACCOUNT
    Wait Clear Of Startup Prompts
    Open Rescan For Rekeyed Accounts
    Wait Until Page Contains Element    ${RESCAN_SKIP_BUTTON}    timeout=90s
    Page Should Not Contain Element    ${RESCAN_ADD_BUTTON}

Rescan Offers Rekeyed Accounts Skipped At Import
    [Tags]    id:onboarding.rescan.after-skip    p1    needs-funded    excludefromci
    Skip If    not $MNEMONIC_24_REKEYED    MNEMONIC_24_REKEYED_ACCOUNT is not set.
    Import From Welcome    ${RECOVER_UNIVERSAL_WALLET}    MNEMONIC_24_REKEYED_ACCOUNT    rekeyed=skip
    Wait Clear Of Startup Prompts
    Open Rescan For Rekeyed Accounts
    Wait Until Page Contains Element    ${RESCAN_ADD_BUTTON}    timeout=90s

New Account Is Added To The Existing Wallet
    [Tags]    id:onboarding.add-account.hd    p1
    Start With New Wallet
    Open Add Account
    Tap    ${ADD_ACCOUNT_ADD_BUTTON}
    Name Account And Finish    ${SECOND_ACCOUNT_NAME}
    Selected Account Should Be Named    ${SECOND_ACCOUNT_NAME}

Algo25 Account Is Created From Other Options
    [Tags]    id:onboarding.add-account.algo25    p1
    Start With New Wallet
    Open Add Account
    Reveal Other Add Account Options
    Scroll Until Tappable    ${ADD_ACCOUNT_ALGO25_BUTTON}
    Tap    ${ADD_ACCOUNT_ALGO25_BUTTON}
    Name Account And Finish    ${SECOND_ACCOUNT_NAME}
    Selected Account Should Be Named    ${SECOND_ACCOUNT_NAME}

Other Options Reveal Watch And Algo25
    [Tags]    id:onboarding.add-account.other-options    p1
    Start With New Wallet
    Open Add Account
    Page Should Not Contain Element    ${ADD_ACCOUNT_WATCH_BUTTON}
    Reveal Other Add Account Options
    Page Should Contain Element    ${ADD_ACCOUNT_WATCH_BUTTON}
    Scroll Until Present    ${ADD_ACCOUNT_ALGO25_BUTTON}

Closing Add Account Returns Home
    [Tags]    id:onboarding.add-account.close    p2
    Start With New Wallet
    Open Add Account
    Tap    ${ADD_ACCOUNT_CLOSE_BUTTON}
    Wait Until Page Does Not Contain Element    ${ADD_ACCOUNT_IMPORT_BUTTON}    timeout=15s
    Page Should Contain Element    ${ACCOUNT_SELECTION_BUTTON}

Watch Account Is Added From An Address
    [Tags]    id:onboarding.add-account.watch    p1
    Start With New Wallet
    Open Add Account
    Reveal Other Add Account Options
    Scroll Until Tappable    ${ADD_ACCOUNT_WATCH_BUTTON}
    # The option opens at the bottom edge, partly under the system navigation bar that takes the tap.
    Swipe By Percent    50    70    50    40
    Wait Until Settled    ${ADD_ACCOUNT_WATCH_BUTTON}
    Tap    ${ADD_ACCOUNT_WATCH_BUTTON}
    Wait Until Settled    ${WATCH_INFO_CREATE_BUTTON}
    Tap    ${WATCH_INFO_CREATE_BUTTON}
    Wait Until Page Contains Element    ${WATCH_ADDRESS_INPUT}    timeout=15s
    Input Text    ${WATCH_ADDRESS_INPUT}    ${WATCH_ADDRESS}
    Dismiss Keyboard
    Expect Element    ${WATCH_SUBMIT_BUTTON}    enabled    timeout=5s    retry_interval=0.5s
    Tap    ${WATCH_SUBMIT_BUTTON}
    Name Account And Finish    ${WATCH_ACCOUNT_NAME}
    Selected Account Should Be Named    ${WATCH_ACCOUNT_NAME}

Node Switches To Testnet And Back To Mainnet
    [Tags]    id:onboarding.settings.node-testnet    p1
    Start With New Wallet
    Open Node Settings
    Tap    ${NODE_DEV_MODE_SWITCH}
    Wait Until Page Contains Element    ${NODE_TESTNET_RADIO}    timeout=20s
    Tap    ${NODE_TESTNET_RADIO}
    # Mainnet is the non-developer default, so switching developer mode off restores it.
    Tap    ${NODE_DEV_MODE_SWITCH}
    Wait Until Page Does Not Contain Element    ${NODE_TESTNET_RADIO}    timeout=20s
