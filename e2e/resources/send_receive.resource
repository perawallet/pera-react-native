*** Settings ***
Documentation       Receive needs no funds, so it runs on the suite's own wallet. Send and every other
...                 funded case use a funded testnet account imported from E2E_FUNDED_MNEMONIC (a
...                 24-word Universal wallet) whose primary address is E2E_FUNDED_ADDRESS; they skip
...                 when either is unset. Sends go to that same address, so a run spends only fees.
Library             String
Resource            accounts.resource


*** Variables ***
${FUNDED_MNEMONIC}                  %{E2E_FUNDED_MNEMONIC=}
${FUNDED_ADDRESS}                   %{E2E_FUNDED_ADDRESS=}
${SEND_AMOUNT}                      0.001

${ACCOUNT_SELECTION_BUTTON}         tid=account_selection_button
${MORE_BUTTON}                      tid=more_button
${ACCOUNT_MENU_ADD_BUTTON}          tid=account_menu_add_account_button
${ADD_ACCOUNT_IMPORT_BUTTON}        tid=add_account_import_button
${IMPORT_RECOVER_WALLET_BUTTON}     tid=import_account_options_recover_wallet_button
${IMPORT_HD_WALLET_OPTION}          tid=import_options_hd_wallet_button
${IMPORT_INFO_RECOVER_BUTTON}       tid=import_info_recover_button
${IMPORT_FIRST_WORD_INPUT}          tid=import_account_word_input_0
${IMPORT_SUBMIT_BUTTON}             tid=import_account_import_button
${IMPORT_SELECT_CONTINUE}           tid=import_select_addresses_continue_button
${NAME_ACCOUNT_FINISH}              tid=name_account_finish_button
# Any account row other than the funded one: the suite's own wallet account.
${OTHER_ACCOUNT_ROW}                xpath=(//*[(starts-with(@content-desc, 'account_switcher_row_') or starts-with(@resource-id, 'account_switcher_row_') or starts-with(@name,'account_switcher_row_')) and not(contains(@content-desc,'${FUNDED_ADDRESS}')) and not(contains(@resource-id,'${FUNDED_ADDRESS}')) and not(contains(@name,'${FUNDED_ADDRESS}'))])[1]

${MENU_SETTINGS_BUTTON}             tid=menu_settings_button
${SETTINGS_DEVELOPER_ITEM}          tid=settings_item_developer_settings
${DEVELOPER_NODE_ITEM}              tid=developer_settings_node_item
${DEVELOPER_MODE_SWITCH}            tid=node_settings_developer_mode_switch
# Listed only while Developer Mode is on; turning it off is how mainnet comes back.
${TESTNET_RADIO}                    tid=node_settings_algorand_testnet_radio

${SEND_BUTTON}                      tid=send_button
${RECEIVE_BUTTON}                   tid=receive_button
${RECEIVE_COPY_ADDRESS}             tid=receive_copy_address_button
${RECEIVE_SHARE_ADDRESS}            tid=receive_share_address_button
${COPIED_TOAST_TEXT}                Copied to clipboard
${SEND_ALGO_ROW}                    tid=asset-list-item-0
# The send-info sheet over the numpad has no testID on its button.
${SEND_INFO_UNDERSTAND}             xpath=//*[@text='I Understand' or @label='I Understand']
${SEND_NEXT_BUTTON}                 tid=send_input_next_button
${SEND_MAX_BUTTON}                  tid=send_input_max_button
${ADDRESS_SEARCH_INPUT}             tid=address_search_input
${SEND_CONFIRM_SLIDE}               tid=send_confirm_button
${SEND_CONFIRM_AMOUNT}              tid=send_confirm_amount
${SEND_SUCCESS_DONE}                tid=send_success-primary


*** Keywords ***
Use Funded Testnet Account
    [Documentation]    Selects the funded account on testnet, importing it the first time. Pair with
    ...                Leave Funded Testnet Account as the case teardown so later cases see the suite
    ...                wallet on mainnet again.
    Skip If    not $FUNDED_MNEMONIC or not $FUNDED_ADDRESS
    ...    Set E2E_FUNDED_MNEMONIC and E2E_FUNDED_ADDRESS to run funded cases.
    Go Home
    Open Account Switcher
    ${row}=    Funded Account Row
    ${known}=    Run Keyword And Return Status    Page Should Contain Element    ${row}
    IF    not ${known}    Import Funded Account
    Select Account    ${row}
    ${funded}=    Run Keyword And Return Status    Page Should Contain Element    ${SEND_BUTTON}
    IF    not ${funded}    Set Testnet    ${True}
    Wait Until Page Contains Element    ${SEND_BUTTON}    timeout=60s

Leave Funded Testnet Account
    Capture Failure Screenshot
    Run Keyword If    $FUNDED_MNEMONIC and $FUNDED_ADDRESS    Restore Suite Wallet

Close Funded Suite
    [Documentation]    Suite Teardown for suites with funded cases: those import the funded account,
    ...                so the suite leaves a fresh wallet behind when they could have run.
    IF    $FUNDED_MNEMONIC and $FUNDED_ADDRESS    Reset To Fresh Wallet
    Close Pera

Restore Suite Wallet
    Set Testnet    ${False}
    Open Account Switcher
    Select Account    ${OTHER_ACCOUNT_ROW}

Funded Account Row
    RETURN    tid=account_switcher_row_${FUNDED_ADDRESS}

Select Account
    [Arguments]    ${row}
    Wait Until Page Contains Element    ${row}    timeout=15s
    Tap    ${row}
    Wait Until Element Is Visible    ${MORE_BUTTON}    timeout=15s

Import Funded Account
    [Documentation]    From the open account switcher: Add Account -> Import -> Recover wallet ->
    ...                Universal (24-word) -> phrase -> pick the funded address -> name -> Home.
    Tap    ${ACCOUNT_MENU_ADD_BUTTON}
    Wait Until Page Contains Element    ${ADD_ACCOUNT_IMPORT_BUTTON}    timeout=15s
    Tap    ${ADD_ACCOUNT_IMPORT_BUTTON}
    Wait Until Page Contains Element    ${IMPORT_RECOVER_WALLET_BUTTON}    timeout=15s
    Tap    ${IMPORT_RECOVER_WALLET_BUTTON}
    Wait Until Settled    ${IMPORT_HD_WALLET_OPTION}
    Tap    ${IMPORT_HD_WALLET_OPTION}
    Wait Until Page Contains Element    ${IMPORT_INFO_RECOVER_BUTTON}    timeout=15s
    Tap    ${IMPORT_INFO_RECOVER_BUTTON}
    Wait Until Page Contains Element    ${IMPORT_FIRST_WORD_INPUT}    timeout=15s
    # Read by env var name with logging off, so the phrase never appears as a resolved argument.
    ${level}=    Set Log Level    NONE
    TRY
        Enter Recovery Phrase    %{E2E_FUNDED_MNEMONIC}
    FINALLY
        Set Log Level    ${level}
    END
    Dismiss Keyboard
    Tap    ${IMPORT_SUBMIT_BUTTON}
    Pick Funded Address
    Wait Until Page Contains Element    ${NAME_ACCOUNT_FINISH}    timeout=60s
    Tap    ${NAME_ACCOUNT_FINISH}
    Wait Until Page Contains Element    ${MENU_TAB}    timeout=60s
    Wait Clear Of Startup Prompts
    Open Account Switcher

Pick Funded Address
    Wait Until Page Contains Element    ${IMPORT_SELECT_CONTINUE}    timeout=60s
    ${checkbox}=    Set Variable    tid=import_select_addresses_item_checkbox_${FUNDED_ADDRESS}
    Wait Until Page Contains Element    ${checkbox}    timeout=30s
    ${ready}=    Run Keyword And Return Status    Element Should Be Enabled    ${IMPORT_SELECT_CONTINUE}
    IF    not ${ready}    Tap    ${checkbox}
    Wait Until Keyword Succeeds    5s    0.5s    Element Should Be Enabled    ${IMPORT_SELECT_CONTINUE}
    Tap    ${IMPORT_SELECT_CONTINUE}

Open Node Settings
    Go Home
    Tap    ${MENU_TAB}
    Wait Until Page Contains Element    ${MENU_SETTINGS_BUTTON}    timeout=15s
    Tap    ${MENU_SETTINGS_BUTTON}
    Scroll Until Present    ${SETTINGS_DEVELOPER_ITEM}
    Tap    ${SETTINGS_DEVELOPER_ITEM}
    Wait Until Page Contains Element    ${DEVELOPER_NODE_ITEM}    timeout=15s
    Tap    ${DEVELOPER_NODE_ITEM}
    Wait Until Page Contains Element    ${DEVELOPER_MODE_SWITCH}    timeout=15s

Set Testnet
    [Arguments]    ${on}
    Open Node Settings
    ${listed}=    Run Keyword And Return Status    Page Should Contain Element    ${TESTNET_RADIO}
    IF    ${on}
        IF    not ${listed}    Tap    ${DEVELOPER_MODE_SWITCH}
        Wait Until Page Contains Element    ${TESTNET_RADIO}    timeout=15s
        Tap    ${TESTNET_RADIO}
    ELSE IF    ${listed}
        Tap    ${DEVELOPER_MODE_SWITCH}
        Wait Until Page Does Not Contain Element    ${TESTNET_RADIO}    timeout=15s
    END
    Go Home

Open Receive
    # Home is still laying out after the reset, and a tap at a moving button misses it.
    Wait Until Settled    ${RECEIVE_BUTTON}
    Tap    ${RECEIVE_BUTTON}
    Wait Until Page Contains Element    ${RECEIVE_COPY_ADDRESS}    timeout=20s

Open Send
    Wait Until Page Contains Element    ${SEND_BUTTON}    timeout=30s
    Tap    ${SEND_BUTTON}
    Wait Until Settled    ${SEND_ALGO_ROW}

Open Amount Entry
    Open Send
    Tap    ${SEND_ALGO_ROW}
    Wait Until Page Contains Element    ${SEND_NEXT_BUTTON}    timeout=20s
    # Shown until acknowledged once; it covers the numpad.
    ${info}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${SEND_INFO_UNDERSTAND}    timeout=5s
    IF    ${info}
        Wait Until Settled    ${SEND_INFO_UNDERSTAND}
        Tap    ${SEND_INFO_UNDERSTAND}
        Wait Until Page Does Not Contain Element    ${SEND_INFO_UNDERSTAND}    timeout=10s
    END

Enter Amount
    [Arguments]    ${amount}
    Element Should Be Disabled    ${SEND_NEXT_BUTTON}
    @{chars}=    Split String To Characters    ${amount}
    FOR    ${c}    IN    @{chars}
        IF    $c == '.'
            Tap    tid=numpad_key_decimal
        ELSE
            Tap    tid=numpad_key_${c}
        END
    END
    Wait Until Keyword Succeeds    5s    0.5s    Element Should Be Enabled    ${SEND_NEXT_BUTTON}

Open Destination
    Tap    ${SEND_NEXT_BUTTON}
    Wait Until Page Contains Element    ${ADDRESS_SEARCH_INPUT}    timeout=20s

Choose Own Address As Recipient
    Input Text    ${ADDRESS_SEARCH_INPUT}    ${FUNDED_ADDRESS}
    ${row}=    Set Variable    tid=account_result_row_${FUNDED_ADDRESS}
    Wait Until Page Contains Element    ${row}    timeout=15s
    Dismiss Keyboard
    Tap    ${row}
    Wait Until Page Contains Element    ${SEND_CONFIRM_SLIDE}    timeout=25s

Confirmation Should Show Amount
    [Documentation]    Reads the amount off the confirmation screen rather than trusting that the
    ...                numpad taps landed. Enter Amount only checks Next became enabled, which any
    ...                non-zero value does, so a send of the wrong amount passed every assertion
    ...                this flow had.
    [Arguments]    ${expected}
    Wait Until Page Contains Element    ${SEND_CONFIRM_AMOUNT}    timeout=25s
    ${shown}=    Get Text    ${SEND_CONFIRM_AMOUNT}
    ${digits}=    Evaluate    __import__('re').sub(r'[^0-9.]', '', $shown)
    Should Be Equal As Numbers    ${digits}    ${expected}
    ...    msg=The confirmation screen shows "${shown}", not the ${expected} that was entered.
