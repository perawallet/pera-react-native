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
${ADD_ACCOUNT_MULTICHAIN_BUTTON}    tid=add_account_options_multichain_button
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
${PORTFOLIO_PRIMARY_VALUE}          tid=portfolio_primary_value

# Containers, icons and the drawer search trigger carry their testID without an accessibility
# label, so Android exposes it only as resource-id and iOS only as name.
${DRAWER_SEARCH_BUTTON}             tid=account_drawer_search_button
${ADD_ACCOUNT_CLOSE_BUTTON}         tid=add_account_close_button
${PASSPHRASE_GRID}                  tid=view_passphrase_bottom_sheet_grid
# The sheet around the grid. It is up while the phrase is still being fetched and while the sheet
# is showing its error box, neither of which carries a testID of its own.
${PASSPHRASE_SHEET}                 tid=view_passphrase_bottom_sheet
${NODE_CHAIN_NETWORKS}              tid=node_settings_chain_networks
${SWITCHER_ROWS}                    xpath=//*[starts-with(@content-desc, 'account_switcher_row_') or starts-with(@resource-id, 'account_switcher_row_') or starts-with(@name,'account_switcher_row_')]
${WATCH_INFO_CREATE_BUTTON}         tid=watch_info_create_button


${OPTION_ALGORAND_EXPAND}           tid=account_network_algorand_expand
# Rendered only for an account that is on Ethereum; a not-yet-added network shows _add instead.
${OPTION_ETHEREUM_COPY}             tid=account_network_ethereum_copy
${OPTION_ETHEREUM_ADD}              tid=account_network_ethereum_add
${OPTION_ETHEREUM_QR}               tid=account_network_ethereum_qr
${OPTION_ETHEREUM_ROW}              tid=account_network_ethereum
${OPTION_ALGORAND_QR}               tid=account_network_algorand_qr
${OPTION_ALGORAND_MIN_BALANCE}      tid=account_algorand_min_balance
${OPTION_REKEY}                     tid=account_option_rekey-account
${OPTION_ETHEREUM_EXPAND}           tid=account_network_ethereum_expand
${OPTION_TOKEN_APPROVALS}           tid=account_option_token-approvals
${TOKEN_APPROVALS_SCREEN}           tid=token_approvals_screen
${TOKEN_APPROVALS_RETRY}            tid=token_approvals_retry
# An account with no approvals shows the empty state; one with approvals, their spender rows.
${TOKEN_APPROVALS_LOADED}           xpath=//*[@text='No open approvals' or @label='No open approvals' or starts-with(@content-desc,'token_approval_spender_') or starts-with(@resource-id,'token_approval_spender_') or starts-with(@name,'token_approval_spender_') or @name='token_approvals_retry' or @resource-id='token_approvals_retry' or @content-desc='token_approvals_retry']
${NETWORKS_TITLE}                   tid=account_networks_title
${ETHEREUM_OFFERED}                 ${None}
# Networks the account could be on but is not yet are folded behind this row.
${NETWORKS_SEE_ALL}                 tid=account_networks_see_all
${ETHEREUM_ROW_OR_SEE_ALL}          xpath=//*[@name='account_network_ethereum' or @resource-id='account_network_ethereum' or @content-desc='account_network_ethereum' or @name='account_networks_see_all' or @resource-id='account_networks_see_all' or @content-desc='account_networks_see_all']
${ACCOUNT_TYPE_INFO_LEARN_MORE}     tid=account-type-info-learn-more-button
# The toggle carries no testID.
${SEE_WALLET_STRUCTURE}             xpath=//*[@text='See wallet structure' or @label='See wallet structure']
${STRUCTURE_ROW_ANY}                xpath=//*[starts-with(@content-desc,'account_structure_row_') or starts-with(@resource-id,'account_structure_row_') or starts-with(@name,'account_structure_row_')]
${STRUCTURE_ETHEREUM_ICON}          tid=chain_icon_stack_ethereum

