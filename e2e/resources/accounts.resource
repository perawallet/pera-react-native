*** Settings ***
Library             Collections
Resource            app.resource


*** Variables ***
${ACCOUNT_SELECTION_BUTTON}         tid=account_selection_button
${MORE_BUTTON}                      tid=more_button
${RECEIVE_BUTTON}                   tid=receive_button
${RECEIVE_COPY_ADDRESS_BUTTON}      tid=receive_copy_address_button

${MENU_SETTINGS_BUTTON}             tid=menu_settings_button
${MENU_STAKING_BUTTON}              tid=menu_staking_button
${MENU_CONTACTS_BUTTON}             tid=menu_contacts_button
${SETTINGS_SECURITY_ITEM}           tid=settings_item_security
${SETTINGS_DEVELOPER_ITEM}          tid=settings_item_developer_settings
${DEVELOPER_NODE_ITEM}              tid=developer_settings_node_item
${NODE_DEVELOPER_MODE_SWITCH}       tid=node_settings_developer_mode_switch
${NODE_TESTNET_RADIO}               tid=node_settings_algorand_testnet_radio

${ACCOUNT_MENU_ADD_BUTTON}          tid=account_menu_add_account_button
${ADD_ACCOUNT_IMPORT_BUTTON}        tid=add_account_import_button
${ADD_ACCOUNT_ADD_BUTTON}           tid=add_account_add_button
${ADD_ACCOUNT_UNIVERSAL_BUTTON}     tid=add_account_create_universal_wallet_button
${ADD_ACCOUNT_SEE_OTHER_BUTTON}     tid=add_account_see_other_options_button
${ADD_ACCOUNT_WATCH_BUTTON}         tid=add_account_watch_button
${WATCH_ADDRESS_INPUT}              tid=watch_account_address_input
${WATCH_SUBMIT_BUTTON}              tid=watch_account_submit_button

${ACCOUNT_TYPE_INFO_BUTTON}         tid=account-type-info-button
${OPTION_COPY_ADDRESS}              tid=account_network_algorand_copy
${OPTION_RENAME}                    tid=account_option_rename-account
${OPTION_REMOVE}                    tid=account_option_remove-account
${OPTION_VIEW_PASSPHRASE}           tid=account_option_view-passphrase
${RENAME_INPUT}                     tid=rename_account_input
${RENAME_SAVE_BUTTON}               tid=rename_account_save_button
${REMOVE_BACKUP_CONTINUE_BUTTON}    tid=remove_account_backup_continue_button
${REMOVE_CONFIRM_BUTTON}            tid=remove_account_confirm_button
${REMOVE_CANCEL_BUTTON}             tid=remove_account_cancel_button
${PASSPHRASE_ACK_REVEAL}            tid=passphrase_acknowledge_bottom_sheet_reveal
${PASSPHRASE_ACK_ROW_ID}            passphrase_acknowledge_bottom_sheet_row_
${REMOVE_NEXT_STEP}                 xpath=//*[@content-desc='remove_account_backup_continue_button' or @resource-id='remove_account_backup_continue_button' or @name='remove_account_backup_continue_button' or @content-desc='remove_account_confirm_button' or @resource-id='remove_account_confirm_button' or @name='remove_account_confirm_button']

${ACCOUNT_PORTFOLIO}                tid=account_portfolio
${ALGO_HOLDING_ROW}                 tid=asset_row_0

# Containers, icons and the drawer search trigger carry their testID without an accessibility
# label, so Android exposes it only as resource-id and iOS only as name.
${DRAWER_SEARCH_BUTTON}             tid=account_drawer_search_button
${ADD_ACCOUNT_CLOSE_BUTTON}         tid=add_account_close_button
${PASSPHRASE_GRID}                  tid=view_passphrase_bottom_sheet_grid
${NODE_CHAIN_NETWORKS}              tid=node_settings_chain_networks
${SWITCHER_ROWS}                    xpath=//*[starts-with(@content-desc, 'account_switcher_row_') or starts-with(@resource-id, 'account_switcher_row_') or starts-with(@name,'account_switcher_row_')]
${WATCH_INFO_CREATE_BUTTON}         tid=watch_info_create_button


${OPTION_ALGORAND_EXPAND}           tid=account_network_algorand_expand


*** Keywords ***
Open Account Switcher
    Wait Until Page Contains Element    ${ACCOUNT_SELECTION_BUTTON}    timeout=30s
    # Home re-renders after an account is added or removed, and a tap during that is lost.
    Wait Until Keyword Succeeds    20s    0.5s    Tap Until Switcher Open
    Wait Until Settled    ${ACCOUNT_MENU_ADD_BUTTON}

