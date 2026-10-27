*** Settings ***
Resource            app.resource


*** Variables ***
# Recovery phrases come from the environment only; cases that need one skip when it is unset.
${MNEMONIC_24}                          %{MNEMONIC_24_WORD=}
${MNEMONIC_25}                          %{MNEMONIC_25_WORD=}
${MNEMONIC_24_REKEYED}                  %{MNEMONIC_24_REKEYED_ACCOUNT=}

${WALLET_NAME}                          E2E Onboarding
# A public address with no key on the device; watching it needs no funds or secrets.
${WATCH_ADDRESS}                        UUZB34HTTJ6GM2XB44YSL333AWASFH7K3HSAK7R2AOJ4POGUXQSZIUM5XM

${IMPORT_ACCOUNT_BUTTON}                tid=onboarding_import_account_button
${ACCOUNT_SELECTION_BUTTON}             tid=account_selection_button
${ACCOUNT_MENU_ADD_BUTTON}              tid=account_menu_add_account_button
${ACCOUNT_OPTION_COPY_ADDRESS}          tid=account_network_algorand_copy
# Every wallet account offers rename, whatever its chains; a multi-chain build can fold Algorand's
# network row behind "See all", so that row cannot mark the sheet as open.
${ACCOUNT_OPTION_RENAME}                tid=account_option_rename-account
${ACCOUNT_ALGORAND_EXPAND}              tid=account_network_algorand_expand
# The switcher row and the header trigger take their testID as accessibility label, which on iOS
# hides the account name inside them; only the options sheet's title shows it on both platforms.
${ACCOUNT_SWITCHER_ROW_ANY}             xpath=//*[starts-with(@content-desc,'account_switcher_row_') or starts-with(@resource-id, 'account_switcher_row_') or starts-with(@name,'account_switcher_row_')]
${MORE_BUTTON}                          tid=more_button
${SCAN_REKEYED_OPTION}                  tid=account_option_scan-rekeyed
${RESCAN_ADD_BUTTON}                    tid=rescan-rekeyed-add
${RESCAN_SKIP_BUTTON}                   tid=rescan-rekeyed-skip

${ADD_ACCOUNT_ADD_BUTTON}               tid=add_account_add_button
${ADD_ACCOUNT_IMPORT_BUTTON}            tid=add_account_import_button
${ADD_ACCOUNT_SEE_OTHER_OPTIONS}        tid=add_account_see_other_options_button
${ADD_ACCOUNT_WATCH_BUTTON}             tid=add_account_watch_button
${ADD_ACCOUNT_ALGO25_BUTTON}            tid=add_account_create_algo25_button
# PWIcon and PWView pass testID through without an accessibility label, so Android exposes these
# only as resource-id and iOS only as name.
${ADD_ACCOUNT_CLOSE_BUTTON}             tid=add_account_close_button
${CONFETTI}                             tid=confetti_animation
${REMOVE_ALL_SUCCESS_SHEET}             tid=settings_delete_all_success_bottom_sheet

${IMPORT_OPTION_RECOVER_WALLET}         tid=import_account_options_recover_wallet_button
${IMPORT_OPTION_RECOVER_QR}             tid=import_account_options_recover_qr_button
${IMPORT_OPTION_PAIR_LEDGER}            tid=import_account_options_pair_ledger_button
${IMPORT_OPTION_PERA_WEB}               tid=import_account_options_pera_web_button
${IMPORT_OPTION_ASB}                    tid=import_account_options_asb_button
${RECOVER_UNIVERSAL_WALLET}             tid=import_options_hd_wallet_button
${RECOVER_ALGO25}                       tid=import_options_algo25_button
${IMPORT_INFO_RECOVER_BUTTON}           tid=import_info_recover_button
${WORD_INPUT_0}                         tid=import_account_word_input_0
${IMPORT_ACCOUNT_IMPORT_BUTTON}         tid=import_account_import_button
${SELECT_ADDRESSES_CONTINUE}            tid=import_select_addresses_continue_button
${SELECT_ADDRESSES_ALL}                 tid=import_select_addresses_select_all_checkbox
${REKEYED_CONTINUE}                     tid=import_rekeyed_addresses_continue_button
${REKEYED_SKIP}                         tid=import_rekeyed_addresses_skip_button
${REKEYED_CHECKBOX_ANY}                 xpath=//*[starts-with(@content-desc,'import_rekeyed_addresses_item_checkbox_') or starts-with(@resource-id, 'import_rekeyed_addresses_item_checkbox_') or starts-with(@name,'import_rekeyed_addresses_item_checkbox_')]
${ASB_INFO_CONTINUE}                    tid=asb_import_info_continue_button
${ASB_PICK_FILE_BUTTON}                 tid=asb_import_backup_pick_file_button
${LEDGER_PAIR_START_BUTTON}             tid=ledger_pair_primary_button
${LEDGER_PAIR_INFO_BUTTON}              tid=ledger_pair_info_button

