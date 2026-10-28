*** Settings ***
Documentation       Discover tab on Android and iOS from one suite.
Resource            ../resources/discover.resource

Suite Setup         Start Pera With Wallet
Suite Teardown      Close Pera
Test Setup          Go Home
Test Teardown       Capture Failure Screenshot
Test Timeout        ${E2E_TEST_TIMEOUT}
Test Tags           discover


*** Test Cases ***
Discover Tab Loads The Web Page
    [Tags]    id:discover.tab.load    p0    rc
    Open Discover
    Discover Page Should Be Loaded

Accepting The Age Declaration Opens Discover
    [Tags]    id:discover.age-gate.accept    p1
    Clear One-Time Flags
    Tap    ${DISCOVER_TAB}
    Wait Until Settled    ${AGE_GATE_CONFIRM}
    Tap    ${AGE_GATE_CONFIRM}
    Discover Page Should Be Loaded

Discover Loads Again After Switching Tabs
    [Tags]    id:discover.tab.reload    p1
    Open Discover
    Discover Page Should Be Loaded
    Tap    ${HOME_TAB}
    Wait Until Element Is Visible    ${MORE_BUTTON}    timeout=15s
    Open Discover
    Discover Page Should Be Loaded
