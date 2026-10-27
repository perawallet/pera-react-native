*** Settings ***
Documentation       Quantum (Falcon-1024) accounts. Creation is gated by the quantumAccounts
...                 capability, so the gate skips on a build with it off, after the Add Account screen
...                 has proven itself by showing its import entry.
Resource            accounts.resource


*** Variables ***
${ADD_ACCOUNT_CREATE_QUANTUM}       xpath=//*[@resource-id='add_account_create_quantum_button' or @name='add_account_create_quantum_button' or @content-desc='add_account_create_quantum_button']
${IMPORT_RECOVER_WALLET_BUTTON}     xpath=//*[@resource-id='import_account_options_recover_wallet_button' or @name='import_account_options_recover_wallet_button' or @content-desc='import_account_options_recover_wallet_button']
${IMPORT_QUANTUM_BUTTON}            xpath=//*[@resource-id='import_account_quantum_button' or @name='import_account_quantum_button' or @content-desc='import_account_quantum_button']
${IMPORT_QUANTUM_NOTE}              xpath=//*[@resource-id='import_account_quantum_note' or @name='import_account_quantum_note' or @content-desc='import_account_quantum_note']
${IMPORT_WORD_INPUT_ID}                import_account_word_input_
${PASSPHRASE_WORD_ID}                  view_passphrase_bottom_sheet_word_
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
    # The name field takes focus and the keyboard lifts the button; a tap while it moves misses.
    Wait Until Settled    ${ACCOUNT_FINISH_BUTTON}
    Tap    ${ACCOUNT_FINISH_BUTTON}
    # The account screen stays in the Android page source under the naming screen.
    Wait Until Page Does Not Contain Element    ${ACCOUNT_FINISH_BUTTON}    timeout=60s
    Wait Until Page Contains Element    ${MORE_BUTTON}    timeout=30s

Reveal Passphrase
    [Documentation]    Of the selected account. Test wallets only; never point this at a funded account.
    Open Account Option    ${OPTION_VIEW_PASSPHRASE}
    Acknowledge And Reveal Passphrase
    ${first_word}=    Indexed Row    ${PASSPHRASE_WORD_ID}    1
    Wait Until Page Contains Element    ${first_word}    timeout=20s

Passphrase Should Have Words
    [Arguments]    ${count}
    ${word}=    Indexed Row    ${PASSPHRASE_WORD_ID}    ${count}
    Page Should Contain Element    ${word}
    ${beyond}=    Indexed Row    ${PASSPHRASE_WORD_ID}    ${{${count} + 1}}
    Page Should Not Contain Element    ${beyond}

Indexed Row
    [Documentation]    A locator for one of a numbered set of views. The ids are bare prefixes:
    ...                a prefix cannot be concatenated onto a finished xpath, so the index is
    ...                applied while the xpath is built.
    [Arguments]    ${prefix}    ${index}
    RETURN    xpath=//*[@resource-id='${prefix}${index}' or @name='${prefix}${index}' or @content-desc='${prefix}${index}']