${WATCH_INFO_CREATE_BUTTON}             tid=watch_info_create_button
${WATCH_ADDRESS_INPUT}                  tid=watch_account_address_input
${WATCH_SUBMIT_BUTTON}                  tid=watch_account_submit_button

${MENU_SETTINGS_BUTTON}                 tid=menu_settings_button
${SETTINGS_DEVELOPER_ITEM}              tid=settings_item_developer_settings
${REMOVE_ALL_ACCOUNTS_BUTTON}           tid=settings_remove_all_accounts_button
${REMOVE_ALL_CONFIRM_BUTTON}            tid=settings_delete_all_confirm_button
${DEVELOPER_NODE_ITEM}                  tid=developer_settings_node_item
${NODE_DEV_MODE_SWITCH}                 tid=node_settings_developer_mode_switch
${NODE_TESTNET_RADIO}                   tid=node_settings_algorand_testnet_radio


*** Keywords ***
Start Without Wallet
    [Documentation]    Welcome screen with no wallet on the device. An existing wallet is removed
    ...                through Settings > Remove all accounts, the app's own wipe of keys, database
    ...                and stores, which behaves the same on both platforms and keeps the install.
    Restart Pera
    Wait Until Page Contains Element    ${FIRST_SCREEN}    timeout=30s
    Dismiss Dev Client Intro
    Unlock With Known Pins
    ${welcome}=    Is Shown    ${CREATE_WALLET_BUTTON}
    IF    ${welcome}    RETURN
    Wait Clear Of Startup Prompts
    Remove All Accounts

Start With New Wallet
    Start Without Wallet
    Create Wallet Named    ${WALLET_NAME}
    Wait Clear Of Startup Prompts

Create Wallet Named
    [Arguments]    ${name}
    Tap    ${CREATE_WALLET_BUTTON}
    Accept Terms Until    ${ACCOUNT_NAME_INPUT}
    Clear Text    ${ACCOUNT_NAME_INPUT}
    Input Text    ${ACCOUNT_NAME_INPUT}    ${name}
    Dismiss Keyboard
    Tap    ${ACCOUNT_FINISH_BUTTON}
    Wait Until Page Contains Element    ${MENU_TAB}    timeout=60s

Accept Terms Until
    [Documentation]    The terms sheet shows only while the current terms are unaccepted, so wait for
    ...                whichever comes first rather than paying a timeout when it does not.
    [Arguments]    ${anchor}
    FOR    ${i}    IN RANGE    60
        ${arrived}=    Is Shown    ${anchor}
        IF    ${arrived}    RETURN
        ${terms}=    Is Shown    ${TERMS_AGREE_BUTTON}
        IF    ${terms}
            Wait Until Settled    ${TERMS_AGREE_BUTTON}
            Click Element    ${TERMS_AGREE_BUTTON}
        END
        Sleep    0.5s
    END
    Fail    Neither the terms sheet nor ${anchor} appeared.

Open Import Options From Welcome
    Tap    ${IMPORT_ACCOUNT_BUTTON}
    Accept Terms Until    ${IMPORT_OPTION_RECOVER_WALLET}

