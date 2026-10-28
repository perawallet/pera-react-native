*** Settings ***
Documentation       Onramp (Fund tab) on Android and iOS from one suite.
Resource            ../resources/onramp.resource

Suite Setup         Run Keywords    Start Pera With Wallet    AND    Acknowledge Onramp Introduction
Suite Teardown      Close Pera
Test Setup          Go Home
Test Teardown       Capture Failure Screenshot
Test Timeout        ${E2E_TEST_TIMEOUT}
Test Tags           onramp


*** Test Cases ***
Fund Tab Opens The Buy Screen
    [Tags]    id:onramp.tab.open    p0    rc
    Open Fund Tab
    Page Should Contain Element    ${ONRAMP_TAB_HISTORY}

Buy Screen Switches Between Fund And History
    [Tags]    id:onramp.tabs.switch    p1
    Open Fund Tab
    History Page Should Be Off Screen
    Tap    ${ONRAMP_TAB_HISTORY}
    Wait Until Element Is Visible    ${ONRAMP_HISTORY_FILTER_ALL}    timeout=15s
    Tap    ${ONRAMP_TAB_FUND}
    Wait Until Keyword Succeeds    10s    0.5s    History Page Should Be Off Screen

Buy Screen Shows The Region Chip
    [Tags]    id:onramp.region.chip    p1
    Open Fund Tab
    Wait Until Element Is Visible    ${ONRAMP_COUNTRY_CHIP}    timeout=15s
