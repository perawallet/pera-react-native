*** Settings ***
Documentation       WalletConnect sessions and sign requests from a dApp, on Android and iOS from one
...                 suite. Each case opens its own session, so any case runs alone.
Resource            ../resources/walletconnect.resource

Suite Setup         Start Pera For WalletConnect
Suite Teardown      Close Pera
Test Setup          Go Home
Test Teardown       Capture Failure Screenshot
Test Tags           walletconnect    needs-harness    excludefromci


*** Test Cases ***
Approving A Session Connects The dApp
    [Tags]    id:walletconnect.session.approve    p0
    Approve WC Session

Rejecting A Session Leaves The dApp Disconnected
    [Tags]    id:walletconnect.session.reject    p1
    Open WC Approval Sheet
    Tap    ${WC_REJECT_BUTTON}
    Wait Until Page Does Not Contain Element    ${WC_CONNECT_BUTTON}    timeout=15s
    Harness Should Not Be Connected

Rejecting A Sign Request Closes The Sheet
    [Tags]    id:walletconnect.sign.reject    p1    env-limited
    Connect WC Session
    Send WC Request    /sign
    Wait For Sign Sheet    ${SIGNING_REJECT_BUTTON}
    Tap    ${SIGNING_REJECT_BUTTON}
    Wait Until Page Does Not Contain Element    ${SIGNING_REJECT_BUTTON}    timeout=25s

Approving A Sign Request Returns The Signature
    [Tags]    id:walletconnect.sign.approve    p1    env-limited
    Connect WC Session
    Send WC Request    /sign
    Wait For Sign Sheet    ${SIGNING_CONFIRM_SLIDE}
    Slide To Confirm    ${SIGNING_CONFIRM_SLIDE}
    Wait Until Keyword Succeeds    25s    1s    Harness Sign Should Be Approved

Disconnecting A Session Removes It From Settings
    [Tags]    id:walletconnect.sessions.disconnect    p1
    Connect WC Session
    Open WC Sessions From Settings
    ${before}=    WC Session Count
    Tap    ${WC_SESSION_ITEM}
    Wait Until Page Contains Element    ${WC_DETAILS_DELETE_BUTTON}    timeout=15s
    Tap    ${WC_DETAILS_DELETE_BUTTON}
    Wait Until Settled    ${WC_DETAILS_CANCEL_BUTTON}
    Tap    ${WC_DETAILS_CANCEL_BUTTON}
    Wait Until Page Does Not Contain Element    ${WC_DETAILS_CANCEL_BUTTON}    timeout=10s
    Page Should Contain Element    ${WC_DETAILS_DELETE_BUTTON}
    Tap    ${WC_DETAILS_DELETE_BUTTON}
    Wait Until Settled    ${WC_DETAILS_CONFIRM_BUTTON}
    Tap    ${WC_DETAILS_CONFIRM_BUTTON}
    # Details pops back to the list only once the bridge disconnect resolves.
    Wait Until Page Does Not Contain Element    ${WC_DETAILS_DELETE_BUTTON}    timeout=90s
    Wait Until Keyword Succeeds    10s    0.5s    WC Session Count Should Be    ${before - 1}

Clearing All Sessions Empties Settings And Disconnects The dApp
    [Tags]    id:walletconnect.sessions.clear-all    p1
    Connect WC Session
    Open WC Sessions From Settings
    Tap    ${WC_CLEAR_ALL_BUTTON}
    Wait Until Settled    ${WC_DELETE_ALL_CONFIRM}
    Tap    ${WC_DELETE_ALL_CONFIRM}
    WC Sessions Should Be Empty
    Wait Until Keyword Succeeds    20s    1s    Harness Should Not Be Connected

Arbitrary Data Request Opens Its Own Signing Sheet
    [Tags]    id:walletconnect.sign.arbitrary-data    p1    wip
    Connect WC Session
    Send WC Request    /sign-arbitrary
    Wait For Sign Sheet    ${ARBITRARY_CONFIRM_SLIDE}
    Page Should Contain Element    ${ARBITRARY_REJECT_BUTTON}
    Tap    ${ARBITRARY_REJECT_BUTTON}
    Wait Until Page Does Not Contain Element    ${ARBITRARY_CONFIRM_SLIDE}    timeout=25s

Group Sign Request Opens The Signing Review
    [Tags]    id:walletconnect.sign.group    p1    wip
    Connect WC Session
    Send WC Request    /sign-group
    Wait For Sign Sheet    ${SIGNING_REJECT_BUTTON}
    Page Should Contain Element    ${SIGNING_CONFIRM_SLIDE}
    Tap    ${SIGNING_REJECT_BUTTON}
    Wait Until Page Does Not Contain Element    ${SIGNING_REJECT_BUTTON}    timeout=25s