Enter Recovery Phrase For
    [Documentation]    From the import options screen to a submitted phrase. Takes the NAME of the
    ...                environment variable holding the phrase and reads it with logging off, so the
    ...                phrase never appears as a resolved argument, even at TRACE.
    [Arguments]    ${phrase_type}    ${phrase_env}
    Tap    ${IMPORT_OPTION_RECOVER_WALLET}
    Wait Until Settled    ${phrase_type}
    Tap    ${phrase_type}
    Wait Until Page Contains Element    ${IMPORT_INFO_RECOVER_BUTTON}    timeout=20s
    Tap    ${IMPORT_INFO_RECOVER_BUTTON}
    Wait Until Page Contains Element    ${WORD_INPUT_0}    timeout=20s
    ${level}=    Set Log Level    NONE
    TRY
        Enter Recovery Phrase    %{${phrase_env}}
    FINALLY
        Set Log Level    ${level}
    END
    Dismiss Keyboard
    Tap    ${IMPORT_ACCOUNT_IMPORT_BUTTON}

Finish Import
    [Documentation]    Walks whichever post-import screens the phrase produces (address selection,
    ...                rekeyed accounts, naming, startup prompts) until Home. Every import ends on the
    ...                naming screen, and Home only counts once that has been passed: on iOS the tab
    ...                bar of a wallet that already exists stays in the tree under the import flow.
    ...                Returns whether the rekeyed screen and the confetti were seen on the way.
    [Arguments]    ${rekeyed}=import
    VAR    ${named}    ${False}
    VAR    ${saw_rekeyed}    ${False}
    VAR    ${saw_confetti}    ${False}
    FOR    ${i}    IN RANGE    240
        Tap If Present    ${PIN_PROMPT_DONT_ASK}
        Tap If Present    ${BANNERS_MODAL_CLOSE}
        ${confetti}=    Is Shown    ${CONFETTI}
        IF    ${confetti}    VAR    ${saw_confetti}    ${True}
        ${select}=    Is Shown    ${SELECT_ADDRESSES_CONTINUE}
        IF    ${select}    Continue With Selected Addresses
        ${rekeyed_screen}=    Is Shown    ${REKEYED_CONTINUE}
        IF    ${rekeyed_screen}
            VAR    ${saw_rekeyed}    ${True}
            Leave Rekeyed Addresses    ${rekeyed}
        END
        ${naming}=    Is Shown    ${ACCOUNT_FINISH_BUTTON}
        IF    ${naming}
            Tap    ${ACCOUNT_FINISH_BUTTON}
            VAR    ${named}    ${True}
            Run Keyword And Ignore Error
            ...    Wait Until Page Does Not Contain Element    ${ACCOUNT_FINISH_BUTTON}    timeout=10s
            CONTINUE
        END
        ${home}=    Is Shown    ${MENU_TAB}
        IF    ${home} and ${named}    RETURN    ${saw_rekeyed}    ${saw_confetti}
        Sleep    0.5s
    END
    Fail    The import never reached Home.

Continue With Selected Addresses
    ${ready}=    Run Keyword And Return Status
    ...    Expect Element    ${SELECT_ADDRESSES_CONTINUE}    enabled    timeout=0s    loglevel=NONE
    IF    not ${ready}    Tap    ${SELECT_ADDRESSES_ALL}
    Expect Element    ${SELECT_ADDRESSES_CONTINUE}    enabled    timeout=3s    retry_interval=0.5s    loglevel=NONE
    Tap    ${SELECT_ADDRESSES_CONTINUE}
    Run Keyword And Ignore Error
    ...    Wait Until Page Does Not Contain Element    ${SELECT_ADDRESSES_CONTINUE}    timeout=10s

Leave Rekeyed Addresses
    [Arguments]    ${choice}
    IF    $choice == 'skip'
        Tap    ${REKEYED_SKIP}
    ELSE
        ${ready}=    Run Keyword And Return Status
        ...    Expect Element    ${REKEYED_CONTINUE}    enabled    timeout=0s    loglevel=NONE
        IF    not ${ready}    Tap    ${REKEYED_CHECKBOX_ANY}
        Expect Element    ${REKEYED_CONTINUE}    enabled    timeout=3s    retry_interval=0.5s    loglevel=NONE
        Tap    ${REKEYED_CONTINUE}
    END
    Run Keyword And Ignore Error
    ...    Wait Until Page Does Not Contain Element    ${REKEYED_CONTINUE}    timeout=10s