# Shown only for an account on two or more chains.
${ASSET_NETWORK_FILTER}             tid=asset_network_filter
${ASSET_NETWORK_FILTER_ALL}         tid=asset_network_filter_all
${ASSET_NETWORK_FILTER_ALGORAND}    tid=asset_network_filter_algorand
${ASSET_NETWORK_FILTER_ETHEREUM}    tid=asset_network_filter_ethereum


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
    [Documentation]    Creates a key account in the current wallet; it becomes the selected one. The
    ...                multichain row derives from the HD wallet, or starts one when there is none.
    Open Account Switcher
    Tap    ${ACCOUNT_MENU_ADD_BUTTON}
    Wait Until Page Contains Element    ${ADD_ACCOUNT_IMPORT_BUTTON}    timeout=20s
    # The tap lands - Click Element reports success and the button is on screen and enabled - and
    # the screen simply stays. Waiting it out for a minute found nothing on the way; a second tap
    # opens it at once, and the cases that follow inherited the missing account as their own failure.
    Tap Until    ${ADD_ACCOUNT_ADD_BUTTON}    ${ADD_ACCOUNT_MULTICHAIN_BUTTON}    timeout=20s
    Tap Until    ${ADD_ACCOUNT_MULTICHAIN_BUTTON}    ${ACCOUNT_FINISH_BUTTON}    timeout=30s
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
    ...                An account on Algorand alone opens that row expanded, where a tap would fold it.
    [Arguments]    ${option}
    Open Account Options
    ${expanded}=    Run Keyword And Return Status    Page Should Contain Element    ${option}
    IF    not ${expanded}
        Scroll Until Tappable    ${OPTION_ALGORAND_EXPAND}
        Tap    ${OPTION_ALGORAND_EXPAND}
    END
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

Ensure Account On Ethereum
    [Documentation]    Leaves the account options open with the selected account on Ethereum, adding
    ...                the network when the build offers it and skipping when it does not. What a
    ...                multichain screen lacks cannot tell a build without Ethereum from a broken
    ...                screen; this sheet can.
    Skip If    $ETHEREUM_OFFERED is False
    ...    The account cannot be put on Ethereum: this build is not multichain (CHAINS without ethereum).
    Open Account Options
    # Android lists only what is on screen, so the row is scrolled to before its absence counts.
    ${offered}=    Run Keyword And Return Status    Scroll Until Present    ${ETHEREUM_ROW_OR_SEE_ALL}
    # Scrolling the whole sheet to find nothing is slow, and a build does not change mid-run. Only
    # key accounts come here, which can all go on Ethereum where the build ships it.
    Set Global Variable    ${ETHEREUM_OFFERED}    ${offered}
    Skip If    not ${offered}
    ...    The account cannot be put on Ethereum: this build is not multichain (CHAINS without ethereum).
    ${folded}=    Run Keyword And Return Status    Page Should Contain Element    ${NETWORKS_SEE_ALL}
    IF    ${folded}
        Scroll Until Tappable    ${NETWORKS_SEE_ALL}
        Tap    ${NETWORKS_SEE_ALL}
        Wait Until Page Contains Element    ${OPTION_ETHEREUM_ROW}    timeout=10s
    END
    ${addable}=    Run Keyword And Return Status    Page Should Contain Element    ${OPTION_ETHEREUM_ADD}
    IF    ${addable}
        Scroll Until Tappable    ${OPTION_ETHEREUM_ADD}
        Tap    ${OPTION_ETHEREUM_ADD}
        # Deriving the Ethereum key can ask for the PIN.
        Unlock With Known Pins
    END
    Wait Until Page Contains Element    ${OPTION_ETHEREUM_COPY}    timeout=60s

