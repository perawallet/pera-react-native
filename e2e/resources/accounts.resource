*** Settings ***
Library             Collections
Resource            app.resource


*** Variables ***
${ACCOUNT_SELECTION_BUTTON}         accessibility_id=account_selection_button
${MORE_BUTTON}                      accessibility_id=more_button
${RECEIVE_BUTTON}                   accessibility_id=receive_button
${RECEIVE_COPY_ADDRESS_BUTTON}      accessibility_id=receive_copy_address_button
${RECEIVE_SHARE_ADDRESS_BUTTON}     accessibility_id=receive_share_address_button

${MENU_SETTINGS_BUTTON}             accessibility_id=menu_settings_button
${MENU_STAKING_BUTTON}              accessibility_id=menu_staking_button
${MENU_CONTACTS_BUTTON}             accessibility_id=menu_contacts_button
${SETTINGS_SECURITY_ITEM}           accessibility_id=settings_item_security
${SETTINGS_DEVELOPER_ITEM}          accessibility_id=settings_item_developer_settings
${DEVELOPER_NODE_ITEM}              accessibility_id=developer_settings_node_item
${NODE_DEVELOPER_MODE_SWITCH}       accessibility_id=node_settings_developer_mode_switch
${NODE_TESTNET_RADIO}               accessibility_id=node_settings_algorand_testnet_radio

${ACCOUNT_MENU_ADD_BUTTON}          accessibility_id=account_menu_add_account_button
${ADD_ACCOUNT_IMPORT_BUTTON}        accessibility_id=add_account_import_button
${ADD_ACCOUNT_ADD_BUTTON}           accessibility_id=add_account_add_button
${ADD_ACCOUNT_UNIVERSAL_BUTTON}     accessibility_id=add_account_create_universal_wallet_button
${ADD_ACCOUNT_SEE_OTHER_BUTTON}     accessibility_id=add_account_see_other_options_button
${ADD_ACCOUNT_WATCH_BUTTON}         accessibility_id=add_account_watch_button
${WATCH_ADDRESS_INPUT}              accessibility_id=watch_account_address_input
${WATCH_SUBMIT_BUTTON}              accessibility_id=watch_account_submit_button

${ACCOUNT_TYPE_INFO_BUTTON}         accessibility_id=account-type-info-button
${OPTION_COPY_ADDRESS}              accessibility_id=account_option_copy-address
${OPTION_RENAME}                    accessibility_id=account_option_rename-account
${OPTION_REMOVE}                    accessibility_id=account_option_remove-account
${OPTION_VIEW_PASSPHRASE}           accessibility_id=account_option_view-passphrase
${RENAME_INPUT}                     accessibility_id=rename_account_input
${RENAME_SAVE_BUTTON}               accessibility_id=rename_account_save_button
${REMOVE_BACKUP_CONTINUE_BUTTON}    accessibility_id=remove_account_backup_continue_button
${REMOVE_CONFIRM_BUTTON}            accessibility_id=remove_account_confirm_button
${REMOVE_CANCEL_BUTTON}             accessibility_id=remove_account_cancel_button
${PASSPHRASE_ACK_REVEAL}            accessibility_id=passphrase_acknowledge_bottom_sheet_reveal
${PASSPHRASE_ACK_ROW}               accessibility_id=passphrase_acknowledge_bottom_sheet_row_
${REMOVE_NEXT_STEP}                 xpath=//*[@content-desc='remove_account_backup_continue_button' or @name='remove_account_backup_continue_button' or @content-desc='remove_account_confirm_button' or @name='remove_account_confirm_button']

${ACCOUNT_PORTFOLIO}                accessibility_id=account_portfolio
${ALGO_HOLDING_ROW}                 accessibility_id=asset_row_0

