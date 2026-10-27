*** Settings ***
Library             Collections
Resource            app.resource


*** Variables ***
${ACCOUNT_SELECTION_BUTTON}         xpath=//*[@resource-id='account_selection_button' or @name='account_selection_button' or @content-desc='account_selection_button']
${MORE_BUTTON}                      xpath=//*[@resource-id='more_button' or @name='more_button' or @content-desc='more_button']
${RECEIVE_BUTTON}                   xpath=//*[@resource-id='receive_button' or @name='receive_button' or @content-desc='receive_button']
${RECEIVE_COPY_ADDRESS_BUTTON}      xpath=//*[@resource-id='receive_copy_address_button' or @name='receive_copy_address_button' or @content-desc='receive_copy_address_button']

${MENU_SETTINGS_BUTTON}             xpath=//*[@resource-id='menu_settings_button' or @name='menu_settings_button' or @content-desc='menu_settings_button']
${MENU_STAKING_BUTTON}              xpath=//*[@resource-id='menu_staking_button' or @name='menu_staking_button' or @content-desc='menu_staking_button']
${MENU_CONTACTS_BUTTON}             xpath=//*[@resource-id='menu_contacts_button' or @name='menu_contacts_button' or @content-desc='menu_contacts_button']
${SETTINGS_SECURITY_ITEM}           xpath=//*[@resource-id='settings_item_security' or @name='settings_item_security' or @content-desc='settings_item_security']
${SETTINGS_DEVELOPER_ITEM}          xpath=//*[@resource-id='settings_item_developer_settings' or @name='settings_item_developer_settings' or @content-desc='settings_item_developer_settings']
${DEVELOPER_NODE_ITEM}              xpath=//*[@resource-id='developer_settings_node_item' or @name='developer_settings_node_item' or @content-desc='developer_settings_node_item']
${NODE_DEVELOPER_MODE_SWITCH}       xpath=//*[@resource-id='node_settings_developer_mode_switch' or @name='node_settings_developer_mode_switch' or @content-desc='node_settings_developer_mode_switch']
${NODE_TESTNET_RADIO}               xpath=//*[@resource-id='node_settings_algorand_testnet_radio' or @name='node_settings_algorand_testnet_radio' or @content-desc='node_settings_algorand_testnet_radio']

${ACCOUNT_MENU_ADD_BUTTON}          xpath=//*[@resource-id='account_menu_add_account_button' or @name='account_menu_add_account_button' or @content-desc='account_menu_add_account_button']
${ADD_ACCOUNT_IMPORT_BUTTON}        xpath=//*[@resource-id='add_account_import_button' or @name='add_account_import_button' or @content-desc='add_account_import_button']
${ADD_ACCOUNT_ADD_BUTTON}           xpath=//*[@resource-id='add_account_add_button' or @name='add_account_add_button' or @content-desc='add_account_add_button']
${ADD_ACCOUNT_UNIVERSAL_BUTTON}     xpath=//*[@resource-id='add_account_create_universal_wallet_button' or @name='add_account_create_universal_wallet_button' or @content-desc='add_account_create_universal_wallet_button']
${ADD_ACCOUNT_SEE_OTHER_BUTTON}     xpath=//*[@resource-id='add_account_see_other_options_button' or @name='add_account_see_other_options_button' or @content-desc='add_account_see_other_options_button']
${ADD_ACCOUNT_WATCH_BUTTON}         xpath=//*[@resource-id='add_account_watch_button' or @name='add_account_watch_button' or @content-desc='add_account_watch_button']
${WATCH_ADDRESS_INPUT}              xpath=//*[@resource-id='watch_account_address_input' or @name='watch_account_address_input' or @content-desc='watch_account_address_input']
${WATCH_SUBMIT_BUTTON}              xpath=//*[@resource-id='watch_account_submit_button' or @name='watch_account_submit_button' or @content-desc='watch_account_submit_button']

${ACCOUNT_TYPE_INFO_BUTTON}         xpath=//*[@resource-id='account-type-info-button' or @name='account-type-info-button' or @content-desc='account-type-info-button']
${OPTION_COPY_ADDRESS}              xpath=//*[@resource-id='account_network_algorand_copy' or @name='account_network_algorand_copy' or @content-desc='account_network_algorand_copy']
${OPTION_RENAME}                    xpath=//*[@resource-id='account_option_rename-account' or @name='account_option_rename-account' or @content-desc='account_option_rename-account']
${OPTION_REMOVE}                    xpath=//*[@resource-id='account_option_remove-account' or @name='account_option_remove-account' or @content-desc='account_option_remove-account']
${OPTION_VIEW_PASSPHRASE}           xpath=//*[@resource-id='account_option_view-passphrase' or @name='account_option_view-passphrase' or @content-desc='account_option_view-passphrase']
${RENAME_INPUT}                     xpath=//*[@resource-id='rename_account_input' or @name='rename_account_input' or @content-desc='rename_account_input']
${RENAME_SAVE_BUTTON}               xpath=//*[@resource-id='rename_account_save_button' or @name='rename_account_save_button' or @content-desc='rename_account_save_button']
${REMOVE_BACKUP_CONTINUE_BUTTON}    xpath=//*[@resource-id='remove_account_backup_continue_button' or @name='remove_account_backup_continue_button' or @content-desc='remove_account_backup_continue_button']
${REMOVE_CONFIRM_BUTTON}            xpath=//*[@resource-id='remove_account_confirm_button' or @name='remove_account_confirm_button' or @content-desc='remove_account_confirm_button']
${REMOVE_CANCEL_BUTTON}             xpath=//*[@resource-id='remove_account_cancel_button' or @name='remove_account_cancel_button' or @content-desc='remove_account_cancel_button']
${PASSPHRASE_ACK_REVEAL}            xpath=//*[@resource-id='passphrase_acknowledge_bottom_sheet_reveal' or @name='passphrase_acknowledge_bottom_sheet_reveal' or @content-desc='passphrase_acknowledge_bottom_sheet_reveal']
${PASSPHRASE_ACK_ROW_ID}            passphrase_acknowledge_bottom_sheet_row_
${REMOVE_NEXT_STEP}                 xpath=//*[@content-desc='remove_account_backup_continue_button' or @resource-id='remove_account_backup_continue_button' or @name='remove_account_backup_continue_button' or @content-desc='remove_account_confirm_button' or @resource-id='remove_account_confirm_button' or @name='remove_account_confirm_button']

