*** Settings ***
Documentation       WalletConnect against a host-side v1 dApp harness, started outside the suite and
...                 reached at WC_HARNESS_URL. Its requests are self amount-0 payments that are never
...                 submitted, so no case moves funds.
Resource            app.resource
Library             libraries/wc_harness.py


*** Variables ***
${WC_HARNESS_URL}                   %{WC_HARNESS_URL=}
# The harness builds its transactions for this network; it must match the wallet's active one.
${WC_NETWORK}                       mainnet

${WC_CONNECT_BUTTON}                tid=wc_connect_button
${WC_REJECT_BUTTON}                 tid=wc_reject_button
${WC_SUCCESS}                       tid=wc_connection_success
# Rows are suffixed with the internal account id, so only a prefix match finds them.
${WC_ACCOUNT_ROW_ANY}               xpath=//*[starts-with(@name,'wc_account_row_') or starts-with(@content-desc, 'wc_account_row_') or starts-with(@resource-id, 'wc_account_row_')]
${SIGNING_REJECT_BUTTON}            tid=signing_reject_button
${SIGNING_CONFIRM_SLIDE}            tid=signing-confirm-slide
${ARBITRARY_CONFIRM_SLIDE}          tid=arbitrary-data-confirm-slide
${ARBITRARY_REJECT_BUTTON}          tid=arbitrary-data-reject-button
${WC_EVM_ACCOUNT_ROW}               tid=wc_evm_account_row
${REVIEW_FROM}                      tid=review_from
${ETHEREUM_REVIEW_FEE}              tid=ethereum_review_fee
# One row per asset sent, suffixed with its asset id; _nothing stands in when nothing is sent.
${REVIEW_SEND_ROW}                  xpath=//*[(starts-with(@name,'review_wallet_send_') or starts-with(@content-desc,'review_wallet_send_') or starts-with(@resource-id,'review_wallet_send_')) and not(@name='review_wallet_send_nothing') and not(@content-desc='review_wallet_send_nothing') and not(@resource-id='review_wallet_send_nothing')]

${MENU_SETTINGS_BUTTON}             tid=menu_settings_button
${SETTINGS_WC_SESSIONS}             tid=settings_item_walletconnect_sessions
${WC_SESSION_ITEM}                  tid=wallet_connect_session_item
${WC_EMPTY_CONNECT_BUTTON}          tid=wallet_connect_connect_button
${WC_CLEAR_ALL_BUTTON}              tid=wallet_connect_clear_all_button
${WC_DETAILS_DELETE_BUTTON}         tid=wallet_connect_details_delete_button
${WC_DETAILS_CONFIRM_BUTTON}        tid=wallet_connect_details_confirm_delete_button
${WC_DETAILS_CANCEL_BUTTON}         tid=wallet_connect_details_cancel_button
# The delete-all dialog's confirm button has no testID, so match its label.
${WC_DELETE_ALL_CONFIRM}            xpath=//*[@text='Delete' or @label='Delete']


*** Keywords ***
Start Pera For WalletConnect
    Skip If    not $WC_HARNESS_URL    WC_HARNESS_URL is not set; these cases need the dApp harness.
    Harness Status
    Start Pera With Wallet

Open WC Approval Sheet
    [Arguments]    ${deeplink}=${EMPTY}
    IF    not $deeplink
        ${deeplink}=    Fresh WC Deeplink
    END
    Open Deeplink    ${deeplink}
    Wait Until Settled    ${WC_CONNECT_BUTTON}

Approve WC Session
    Open WC Approval Sheet
    Tap    ${WC_ACCOUNT_ROW_ANY}
    Tap    ${WC_CONNECT_BUTTON}
    Wait Until Page Contains Element    ${WC_SUCCESS}    timeout=30s
    Wait Until Keyword Succeeds    20s    1s    Harness Should Be Connected

Connect WC Session
    [Documentation]    An approved session with its success sheet closed, ready for dApp requests.
    Approve WC Session
    Close Sheet
    Wait Until Page Does Not Contain Element    ${WC_SUCCESS}    timeout=10s

Harness Should Be Connected
    ${status}=    Harness Status
    Should Be True    $status['connected']

Harness Should Not Be Connected
    ${status}=    Harness Status
    Should Not Be True    $status['connected']

Send WC Request
    [Documentation]    Send one request only: a resend queues a duplicate that suppresses the sheet.
    [Arguments]    ${endpoint}
    Send Harness Request    ${endpoint}    ${WC_NETWORK}

Wait For Sign Sheet
    [Arguments]    ${anchor}
    Wait Until Page Contains Element    ${anchor}    timeout=45s
    Wait Until Settled    ${anchor}

Harness Sign Should Be Approved
    ${result}=    Harness Sign Result
    Should Be True    $result['done'] and not $result['rejected']    ${result}

Open WC Sessions From Settings
    Tap    ${MENU_TAB}
    Wait Until Page Contains Element    ${MENU_SETTINGS_BUTTON}    timeout=15s
    Tap    ${MENU_SETTINGS_BUTTON}
    Wait Until Page Contains Element    ${SETTINGS_WC_SESSIONS}    timeout=15s
    Tap    ${SETTINGS_WC_SESSIONS}
    Wait Until Page Contains Element    ${WC_SESSION_ITEM}    timeout=30s

WC Session Count
    ${rows}=    Get Webelements    ${WC_SESSION_ITEM}
    ${count}=    Get Length    ${rows}
    RETURN    ${count}

WC Session Count Should Be
    [Arguments]    ${expected}
    ${count}=    WC Session Count
    Should Be Equal As Integers    ${count}    ${expected}

WC Sessions Should Be Empty
    [Documentation]    The list pops back only after the bridge round-trip resolves, which is slow
    ...                when the socket idled during navigation.
    Wait Until Page Contains Element    ${WC_EMPTY_CONNECT_BUTTON}    timeout=90s
    Page Should Not Contain Element    ${WC_SESSION_ITEM}

Connect WC EVM Session
    [Documentation]    EVM requests reach the wallet only over a WalletConnect v2 session on eip155,
    ...                which the harness opens at /evm/uri. A harness without it answers 404.
    TRY
        ${session}=    Send Harness Request    /evm/uri
    EXCEPT    HTTP Error 404*    type=GLOB
        Skip    The WC harness has no /evm/uri: an EVM request needs a WalletConnect v2 (eip155) dApp session.
    END
    ${deeplink}=    Evaluate    'perawallet-wc://wc?uri=' + urllib.parse.quote($session['uri'], safe='')
    ...    modules=urllib.parse
    Open WC Approval Sheet    ${deeplink}
    # EVM chains go to one account, preset to the selected one; its row opens a picker, so leave it.
    Page Should Contain Element    ${WC_EVM_ACCOUNT_ROW}
    Tap    ${WC_CONNECT_BUTTON}
    Wait Until Page Contains Element    ${WC_SUCCESS}    timeout=30s
    Wait Until Keyword Succeeds    20s    1s    Harness Should Be Connected
    Close Sheet
    Wait Until Page Does Not Contain Element    ${WC_SUCCESS}    timeout=10s
