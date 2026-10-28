*** Settings ***
Documentation       Quantum accounts on Android and iOS from one suite. Fund-free: creating an account
...                 and reading its own properties need no balance. Rekey to quantum lives in rekey.robot.
Resource            ../resources/quantum.resource

Suite Setup         Start Pera With Wallet
Suite Teardown      Run Keywords    Reset To Fresh Wallet    AND    Close Pera
Test Setup          Go Home
Test Teardown       Capture Failure Screenshot
Test Timeout        ${E2E_TEST_TIMEOUT}
Test Tags           quantum


*** Test Cases ***
New Quantum Account Has A 25-Word Passphrase
    [Documentation]    A quantum passphrase is 25 words where an HD one is 24, so the count proves the
    ...                created account holds a quantum key and not an ordinary one.
    [Tags]    id:quantum.create.passphrase    p0
    Create Quantum Account
    Reveal Passphrase
    Passphrase Should Have Words    25

Quantum Import Opens With Its Explanatory Note
    [Documentation]    The note renders only for the quantum key kind, so it proves the entry routes
    ...                to a quantum import rather than a generic one.
    [Tags]    id:quantum.import.option    p1
    Open Add Account
    Skip Unless Quantum Create Is Offered
    Tap    ${ADD_ACCOUNT_IMPORT_BUTTON}
    Wait Until Page Contains Element    ${IMPORT_RECOVER_WALLET_BUTTON}    timeout=15s
    Tap    ${IMPORT_QUANTUM_BUTTON}
    Wait Until Page Contains Element    ${IMPORT_QUANTUM_NOTE}    timeout=15s
    ${first_field}=    Indexed Row    ${IMPORT_WORD_INPUT_ID}    0
    Page Should Contain Element    ${first_field}
