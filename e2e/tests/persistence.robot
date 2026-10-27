*** Settings ***
Documentation       Settings and wallet state survive a cold restart. Each case puts back what it changed;
...                 the suite still ends on a fresh wallet because one case removes every account.
Resource            ../resources/persistence.resource

Suite Setup         Start Pera With Wallet
Suite Teardown      Run Keywords    Reset To Fresh Wallet    AND    Close Pera
Test Setup          Go Home
Test Teardown       Capture Failure Screenshot
Test Tags           persistence


*** Test Cases ***
Theme Survives A Restart
    [Tags]    id:persistence.theme.restart    p1
    Select Theme    dark
    Theme Should Be Selected    dark
    Relaunch Pera
    Open Settings
    Open Theme Settings
    Theme Should Be Selected    dark
    [Teardown]    Restore System Theme

Currency Survives A Restart
    [Tags]    id:persistence.currency.restart    p1
    Open Settings
    Open Currency Settings
    Select Currency    EUR
    Relaunch Pera
    Open Settings
    Open Currency Settings
    Main Currency Should Be    EUR
    [Teardown]    Restore Usd

Account Name Survives A Restart
    [Tags]    id:persistence.account-name.restart    p1
    # A fixed name could already be there from an earlier run and pass without a save.
    ${name}=    Evaluate    f"E2E {random.randint(10000, 99999)}"    modules=random
    ${previous}=    Rename Selected Account    ${name}
    VAR    ${ORIGINAL_ACCOUNT_NAME}    ${previous}    scope=TEST
    Relaunch Pera
    Go Home
    Account Name Should Be    ${name}
    [Teardown]    Restore Account Name

Removing All Accounts Starts Onboarding After A Restart
    [Tags]    id:persistence.remove-all.onboarding    p0
    Remove All Accounts
    Restart Pera
    Wait Until Page Contains Element    ${FIRST_SCREEN}    timeout=30s
    Dismiss Dev Client Intro
    Tap If Present    ${TERMS_AGREE_BUTTON}
    Wait Until Page Contains Element    ${CREATE_WALLET_BUTTON}    timeout=15s
    Page Should Not Contain Element    ${MENU_TAB}
    Create Wallet
    Wait Clear Of Startup Prompts
    ${count}=    Count Accounts
    Should Be Equal As Integers    ${count}    1
    [Teardown]    Ensure Wallet After Test