Options Should Offer No Key Actions
    [Documentation]    With the account options open: nothing to reveal, rekey or derive Ethereum from.
    Page Should Not Contain Element    ${OPTION_ETHEREUM_ROW}
    Page Should Not Contain Element    ${NETWORKS_SEE_ALL}
    Page Should Not Contain Element    ${OPTION_VIEW_PASSPHRASE}
    Page Should Not Contain Element    ${OPTION_REKEY}

Select Another Account Than
    [Documentation]    From Home, selects the first account in the switcher that is not ${address}.
    [Arguments]    ${address}
    Open Account Switcher
    @{addresses}=    Switcher Addresses
    FOR    ${candidate}    IN    @{addresses}
        IF    $candidate != $address
            ${row}=    Switcher Row    ${candidate}
            Tap    ${row}
            Wait Until Switcher Closed
            RETURN
        END
    END
    Go Home

Receive Should Show Address
    [Documentation]    The receive screen prints the selected account's full address.
    [Arguments]    ${address}
    Tap    ${RECEIVE_BUTTON}
    Choose Algorand If Asked    receive    ${RECEIVE_COPY_ADDRESS_BUTTON}
    Wait Until Page Contains    ${address}    timeout=10s

Choose Algorand If Asked
    [Documentation]    Send and Receive open on a network picker when the account could use more
    ...                than one chain, as on a multichain build. Algorand is picked by chain id, not
    ...                as the first row: these flows assert Algorand behaviour.
    [Arguments]    ${flow}    ${next}
    ${row}=    Set Variable    ${flow}_chain_row_algorand
    ${next_id}=    Bare Test Id    ${next}
    Wait Until Page Contains Element
    ...    xpath=//*[@name='${row}' or @resource-id='${row}' or @content-desc='${row}' or @name='${next_id}' or @resource-id='${next_id}' or @content-desc='${next_id}']
    ...    timeout=20s
    ${asked}=    Run Keyword And Return Status    Page Should Contain Element    tid=${row}
    IF    ${asked}
        Wait Until Settled    tid=${row}
        Tap Until    tid=${row}    ${next}    timeout=20s
    END

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
    Reveal The Passphrase

Reveal The Passphrase
    [Documentation]    Taps Reveal, and says which of three things went wrong when no grid follows.
    ...
    ...                The sheet holding the phrase renders three ways and only one of them is
    ...                addressable: the grid. While the mnemonic is being fetched it draws a
    ...                spinner, and when that fails it draws an error box - neither carries a
    ...                testID. So "the grid did not appear in 20 seconds" covered the flow never
    ...                opening, the flow opening and failing to produce the phrase, and the tap
    ...                doing nothing: three bugs in three different places, reported identically.
    ...
    ...                The container does carry a testID, which separates them. The grid itself
    ...                arrives in half a second or not at all - 32 passing runs, none above 0.5s -
    ...                so a wait that expires is never a slow render, and raising it would only
    ...                make the wrong answer take longer.
    FOR    ${attempt}    IN RANGE    3
        Tap    ${PASSPHRASE_ACK_REVEAL}
        ${shown}=    Run Keyword And Return Status
        ...    Wait Until Page Contains Element    ${PASSPHRASE_GRID}    timeout=20s
        IF    ${shown}    RETURN
        ${sheet_up}=    Run Keyword And Return Status
        ...    Page Should Contain Element    ${PASSPHRASE_SHEET}
        IF    ${sheet_up}
            Fail    The passphrase sheet opened and showed no words in 20s: the app is still fetching the mnemonic, or has drawn its error box.
        END
        ${still_offered}=    Run Keyword And Return Status
        ...    Page Should Contain Element    ${PASSPHRASE_ACK_REVEAL}
        IF    not ${still_offered}
            Fail    Reveal was acted on - the acknowledgement sheet is gone - but no passphrase sheet followed it.
        END
        Log    Reveal did not open the passphrase sheet; tapping it again.    level=WARN
    END
    Fail    Reveal did not open the passphrase sheet over three taps.

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
