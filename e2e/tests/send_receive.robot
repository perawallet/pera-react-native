*** Settings ***
Documentation       Receive and Send on Android and iOS from one suite. Send cases need the funded
...                 testnet account (see send_receive.resource) and skip without it.
Resource            ../resources/send_receive.resource

Suite Setup         Start Pera With Wallet
Suite Teardown      Close Funded Suite
Test Setup          Go Home
Test Teardown       Capture Failure Screenshot
Test Timeout        ${E2E_TEST_TIMEOUT}
Test Tags           send-receive


*** Test Cases ***
Receive Shows The Account QR
    [Tags]    id:receive.qr.open    p0    rc
    Open Receive
    Page Should Contain Element    ${RECEIVE_SHARE_ADDRESS}

Receive Address Can Be Copied
    [Tags]    id:receive.address.copy    p1
    Open Receive
    Tap    ${RECEIVE_COPY_ADDRESS}
    Wait Until Page Contains    ${COPIED_TOAST_TEXT}    timeout=5s

Receive Address Can Be Shared
    [Tags]    id:receive.address.share    p1
    [Teardown]    Leave Share Sheet
    Open Receive
    Tap    ${RECEIVE_SHARE_ADDRESS}

Send Opens The Asset List
    [Tags]    id:send.asset.list    p0    rc    needs-funded    excludefromci
    [Setup]    Use Funded Testnet Account
    [Teardown]    Leave Funded Testnet Account
    Open Send

Choosing An Asset Opens Amount Entry
    [Tags]    id:send.amount.open    p1    needs-funded    excludefromci
    [Setup]    Use Funded Testnet Account
    [Teardown]    Leave Funded Testnet Account
    Open Amount Entry
    Expect Element    ${SEND_NEXT_BUTTON}    disabled    timeout=0s

Entered Amount Leads To Destination
    [Tags]    id:send.amount.numpad    p1    needs-funded    excludefromci
    [Setup]    Use Funded Testnet Account
    [Teardown]    Leave Funded Testnet Account
    Open Amount Entry
    Enter Amount    ${SEND_AMOUNT}
    Open Destination

Max Fills The Amount
    [Tags]    id:send.amount.max    p1    needs-funded    excludefromci
    [Setup]    Use Funded Testnet Account
    [Teardown]    Leave Funded Testnet Account
    Open Amount Entry
    Expect Element    ${SEND_NEXT_BUTTON}    disabled    timeout=0s
    Tap    ${SEND_MAX_BUTTON}
    Wait Until Keyword Succeeds    5s    0.5s    Expect Element    ${SEND_NEXT_BUTTON}    enabled    timeout=0s

Own Address Leads To Confirmation
    [Tags]    id:send.confirm.reach    p1    needs-funded    excludefromci
    [Setup]    Use Funded Testnet Account
    [Teardown]    Leave Funded Testnet Account
    Open Amount Entry
    Enter Amount    ${SEND_AMOUNT}
    Open Destination
    Choose Own Address As Recipient

Send Executes On Testnet
    [Tags]    id:send.execute.testnet    p0    needs-funded    excludefromci
    [Setup]    Use Funded Testnet Account
    [Teardown]    Leave Funded Testnet Account
    Open Amount Entry
    Enter Amount    ${SEND_AMOUNT}
    Open Destination
    Choose Own Address As Recipient
    Confirmation Should Show Amount    ${SEND_AMOUNT}
    Slide To Confirm    ${SEND_CONFIRM_SLIDE}
    Wait Until Page Contains Element    ${SEND_SUCCESS_DONE}    timeout=45s


*** Keywords ***
Leave Share Sheet
    [Documentation]    The OS share sheet is outside the app; a relaunch is the one way out on both platforms.
    Capture Failure Screenshot
    Relaunch Pera
