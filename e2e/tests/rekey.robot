*** Settings ***
Documentation       Rekey on Android and iOS from one suite. Fund-free cases stop at the confirm screen
...                 of an unfunded source, where the fee guard must block the rekey; cases that need a
...                 funded or already-rekeyed account import it from the environment or skip.
Resource            ../resources/rekey.resource

Suite Setup         Start Pera With Wallet
Suite Teardown      Run Keywords    Reset To Fresh Wallet    AND    Close Pera
Test Setup          Go Home Without Rekey Sheet
Test Teardown       Capture Failure Screenshot
Test Timeout        ${E2E_TEST_TIMEOUT}
Test Tags           rekey


*** Test Cases ***
Rekey Sheet Offers Standard And Ledger Targets
    [Tags]    id:rekey.sheet.targets    p1
    Open Rekey Target Sheet
    Page Should Contain Element    ${TARGET_LEDGER}

Rekey To Standard Reaches Target Selection
    [Tags]    id:rekey.standard.select-target    p1
    Open Standard Rekey Intro
    Tap    ${STANDARD_INTRO_START}
    Wait Until Page Contains Element    ${STANDARD_SELECT_TARGET}    timeout=15s

Rekey To Standard Is Blocked On An Unfunded Source
    [Tags]    id:rekey.standard.underfunded    p1
    Add Account To Wallet
    Open Standard Rekey Intro
    Tap    ${STANDARD_INTRO_START}
    Pick Any Rekey Target
    Rekey Should Be Blocked As Underfunded    ${STANDARD_UNDERFUNDED}    ${STANDARD_CONFIRM_CTA}

Rekey To Standard Can Be Confirmed From A Funded Source
    [Tags]    id:rekey.standard.funded-confirm    p1    needs-funded    excludefromci
    Skip Unless Env Set    E2E_FUNDED_MNEMONIC    E2E_FUNDED_ADDRESS
    Use Account From Environment    E2E_FUNDED_MNEMONIC    ${FUNDED_ADDRESS}
    Open Standard Rekey Intro
    Tap    ${STANDARD_INTRO_START}
    Pick Any Rekey Target
    # The CTA stays disabled until the fee estimate lands.
    Expect Element    ${STANDARD_CONFIRM_CTA}    enabled    timeout=20s
    Page Should Not Contain Element    ${STANDARD_UNDERFUNDED}

Rekey To Quantum Reaches Target Selection
    [Tags]    id:rekey.quantum.select-target    p1
    Open Quantum Rekey Intro
    Tap    ${QUANTUM_INTRO_START}
    Wait Until Page Contains Element    ${QUANTUM_SELECT_TARGET}    timeout=15s

Rekey To Quantum Is Blocked On An Unfunded Source
    [Documentation]    Only quantum accounts are quantum targets, so one is created first; the
    ...                standard account created after it is the unfunded source.
    [Tags]    id:rekey.quantum.underfunded    p1
    Create Quantum Account
    Add Account To Wallet
    Open Quantum Rekey Intro
    Tap    ${QUANTUM_INTRO_START}
    Pick Any Rekey Target
    Rekey Should Be Blocked As Underfunded    ${QUANTUM_UNDERFUNDED}    ${QUANTUM_CONFIRM_CTA}

Rekey To Ledger Intro Opens
    [Documentation]    Stops at the intro: anything past it needs a paired Ledger.
    [Tags]    id:rekey.ledger.intro    p2
    Open Rekey Target Sheet
    Tap    ${TARGET_LEDGER}
    Wait Until Page Contains Element    ${LEDGER_INTRO_START}    timeout=15s

Rescan Rekeyed Settles Without An Error
    [Documentation]    A fresh account has nothing rekeyed to it, so the empty state is a pass; the
    ...                error state means discovery itself failed.
    [Tags]    id:rekey.rescan.open    p1
    Open Rescan Rekeyed

Rescan Lists The Account Rekeyed To This One
    [Tags]    id:rekey.rescan.select-list    p2    needs-funded    excludefromci
    Skip Unless Env Set    E2E_REKEY_AUTH_MNEMONIC    E2E_REKEY_AUTH_ADDRESS    E2E_REKEYED_ADDRESS
    Use Account From Environment    E2E_REKEY_AUTH_MNEMONIC    ${REKEY_AUTH_ADDRESS}
    Open Rescan Rekeyed
    Page Should Contain Element    tid=rescan-rekeyed-row-${REKEYED_ADDRESS}
    Page Should Contain Element    ${RESCAN_SELECT_ALL}
    Page Should Contain Element    ${RESCAN_ADD}
    Page Should Contain Element    ${RESCAN_SKIP}

Skipping Rescan Adds Nothing And Returns Home
    [Tags]    id:rekey.rescan.skip    p2    needs-funded    excludefromci
    Skip Unless Env Set    E2E_REKEY_AUTH_MNEMONIC    E2E_REKEY_AUTH_ADDRESS    E2E_REKEYED_ADDRESS
    Use Account From Environment    E2E_REKEY_AUTH_MNEMONIC    ${REKEY_AUTH_ADDRESS}
    Open Rescan Rekeyed
    Wait Until Settled    ${RESCAN_SKIP}
    Tap    ${RESCAN_SKIP}
    Wait Until Page Does Not Contain Element    ${RESCAN_SKIP}    timeout=15s
    Open Account Switcher
    ${row}=    Switcher Row    ${REKEYED_ADDRESS}
    Page Should Not Contain Element    ${row}

Undo Rekey Confirmation Opens For A Rekeyed Account
    [Tags]    id:rekey.undo.confirm    p1    needs-funded    excludefromci
    # The Undo rekey link does carry a testID (account_info_undo_rekey_link). What this case
    # waits on is a rekeyed account, which costs a funded rekey to set up.
    Skip    Needs an account that is already rekeyed; setting one up costs a funded rekey.