# Containers, icons and the drawer search trigger carry their testID without an accessibility
# label, so Android exposes it only as resource-id and iOS only as name.
${DRAWER_SEARCH_BUTTON}             xpath=//*[@resource-id='account_drawer_search_button' or @name='account_drawer_search_button']
${DRAWER_CONTENT_SLIVER}            xpath=//*[@resource-id='pw_drawer_gesture_surface' or @name='pw_drawer_gesture_surface']
${ADD_ACCOUNT_CLOSE_BUTTON}         xpath=//*[@resource-id='add_account_close_button' or @name='add_account_close_button']
${PASSPHRASE_GRID}                  xpath=//*[@resource-id='view_passphrase_bottom_sheet_grid' or @name='view_passphrase_bottom_sheet_grid']
${NODE_CHAIN_NETWORKS}              xpath=//*[@resource-id='node_settings_chain_networks' or @name='node_settings_chain_networks']
${SWITCHER_ROWS}                    xpath=//*[starts-with(@content-desc,'account_switcher_row_') or starts-with(@name,'account_switcher_row_')]
# The watch intro's only button has no testID.
${WATCH_INFO_CREATE_BUTTON}         xpath=//*[@text='Create a Watch Account' or @label='Create a Watch Account']


*** Keywords ***
Open Account Switcher
    Wait Until Page Contains Element    ${ACCOUNT_SELECTION_BUTTON}    timeout=30s
    Tap    ${ACCOUNT_SELECTION_BUTTON}
    Wait Until Settled    ${ACCOUNT_MENU_ADD_BUTTON}

Close Account Switcher
    [Documentation]    The switcher is a drawer with no close control; tapping the content it
    ...                slides aside dismisses it.
    Tap    ${DRAWER_CONTENT_SLIVER}
    Wait Until Switcher Closed

Wait Until Switcher Closed
    # The closed panel stays mounted, so its buttons do not leave the tree; the sliver does.
    Wait Until Page Does Not Contain Element    ${DRAWER_CONTENT_SLIVER}    timeout=10s

Switcher Row
    [Arguments]    ${address}
    RETURN    accessibility_id=account_switcher_row_${address}

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
    ${added}=    Tap If Present    ${ADD_ACCOUNT_ADD_BUTTON}
    IF    not ${added}    Tap    ${ADD_ACCOUNT_UNIVERSAL_BUTTON}
    Wait Until Page Contains Element    ${ACCOUNT_FINISH_BUTTON}    timeout=60s
    Tap    ${ACCOUNT_FINISH_BUTTON}
    Wait Until Page Contains Element    ${MORE_BUTTON}    timeout=60s
    # The PIN prompt and banners can come back after an account is added.
    Wait Clear Of Startup Prompts

Ensure Two Accounts
    ${count}=    Count Accounts
    IF    ${count} < 2    Add Account To Wallet

Open Account Options
    Wait Until Page Contains Element    ${MORE_BUTTON}    timeout=30s
    Tap    ${MORE_BUTTON}
    Wait Until Settled    ${OPTION_COPY_ADDRESS}

Scroll Until Tappable
    [Documentation]    Swipes up until the element's centre, where a tap lands, is inside the window.
    ...                A row below the fold can be in the tree and report itself displayed, and
    ...                tapping it there lands on whatever is at its off-screen coordinates instead.
    [Arguments]    ${locator}
    ${height}=    Get Window Height
    FOR    ${i}    IN RANGE    6
        ${present}=    Run Keyword And Return Status    Page Should Contain Element    ${locator}
        IF    ${present}
            ${location}=    Get Element Location    ${locator}
            ${size}=    Get Element Size    ${locator}
            IF    ${location}[y] + ${size}[height] / 2 < ${height} * 0.95    RETURN
        END
        Swipe By Percent    50    75    50    35    duration=600ms
    END
    Fail    ${locator} never scrolled into view.

Open Account Option
    [Arguments]    ${option}
    Open Account Options
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
    Wait Until Page Contains Element    ${ACCOUNT_FINISH_BUTTON}    timeout=30s
    Tap    ${ACCOUNT_FINISH_BUTTON}
    Wait Until Page Contains Element    ${MORE_BUTTON}    timeout=60s
    Wait Clear Of Startup Prompts
    Go Home
    Open Account Switcher
    Tap    ${row}
    Wait Until Switcher Closed