Import From Welcome
    [Documentation]    Fresh device to Home with the phrase's wallet imported.
    [Arguments]    ${phrase_type}    ${phrase_env}    ${rekeyed}=import
    Start Without Wallet
    Open Import Options From Welcome
    Enter Recovery Phrase For    ${phrase_type}    ${phrase_env}
    ${saw_rekeyed}    ${saw_confetti}=    Finish Import    ${rekeyed}
    RETURN    ${saw_rekeyed}    ${saw_confetti}

Open Add Account
    Tap    ${ACCOUNT_SELECTION_BUTTON}
    Wait Until Settled    ${ACCOUNT_MENU_ADD_BUTTON}
    Tap    ${ACCOUNT_MENU_ADD_BUTTON}
    Wait Until Page Contains Element    ${ADD_ACCOUNT_IMPORT_BUTTON}    timeout=20s

Reveal Other Add Account Options
    Scroll Into View    add_account_see_other_options_button
    Tap    ${ADD_ACCOUNT_SEE_OTHER_OPTIONS}
    # The toggle unmounts once the options show, so its absence proves the tap landed.
    Wait Until Page Does Not Contain Element    ${ADD_ACCOUNT_SEE_OTHER_OPTIONS}    timeout=10s

Name Account And Finish
    [Arguments]    ${name}
    Wait Until Page Contains Element    ${ACCOUNT_NAME_INPUT}    timeout=60s
    Clear Text    ${ACCOUNT_NAME_INPUT}
    Input Text    ${ACCOUNT_NAME_INPUT}    ${name}
    Dismiss Keyboard
    Tap    ${ACCOUNT_FINISH_BUTTON}
    Wait Until Page Does Not Contain Element    ${ACCOUNT_FINISH_BUTTON}    timeout=30s
    Wait Until Page Contains Element    ${ACCOUNT_SELECTION_BUTTON}    timeout=30s

Selected Account Should Be Named
    [Documentation]    The account-options sheet is titled with the selected account's name.
    [Arguments]    ${name}
    Wait Until Page Contains Element    ${MORE_BUTTON}    timeout=30s
    # While a new account's overview loads, a skeleton overlay (no testID) covers the button panel and
    # takes taps without effect, so tap until the sheet opens.
    Wait Until Keyword Succeeds    30s    0.5s    Open Account Options Sheet
    Wait Until Settled    ${ACCOUNT_OPTION_RENAME}
    Wait Until Page Contains    ${name}    timeout=10s

Open Account Options Sheet
    Tap    ${MORE_BUTTON}
    Wait Until Page Contains Element    ${ACCOUNT_OPTION_RENAME}    timeout=2s

Open Rescan For Rekeyed Accounts
    Wait Until Page Contains Element    ${MORE_BUTTON}    timeout=30s
    Tap    ${MORE_BUTTON}
    Wait Until Settled    ${ACCOUNT_ALGORAND_EXPAND}
    Tap    ${ACCOUNT_ALGORAND_EXPAND}
    Wait Until Settled    ${SCAN_REKEYED_OPTION}
    Tap    ${SCAN_REKEYED_OPTION}

Open Node Settings
    Tap    ${MENU_TAB}
    Wait Until Page Contains Element    ${MENU_SETTINGS_BUTTON}    timeout=15s
    Tap    ${MENU_SETTINGS_BUTTON}
    Scroll Until Present    ${SETTINGS_DEVELOPER_ITEM}
    Tap    ${SETTINGS_DEVELOPER_ITEM}
    Wait Until Page Contains Element    ${DEVELOPER_NODE_ITEM}    timeout=15s
    Tap    ${DEVELOPER_NODE_ITEM}
    Wait Until Page Contains Element    ${NODE_DEV_MODE_SWITCH}    timeout=15s

Is Shown
    [Arguments]    ${locator}
    ${shown}=    Run Keyword And Return Status    Page Should Contain Element    ${locator}
    RETURN    ${shown}

Capture Screenshot Unless Showing
    [Documentation]    A failure screenshot taken on a screen that displays a recovery phrase would
    ...                put it in the run's artifacts, so those screens are never captured.
    [Arguments]    @{secret_screens}
    FOR    ${anchor}    IN    @{secret_screens}
        ${secret}=    Is Shown    ${anchor}
        IF    ${secret}
            Log    Screenshot skipped: a recovery phrase is on screen.
            RETURN
        END
    END
    Capture Page Screenshot