${ACCOUNT_PORTFOLIO}                xpath=//*[@resource-id='account_portfolio' or @name='account_portfolio' or @content-desc='account_portfolio']
${ALGO_HOLDING_ROW}                 xpath=//*[@resource-id='asset_row_0' or @name='asset_row_0' or @content-desc='asset_row_0']

# Containers, icons and the drawer search trigger carry their testID without an accessibility
# label, so Android exposes it only as resource-id and iOS only as name.
${DRAWER_SEARCH_BUTTON}             xpath=//*[@resource-id='account_drawer_search_button' or @name='account_drawer_search_button']
${ADD_ACCOUNT_CLOSE_BUTTON}         xpath=//*[@resource-id='add_account_close_button' or @name='add_account_close_button']
${PASSPHRASE_GRID}                  xpath=//*[@resource-id='view_passphrase_bottom_sheet_grid' or @name='view_passphrase_bottom_sheet_grid']
${NODE_CHAIN_NETWORKS}              xpath=//*[@resource-id='node_settings_chain_networks' or @name='node_settings_chain_networks']
${SWITCHER_ROWS}                    xpath=//*[starts-with(@content-desc, 'account_switcher_row_') or starts-with(@resource-id, 'account_switcher_row_') or starts-with(@name,'account_switcher_row_')]
# The watch intro's only button has no testID.
${WATCH_INFO_CREATE_BUTTON}         xpath=//*[@text='Create a Watch Account' or @label='Create a Watch Account']


${OPTION_ALGORAND_EXPAND}           xpath=//*[@resource-id='account_network_algorand_expand' or @name='account_network_algorand_expand' or @content-desc='account_network_algorand_expand']


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
    RETURN    xpath=//*[@resource-id='account_switcher_row_${address}' or @name='account_switcher_row_${address}' or @content-desc='account_switcher_row_${address}']

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
    [Documentation]    Leaves the app on Home with the switcher closed.
    Go Home
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
    ${offered}=    Run Keyword And Return Status
    ...    Page Should Contain Element    ${ADD_ACCOUNT_ADD_BUTTON}
    # The tap lands - Click Element reports success and the button is on screen and enabled - and
    # the screen simply stays. Waiting it out for a minute found nothing on the way; a second tap
    # opens it at once, and the cases that follow inherited the missing account as their own failure.
    IF    ${offered}
        Tap Until    ${ADD_ACCOUNT_ADD_BUTTON}    ${ACCOUNT_FINISH_BUTTON}    timeout=30s
    ELSE
        Tap Until    ${ADD_ACCOUNT_UNIVERSAL_BUTTON}    ${ACCOUNT_FINISH_BUTTON}    timeout=30s
    END
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
    RETURN    xpath=//*[@resource-id='${PASSPHRASE_ACK_ROW_ID}${index}' or @name='${PASSPHRASE_ACK_ROW_ID}${index}' or @content-desc='${PASSPHRASE_ACK_ROW_ID}${index}']

Acknowledge And Reveal Passphrase
    [Documentation]    Checks the four acknowledgement rows and opens the passphrase behind them.
    ...
    ...                Reveal is disabled until every row is checked, and the tap that followed the
    ...                fourth row went out before React had re-rendered it: it landed on a disabled
    ...                button, reported success, and the sheet stayed. "The grid did not appear in
    ...                20 seconds" was the only thing that said so - and in the accounts suite the
    ...                two cases after it then failed on the account this one never got to make.
    ...
    ...                So wait for the app's own gate instead. If that times out, a row's tap is
    ...                what went missing, and the failure says that rather than naming the grid.
    Wait Until Settled    ${PASSPHRASE_ACK_REVEAL}
    FOR    ${index}    IN RANGE    4
        ${row}=    Passphrase Ack Row    ${index}
        Tap    ${row}
    END
    Wait Until Keyword Succeeds    10s    0.5s
    ...    Element Should Be Enabled    ${PASSPHRASE_ACK_REVEAL}
    Tap Until    ${PASSPHRASE_ACK_REVEAL}    ${PASSPHRASE_GRID}    timeout=20s

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
