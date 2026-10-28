*** Settings ***
Documentation       Transactions and notifications on Android and iOS from one suite. Cases tagged
...                 needs-funded run against the funded testnet account and skip without it.
Resource            ../resources/transactions.resource

Suite Setup         Start Pera With Wallet
Suite Teardown      Close Funded Suite
Test Setup          Go Home
Test Teardown       Capture Failure Screenshot
Test Timeout        ${E2E_TEST_TIMEOUT}
Test Tags           transactions


*** Test Cases ***
History Shows The Empty State On A New Account
    [Tags]    id:transactions.history.empty    p0    rc
    Open History
    Wait Until Page Contains    ${HISTORY_EMPTY_TEXT}    timeout=45s

Account Tabs Switch Between Overview And History
    [Tags]    id:transactions.tabs.switch    p1
    Open History
    Wait Until Page Contains    ${HISTORY_EMPTY_TEXT}    timeout=45s
    Tap    ${OVERVIEW_TAB}
    Wait Until Element Is Visible    ${MORE_BUTTON}    timeout=15s

NFTs Tab Shows The Empty State On A New Account
    [Tags]    id:transactions.nfts.empty    p1
    Wait Until Settled    ${NFTS_TAB}
    Tap    ${NFTS_TAB}
    Wait Until Page Contains    ${NFTS_EMPTY_TEXT}    timeout=45s

Bell Opens The Notifications Center
    [Tags]    id:transactions.notifications.open    p0    rc
    Open Notifications Center

Inbox Shows The Empty State On A New Account
    [Tags]    id:transactions.inbox.empty    p1
    Open Notifications Center
    Tap    ${INBOX_TAB}
    Wait Until Page Contains Element    ${INBOX_EMPTY_STATE}    timeout=30s
    Page Should Not Contain Element    ${ASA_INBOX_ITEM}

Funded History Lists Real Transactions
    [Tags]    id:transactions.history.rows    p0    needs-funded    excludefromci
    [Setup]    Use Funded Testnet Account
    [Teardown]    Leave Funded Testnet Account
    Open History
    Wait Until Page Contains Element    ${TX_ROW_ANY}    timeout=45s
    @{rows}=    Get WebElements    ${TX_ROW_ANY}
    ${count}=    Get Length    ${rows}
    Should Be True    ${count} >= 2    Expected at least two history rows, got ${count}.
    Page Should Not Contain Text    ${HISTORY_EMPTY_TEXT}

Transaction Detail Shows Fee And Explorer Link
    [Tags]    id:transactions.detail.open    p0    needs-funded    excludefromci
    [Setup]    Use Funded Testnet Account
    [Teardown]    Leave Funded Testnet Account
    Open First Transaction
    # A fee row that renders with the wrong number passes any presence check, so read it.
    # Every Algorand transaction pays at least the 0.001 ALGO minimum.
    Displayed Number Should Be At Least    transaction_detail_fee    ${0.001}
    Scroll Until Present    ${TX_DETAIL_EXPLORER}

Funded Notifications Center Lists Rows
    [Tags]    id:transactions.notifications.rows    p0    needs-funded    excludefromci
    [Setup]    Use Funded Testnet Account
    [Teardown]    Leave Funded Testnet Account
    Open Notifications Center
    Tap    ${NOTIFICATIONS_TAB}
    ${notification}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${NOTIFICATION_ROW_ANY}    timeout=15s
    Tap    ${INBOX_TAB}
    ${inbox}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${ASA_INBOX_ITEM}    timeout=5s
    Skip If    not (${notification} or ${inbox})    No server-sent notifications or inbox items this run.
