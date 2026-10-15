*** Settings ***
Documentation       Quantum (Falcon-1024) accounts. Creation is gated by the quantumAccounts
...                 capability, so the gate skips on a build with it off, after the Add Account screen
...                 has proven itself by showing its import entry.
Resource            accounts.resource


*** Variables ***
${ADD_ACCOUNT_CREATE_QUANTUM}       accessibility_id=add_account_create_quantum_button
${IMPORT_RECOVER_WALLET_BUTTON}     accessibility_id=import_account_options_recover_wallet_button
${IMPORT_QUANTUM_BUTTON}            accessibility_id=import_account_quantum_button
${IMPORT_QUANTUM_NOTE}              accessibility_id=import_account_quantum_note
${IMPORT_WORD_INPUT}                accessibility_id=import_account_word_input_
${PASSPHRASE_WORD}                  accessibility_id=view_passphrase_bottom_sheet_word_
${QUANTUM_KEYGEN_TIMEOUT}           120s


*** Keywords ***
Open Add Account
    Open Account Switcher
    Tap    ${ACCOUNT_MENU_ADD_BUTTON}
    Wait Until Page Contains Element    ${ADD_ACCOUNT_IMPORT_BUTTON}    timeout=15s

Skip Unless Quantum Create Is Offered
    [Documentation]    On the Add Account screen.
    ${offered}=    Run Keyword And Return Status    Page Should Contain Element    ${ADD_ACCOUNT_CREATE_QUANTUM}
    Skip If    not ${offered}    Add Account offers no quantum entry: quantumAccounts is off.

Create Quantum Account
    [Documentation]    Leaves the new account selected. Skips when the build cannot create one.
    Open Add Account
    Skip Unless Quantum Create Is Offered
    Tap    ${ADD_ACCOUNT_CREATE_QUANTUM}
    Wait Until Page Contains Element    ${ACCOUNT_FINISH_BUTTON}    timeout=${QUANTUM_KEYGEN_TIMEOUT}
    Tap    ${ACCOUNT_FINISH_BUTTON}
    # The account screen stays in the Android page source under the naming screen.
    Wait Until Page Does Not Contain Element    ${ACCOUNT_FINISH_BUTTON}    timeout=60s
    Wait Until Page Contains Element    ${MORE_BUTTON}    timeout=30s

Reveal Passphrase
    [Documentation]    Of the selected account. Test wallets only; never point this at a funded account.
    Open Account Option    ${OPTION_VIEW_PASSPHRASE}
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
