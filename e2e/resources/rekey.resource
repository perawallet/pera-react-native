*** Settings ***
Documentation       Rekey flows. Every rekey destination starts from the account options' single
...                 "rekey account" entry and its target sheet; a shared account skips the sheet.
...                 Executing a rekey costs a fee, so no case here ever taps a confirm CTA.
Resource            quantum.resource


*** Variables ***
# Funded and rekeyed accounts come from the environment; the mnemonics are read by name inside
# Import Passphrase so their words never pass through a logged argument.
${FUNDED_ADDRESS}                   %{E2E_FUNDED_ADDRESS=}
# An account that another on-chain account is rekeyed to, and that rekeyed account's address.
${REKEY_AUTH_ADDRESS}               %{E2E_REKEY_AUTH_ADDRESS=}
${REKEYED_ADDRESS}                  %{E2E_REKEYED_ADDRESS=}

${OPTION_REKEY_ACCOUNT}             tid=account_option_rekey-account
${OPTION_SCAN_REKEYED}              tid=account_option_scan-rekeyed
${TARGET_STANDARD}                  tid=rekey_option_standard
${TARGET_LEDGER}                    tid=rekey_option_ledger
${TARGET_QUANTUM}                   tid=rekey_option_quantum
${STANDARD_INTRO_START}             tid=rekey-to-standard-intro-start
${STANDARD_CONFIRM_CTA}             tid=rekey-to-standard-confirm-cta
${STANDARD_UNDERFUNDED}             tid=rekey-to-standard-underfunded-notice
${QUANTUM_INTRO_START}              tid=rekey-to-quantum-intro-start
${QUANTUM_CONFIRM_CTA}              tid=rekey-to-quantum-confirm-cta
${QUANTUM_UNDERFUNDED}              tid=rekey-to-quantum-underfunded-notice
${LEDGER_INTRO_START}               tid=rekey-to-ledger-intro-start
${RESCAN_SELECT_ALL}                tid=rescan-rekeyed-select-all-checkbox
${RESCAN_ADD}                       tid=rescan-rekeyed-add
${RESCAN_SKIP}                      xpath=//*[@resource-id='rescan-rekeyed-skip' or @name='rescan-rekeyed-skip' or @content-desc='rescan-rekeyed-skip' or @resource-id='rescan-rekeyed-skip']
# Screen containers are not accessibility elements: Android exposes their testID only as
# resource-id, iOS only as name.
${STANDARD_SELECT_TARGET}           tid=rekey-to-standard-select-target-screen
${QUANTUM_SELECT_TARGET}            tid=rekey-to-quantum-select-target-screen
${RESCAN_ERROR}                     tid=rescan-rekeyed-error
# Loading has no testID; empty, error and the select list are the three ways a rescan settles.
${RESCAN_SETTLED}                   xpath=//*[@resource-id='rescan-rekeyed-empty' or @name='rescan-rekeyed-empty' or @resource-id='rescan-rekeyed-error' or @name='rescan-rekeyed-error' or @content-desc='rescan-rekeyed-skip' or @resource-id='rescan-rekeyed-skip' or @name='rescan-rekeyed-skip']
${ANY_TARGET_ROW}                   xpath=//*[starts-with(@content-desc, 'rekey-target-row-') or starts-with(@resource-id, 'rekey-target-row-') or starts-with(@name,'rekey-target-row-')]

${IMPORT_HD_BUTTON}                 tid=import_options_hd_wallet_button
${IMPORT_ALGO25_BUTTON}             tid=import_options_algo25_button
${IMPORT_ACCOUNT_BUTTON}            tid=import_account_import_button
${IMPORT_SELECT_CONTINUE}           tid=import_select_addresses_continue_button
${IMPORT_REKEYED_SKIP}              tid=import_rekeyed_addresses_skip_button


*** Keywords ***
Go Home Without Rekey Sheet
    [Documentation]    On iOS the rekey target sheet outlives the home fixture's dismissAll and
    ...                covers Home, so a case that stopped on it would block the next one.
    Go Home
    ${open}=    Run Keyword And Return Status    Page Should Contain Element    ${TARGET_STANDARD}
    IF    not ${open}    RETURN
    Close Sheet
    Wait Until Page Does Not Contain Element    ${TARGET_STANDARD}    timeout=10s

