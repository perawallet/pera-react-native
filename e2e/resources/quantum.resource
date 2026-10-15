*** Settings ***
Documentation       Quantum (Falcon-1024) accounts, plus the account-switcher, account-options and
...                 passphrase keywords the quantum and rekey suites share. Quantum Accounts are gated
...                 by the quantumAccounts capability, so the gates skip on a build with it off but fail
...                 when the surrounding screen is missing too.
Resource            app.resource


*** Variables ***
${MORE_BUTTON}                      accessibility_id=more_button
${ACCOUNT_SELECTION_BUTTON}         accessibility_id=account_selection_button
${ACCOUNT_MENU_ADD_BUTTON}          accessibility_id=account_menu_add_account_button
${ADD_ACCOUNT_ADD_BUTTON}           accessibility_id=add_account_add_button
${ADD_ACCOUNT_CREATE_WALLET}        accessibility_id=add_account_create_universal_wallet_button
${ADD_ACCOUNT_CREATE_QUANTUM}       accessibility_id=add_account_create_quantum_button
${ADD_ACCOUNT_IMPORT_BUTTON}        accessibility_id=add_account_import_button
${IMPORT_RECOVER_WALLET_BUTTON}     accessibility_id=import_account_options_recover_wallet_button
${IMPORT_QUANTUM_BUTTON}            accessibility_id=import_account_quantum_button
${IMPORT_QUANTUM_NOTE}              accessibility_id=import_account_quantum_note
${IMPORT_WORD_INPUT}                accessibility_id=import_account_word_input_
${OPTION_COPY_ADDRESS}              accessibility_id=account_option_copy-address
${OPTION_VIEW_PASSPHRASE}           accessibility_id=account_option_view-passphrase
${PASSPHRASE_ACK_ROW}               accessibility_id=passphrase_acknowledge_bottom_sheet_row_
${PASSPHRASE_ACK_REVEAL}            accessibility_id=passphrase_acknowledge_bottom_sheet_reveal
${PASSPHRASE_WORD}                  accessibility_id=view_passphrase_bottom_sheet_word_
${QUANTUM_KEYGEN_TIMEOUT}           120s


*** Keywords ***
Open Account Switcher
    Wait Until Page Contains Element    ${ACCOUNT_SELECTION_BUTTON}    timeout=30s
    Tap    ${ACCOUNT_SELECTION_BUTTON}
    Wait Until Settled    ${ACCOUNT_MENU_ADD_BUTTON}

Open Add Account
    Open Account Switcher
    Tap    ${ACCOUNT_MENU_ADD_BUTTON}
    # Import is offered on every build, so it anchors the screen whatever the flags say.
    Wait Until Page Contains Element    ${ADD_ACCOUNT_IMPORT_BUTTON}    timeout=15s

Skip Unless Quantum Create Is Offered
    [Documentation]    On the Add Account screen.
    ${offered}=    Run Keyword And Return Status    Page Should Contain Element    ${ADD_ACCOUNT_CREATE_QUANTUM}
    Skip If    not ${offered}    Add Account offers no quantum entry: the quantumAccounts capability is off on this build.

Finish Naming New Account
    Wait Until Page Contains Element    ${ACCOUNT_FINISH_BUTTON}    timeout=${QUANTUM_KEYGEN_TIMEOUT}
    Tap    ${ACCOUNT_FINISH_BUTTON}
    # The account screen stays in the Android page source under the naming screen.
    Wait Until Page Does Not Contain Element    ${ACCOUNT_FINISH_BUTTON}    timeout=60s
    Wait Until Page Contains Element    ${MORE_BUTTON}    timeout=30s

Create Quantum Account
    [Documentation]    Leaves the new account selected. Skips when the build cannot create one.
    Open Add Account
    Skip Unless Quantum Create Is Offered
    Tap    ${ADD_ACCOUNT_CREATE_QUANTUM}
    Finish Naming New Account

Add Standard Account
    [Documentation]    Leaves the new, unfunded account selected.
    Open Add Account
    # A wallet holding an HD key gets "add account"; one without gets "create universal wallet".
    ${added}=    Tap If Present    ${ADD_ACCOUNT_ADD_BUTTON}
    IF    not ${added}    Tap    ${ADD_ACCOUNT_CREATE_WALLET}
    Finish Naming New Account

Open Account Options
    Wait Until Page Contains Element    ${MORE_BUTTON}    timeout=30s
    Tap    ${MORE_BUTTON}
    Wait Until Settled    ${OPTION_COPY_ADDRESS}

Tap Option Row
    [Documentation]    Rows low in the options sheet report as visible while under the screen edge,
    ...                and a tap there lands on the system navigation bar, so scroll them up first.
    [Arguments]    ${locator}
    Wait Until Page Contains Element    ${locator}    timeout=10s
    ${height}=    Get Window Height
    FOR    ${i}    IN RANGE    4
        ${at}=    Get Element Location    ${locator}
        IF    ${at}[y] < ${height} * 0.85    BREAK
        Swipe By Percent    50    75    50    40
    END
    Tap    ${locator}

Reveal Passphrase
    [Documentation]    Of the selected account. Test wallets only; never point this at a funded account.
    Open Account Options
    Tap Option Row    ${OPTION_VIEW_PASSPHRASE}
    Wait Until Settled    ${PASSPHRASE_ACK_REVEAL}
    FOR    ${row}    IN RANGE    4
        Tap    ${PASSPHRASE_ACK_ROW}${row}
    END
    Tap    ${PASSPHRASE_ACK_REVEAL}
    Wait Until Page Contains Element    ${PASSPHRASE_WORD}1    timeout=20s

Passphrase Should Have Words
    [Arguments]    ${count}
    Page Should Contain Element    ${PASSPHRASE_WORD}${count}
    Page Should Not Contain Element    ${PASSPHRASE_WORD}${{${count} + 1}}