Tap Until Switcher Open
    # The sliver exists only while the drawer is open (Android keeps the closed panel's buttons in
    # the tree). An open drawer covers the selection button; tapping it again would hit the drawer.
    ${open}=    Run Keyword And Return Status    Page Should Contain Element    ${ACCOUNT_DRAWER_SLIVER}
    IF    ${open}    RETURN
    Tap    ${ACCOUNT_SELECTION_BUTTON}
    Wait Until Page Contains Element    ${ACCOUNT_DRAWER_SLIVER}    timeout=3s

Close Account Switcher
    [Documentation]    The switcher is a drawer with no close control; tapping the content it
    ...                slides aside dismisses it.
    Tap    ${ACCOUNT_DRAWER_SLIVER}
    Wait Until Switcher Closed

Wait Until Switcher Closed
    # The closed panel stays mounted, so its buttons do not leave the tree; the sliver does.
    Wait Until Page Does Not Contain Element    ${ACCOUNT_DRAWER_SLIVER}    timeout=10s

Switcher Row
    [Arguments]    ${address}
    RETURN    tid=account_switcher_row_${address}

Switcher Addresses
    [Documentation]    Addresses of the accounts listed in the open switcher, in list order.
    @{rows}=    Get WebElements    ${SWITCHER_ROWS}
    @{addresses}=    Create List
    FOR    ${row}    IN    @{rows}
        ${id}=    Get Test ID    ${row}
        Append To List    ${addresses}    ${id.replace('account_switcher_row_', '')}
    END
    RETURN    ${addresses}

Count Accounts
    [Documentation]    From Home; leaves the app on Home with the switcher closed.
    Open Account Switcher
    @{addresses}=    Switcher Addresses
    Go Home
    ${count}=    Get Length    ${addresses}
    RETURN    ${count}

Add Account To Wallet
    [Documentation]    Creates a key account in the current wallet; it becomes the selected one. A
    ...                wallet with an HD wallet is offered Add Account, one without it Create
    ...                Universal Wallet, never both.
    Open Account Switcher
    Tap    ${ACCOUNT_MENU_ADD_BUTTON}
    Wait Until Page Contains Element    ${ADD_ACCOUNT_IMPORT_BUTTON}    timeout=20s
    ${added}=    Tap If Present    ${ADD_ACCOUNT_ADD_BUTTON}
    IF    not ${added}    Tap    ${ADD_ACCOUNT_UNIVERSAL_BUTTON}
    Wait Until Page Contains Element    ${ACCOUNT_FINISH_BUTTON}    timeout=60s
    # The name field takes focus and the keyboard lifts the button; a tap while it moves misses.
    Wait Until Settled    ${ACCOUNT_FINISH_BUTTON}
    Tap    ${ACCOUNT_FINISH_BUTTON}
    Wait Until Page Contains Element    ${MORE_BUTTON}    timeout=60s
    # The PIN prompt and banners can come back after an account is added.
    Wait Clear Of Startup Prompts

Ensure Two Accounts
    ${count}=    Count Accounts
    IF    ${count} < 2    Add Account To Wallet

Open Account Options
    Wait Until Page Contains Element    ${MORE_BUTTON}    timeout=30s
    # While the overview loads (a new account, or Home just remounted), a skeleton overlay with no
    # testID covers the button panel and takes taps without effect, so tap until the sheet opens.
    Wait Until Keyword Succeeds    30s    0.5s    Tap More Until Options Open
    Wait Until Settled    ${OPTION_COPY_ADDRESS}

Tap More Until Options Open
    # A sheet that opened late must not be tapped again: the tap would land on its backdrop.
    ${open}=    Run Keyword And Return Status    Page Should Contain Element    ${OPTION_COPY_ADDRESS}
    IF    ${open}    RETURN
    Tap    ${MORE_BUTTON}
    Wait Until Page Contains Element    ${OPTION_COPY_ADDRESS}    timeout=3s

Open Account Option
    [Arguments]    ${option}
    Open Account Options
    Scroll Until Tappable    ${option}
    Tap    ${option}

Open Algorand Account Option
    [Documentation]    Rekey and rekeyed-account scan sit in the Algorand network row, behind its chevron.
    [Arguments]    ${option}
    Open Account Options
    Scroll Until Tappable    ${OPTION_ALGORAND_EXPAND}
    Tap    ${OPTION_ALGORAND_EXPAND}
    Scroll Until Tappable    ${option}
    Tap    ${option}

Start Account Removal
    [Documentation]    Stops on the final confirmation. An account not backed up warns first.
    Open Account Option    ${OPTION_REMOVE}
    Wait Until Page Contains Element    ${REMOVE_NEXT_STEP}    timeout=15s
    ${warned}=    Run Keyword And Return Status    Page Should Contain Element    ${REMOVE_BACKUP_CONTINUE_BUTTON}
    IF    ${warned}
        Wait Until Settled    ${REMOVE_BACKUP_CONTINUE_BUTTON}
        Tap    ${REMOVE_BACKUP_CONTINUE_BUTTON}
    END
    Wait Until Settled    ${REMOVE_CONFIRM_BUTTON}