Open Rekey Target Sheet
    Open Algorand Account Option    ${OPTION_REKEY_ACCOUNT}
    Wait Until Settled    ${TARGET_STANDARD}

Open Standard Rekey Intro
    Open Rekey Target Sheet
    Tap    ${TARGET_STANDARD}
    Wait Until Page Contains Element    ${STANDARD_INTRO_START}    timeout=15s

Open Quantum Rekey Intro
    Open Rekey Target Sheet
    ${offered}=    Run Keyword And Return Status    Page Should Contain Element    ${TARGET_QUANTUM}
    Skip If    not ${offered}    The rekey sheet offers no quantum target: quantumAccounts is off.
    Tap    ${TARGET_QUANTUM}
    Wait Until Page Contains Element    ${QUANTUM_INTRO_START}    timeout=15s

Pick Any Rekey Target
    Wait Until Page Contains Element    ${ANY_TARGET_ROW}    timeout=15s
    Tap    ${ANY_TARGET_ROW}

Rekey Should Be Blocked As Underfunded
    [Documentation]    The source pays the fee, so a zero-balance source must not be able to confirm.
    [Arguments]    ${notice}    ${cta}
    Wait Until Page Contains Element    ${notice}    timeout=20s
    Expect Element    ${cta}    disabled

Open Rescan Rekeyed
    Open Algorand Account Option    ${OPTION_SCAN_REKEYED}
    Wait Until Page Contains Element    ${RESCAN_SETTLED}    timeout=30s
    Page Should Not Contain Element    ${RESCAN_ERROR}    Rescan settled on its error state: discovery failed.

Skip Unless Env Set
    [Arguments]    @{names}
    ${missing}=    Evaluate    [n for n in $names if not os.environ.get(n)]    modules=os
    Skip If    $missing    Needs a funded or rekeyed test account from the environment: ${missing}

Use Account From Environment
    [Documentation]    Selects the account when the wallet already holds it, otherwise imports it.
    [Arguments]    ${mnemonic_env}    ${address}
    Open Account Switcher
    ${row}=    Switcher Row    ${address}
    ${held}=    Tap If Present    ${row}
    IF    not ${held}
        Tap    ${ACCOUNT_MENU_ADD_BUTTON}
        Import Passphrase    ${mnemonic_env}
    END
    Go Home

Import Passphrase
    [Documentation]    From the Add Account screen. A 24-word phrase is an HD wallet, 25 words algo25.
    [Arguments]    ${mnemonic_env}
    # Keeps the words out of log.html and output.xml, failures included.
    ${level}=    Set Log Level    NONE
    ${words}=    Evaluate    os.environ[$mnemonic_env].split()    modules=os
    Wait Until Page Contains Element    ${ADD_ACCOUNT_IMPORT_BUTTON}    timeout=15s
    Tap    ${ADD_ACCOUNT_IMPORT_BUTTON}
    Wait Until Page Contains Element    ${IMPORT_RECOVER_WALLET_BUTTON}    timeout=15s
    Tap    ${IMPORT_RECOVER_WALLET_BUTTON}
    ${kind}=    Set Variable If    len($words) == 24    ${IMPORT_HD_BUTTON}    ${IMPORT_ALGO25_BUTTON}
    Wait Until Settled    ${kind}
    Tap    ${kind}
    FOR    ${i}    IN RANGE    ${{len($words)}}
        ${field}=    quantum.Indexed Row    ${IMPORT_WORD_INPUT_ID}    ${i}
        Input Password    ${field}    ${words}[${i}]
    END
    Set Log Level    ${level}
    Dismiss Keyboard
    Tap    ${IMPORT_ACCOUNT_BUTTON}
    Finish Passphrase Import
    [Teardown]    Set Log Level    ${level}

Finish Passphrase Import
    [Documentation]    The account search ends on naming the account or, when other accounts are
    ...                rekeyed to it, on offering them; skip those so rescan still finds them.
    FOR    ${_}    IN RANGE    120
        Tap If Present    ${IMPORT_SELECT_CONTINUE}
        ${named}=    Tap If Present    ${ACCOUNT_FINISH_BUTTON}
        ${skipped}=    Tap If Present    ${IMPORT_REKEYED_SKIP}
        IF    ${named} or ${skipped}    RETURN
        # Polls the on-chain account search, which has no progress anchor of its own.
        Sleep    0.5s
    END
    Fail    Import never reached the naming or rekeyed-accounts step.
