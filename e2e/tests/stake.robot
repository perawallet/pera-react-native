*** Settings ***
Documentation       Staking on Android and iOS from one suite.
Resource            ../resources/stake.resource

Suite Setup         Start Pera With Wallet
Suite Teardown      Close Pera
Test Setup          Go Home
Test Teardown       Capture Failure Screenshot
Test Timeout        ${E2E_TEST_TIMEOUT}
Test Tags           stake


*** Test Cases ***
Staking Screen Lists Projects
    [Tags]    id:stake.screen.projects    p2
    Open Staking
    Page Should Contain Element    ${STAKING_HELP_BUTTON}
    Staking Projects Should Be Listed
    Page Should Not Contain Element    ${STAKING_ERROR_TITLE}

Help Sheet Opens And Closes
    [Tags]    id:stake.help.sheet    p2
    Open Staking
    Tap    ${STAKING_HELP_BUTTON}
    Wait Until Settled    ${STAKING_HELP_TITLE}
    Close Sheet
    Wait Until Page Does Not Contain Element    ${STAKING_HELP_TITLE}    timeout=10s
    Page Should Contain Element    ${STAKING_SUBTITLE}

Disclaimer Unlocks Accept Only After Scrolling
    [Tags]    id:stake.disclaimer.scroll-to-accept    p1
    Open Staking
    Staking Projects Should Be Listed
    Open Disclaimer
    Accept Should Be Disabled Before Scrolling
    Scroll Disclaimer To The End
    Close Disclaimer
    Page Should Not Contain Element    ${WEBVIEW_CLOSE_BUTTON}

Accepting The Disclaimer Opens The Project
    [Tags]    id:stake.disclaimer.accept    p2
    Open Staking
    Staking Projects Should Be Listed
    Open Disclaimer
    Accept Disclaimer
    Project Page Should Be Open
    Close Project Page

Accepted Disclaimer Is Not Shown Again
    [Tags]    id:stake.disclaimer.remembered    p2
    Open Staking
    Staking Projects Should Be Listed
    ${disclaimer}=    Tap First Project
    IF    ${disclaimer}    Accept Disclaimer
    Project Page Should Be Open
    Close Project Page
    ${disclaimer}=    Tap First Project
    Should Not Be True    ${disclaimer}    The disclaimer came back after being accepted.
    Project Page Should Be Open
    Close Project Page