Account Name Should Be
    [Documentation]    The account-options sheet is titled with the selected account's name.
    [Arguments]    ${name}
    Open Account Options
    Wait Until Page Contains    ${name}    timeout=10s

Receive Should Show Address
    [Documentation]    The receive screen prints the selected account's full address.
    [Arguments]    ${address}
    Tap    ${RECEIVE_BUTTON}
    Wait Until Page Contains Element    ${RECEIVE_COPY_ADDRESS_BUTTON}    timeout=20s
    Wait Until Page Contains    ${address}    timeout=10s

Open Menu
    Wait Until Page Contains Element    ${MENU_TAB}    timeout=30s
    Tap    ${MENU_TAB}
    Wait Until Page Contains Element    ${MENU_SETTINGS_BUTTON}    timeout=30s

Switch To Testnet
    [Documentation]    Testnet is listed only with Developer Mode on; both settings persist.
    Open Menu
    Tap    ${MENU_SETTINGS_BUTTON}
    Wait Until Page Contains Element    ${SETTINGS_SECURITY_ITEM}    timeout=20s
    Scroll Until Tappable    ${SETTINGS_DEVELOPER_ITEM}
    Tap    ${SETTINGS_DEVELOPER_ITEM}
    Wait Until Page Contains Element    ${DEVELOPER_NODE_ITEM}    timeout=20s
    Tap    ${DEVELOPER_NODE_ITEM}
    Wait Until Page Contains Element    ${NODE_DEVELOPER_MODE_SWITCH}    timeout=20s
    ${listed}=    Run Keyword And Return Status    Page Should Contain Element    ${NODE_CHAIN_NETWORKS}
    IF    not ${listed}    Tap    ${NODE_DEVELOPER_MODE_SWITCH}
    Scroll Until Tappable    ${NODE_TESTNET_RADIO}
    Tap    ${NODE_TESTNET_RADIO}
    Go Home

Select Watch Account
    [Documentation]    Selects the watch account for ${address}, adding it first if the wallet
    ...                does not have it yet.
    [Arguments]    ${address}
    ${row}=    Switcher Row    ${address}
    Open Account Switcher
    ${listed}=    Tap If Present    ${row}
    IF    ${listed}
        Wait Until Switcher Closed
        RETURN
    END
    Tap    ${ACCOUNT_MENU_ADD_BUTTON}
    Wait Until Page Contains Element    ${ADD_ACCOUNT_IMPORT_BUTTON}    timeout=20s
    Tap If Present    ${ADD_ACCOUNT_SEE_OTHER_BUTTON}
    Wait Until Page Contains Element    ${ADD_ACCOUNT_WATCH_BUTTON}    timeout=10s
    Tap    ${ADD_ACCOUNT_WATCH_BUTTON}
    Wait Until Page Contains Element    ${WATCH_INFO_CREATE_BUTTON}    timeout=20s
    Tap    ${WATCH_INFO_CREATE_BUTTON}
    Wait Until Page Contains Element    ${WATCH_ADDRESS_INPUT}    timeout=20s
    Input Text    ${WATCH_ADDRESS_INPUT}    ${address}
    Dismiss Keyboard
    Tap    ${WATCH_SUBMIT_BUTTON}
    Wait Until Settled    ${ACCOUNT_FINISH_BUTTON}
    Tap    ${ACCOUNT_FINISH_BUTTON}
    Wait Until Page Contains Element    ${MORE_BUTTON}    timeout=60s
    Wait Clear Of Startup Prompts
    Go Home
    Open Account Switcher
    Tap    ${row}
    Wait Until Switcher Closed

Passphrase Ack Row
    [Documentation]    The acknowledgement row at this index. A bare prefix variable cannot be
    ...                concatenated into an xpath, so the index is applied here instead.
    [Arguments]    ${index}
    RETURN    tid=${PASSPHRASE_ACK_ROW_ID}${index}

Confirm Removal Until The Sheet Goes
    [Documentation]    Taps Remove until the confirmation sheet leaves.
    ...
    ...                A single tap was swallowed on a run where the screenshot showed the sheet
    ...                still open with both buttons on it, so the tap never reached the button
    ...                rather than removal being slow. Cancel is never tapped, so a retry cannot
    ...                undo a removal that did start.
    FOR    ${attempt}    IN RANGE    4
        Run Keyword And Ignore Error    Tap    ${REMOVE_CONFIRM_BUTTON}
        ${gone}=    Run Keyword And Return Status
        ...    Wait Until Page Does Not Contain Element    ${REMOVE_CONFIRM_BUTTON}    timeout=10s
        IF    ${gone}    RETURN
    END
    ${cancel}=    Run Keyword And Return Status
    ...    Page Should Contain Element    ${REMOVE_CANCEL_BUTTON}
    Fail    The remove-account sheet is still up after four taps on Remove (its Cancel is ${cancel} present), so the taps are not reaching the button.
