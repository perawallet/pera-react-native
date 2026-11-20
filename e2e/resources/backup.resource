*** Settings ***
Documentation       The passphrase backup reminder: the banner on a funded account whose phrase has not
...                 been backed up, and the wizard behind it. Not Cloud Backup.
Library             Collections
Library             String
Library             Process
Resource            onboarding.resource


*** Variables ***
# The testnet treasury (README, "Funded fixtures"). An imported phrase counts as backed up, so the
# reminder needs a wallet the app created, which the treasury funds: an unfunded account with
# nothing rekeyed to it is never reminded.
${TREASURY_MNEMONIC}                %{MNEMONIC_25_WORD=}
# run.sh passes the real path, since the snapshot holds only tests/ and resources/; this default
# covers robot started by hand from e2e/.
${TESTNET_FIXTURES_TOOL}            ${EXECDIR}/tools/testnet_fixtures.mjs
# 0.1 ALGO minimum balance plus room for nothing else: the wallet is thrown away after the case.
${BACKUP_FUNDING_MICROALGOS}        100000
${ALGORAND_COPY}                    tid=account_network_algorand_copy

${BACKUP_BANNER_CTA}                tid=backup_reminder_banner_cta
${BACKUP_INFO_CONTINUE}             tid=backup_info_continue
${BACKUP_WRITE_DOWN_BEGIN}          tid=backup_write_down_begin
${BACKUP_MNEMONIC_CONTINUE}         tid=backup_mnemonic_continue
${BACKUP_VERIFICATION_NEXT}         tid=backup_verification_next
${BACKUP_SUCCESS_DONE}              tid=backup_success_done
# Grid cells and quiz items are PWViews (testID only, so the word stays readable), which Android
# exposes as resource-id and iOS as name. Quiz options share the item prefix, hence the exclusion.
${PASSPHRASE_CELL_ANY}              xpath=//*[starts-with(@resource-id,'passphrase_word_') or starts-with(@name,'passphrase_word_')]
${QUIZ_ITEM_ANY}                    xpath=//*[(starts-with(@resource-id,'backup_verification_item_') or starts-with(@name,'backup_verification_item_')) and not(contains(@resource-id,'_option_')) and not(contains(@name,'_option_'))]


*** Keywords ***
Start With Unfunded Wallet
    Start With New Wallet
    # The account screen's actions panel proves the screen the banner lives on has rendered.
    Wait Until Page Contains Element    ${MORE_BUTTON}    timeout=30s

Start With Wallet Needing Backup
    [Documentation]    A created wallet funded on testnet: the reminder counts a balance on any network.
    Skip If    not $TREASURY_MNEMONIC    MNEMONIC_25_WORD (the testnet treasury) is not set.
    Skip If    not os.path.exists($TESTNET_FIXTURES_TOOL)    ${TESTNET_FIXTURES_TOOL} is missing.
    Start With New Wallet
    Load Fixture    testnet
    ${address}=    Algorand Address Of Selected Account
    VAR    ${WALLET_ADDRESS}    ${address}    scope=TEST
    ${paid}=    Run Process    node    ${TESTNET_FIXTURES_TOOL}    pay    ${address}
    ...    ${BACKUP_FUNDING_MICROALGOS}
    Should Be Equal As Integers    ${paid.rc}    0    msg=Funding the new wallet failed: ${paid.stderr}
    Go Home
    Wait Clear Of Startup Prompts
    # The banner waits on the account's funded-state query, which the next sync tick refreshes;
    # a relaunch reads the balance afresh when that tick is slow.
    ${shown}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${BACKUP_BANNER_CTA}    timeout=60s
    IF    not ${shown}
        Relaunch Pera
        Wait Clear Of Startup Prompts
        Wait Until Page Contains Element    ${BACKUP_BANNER_CTA}    timeout=60s
    END

Algorand Address Of Selected Account
    [Documentation]    The row prints the address shortened; its copy action hands over all of it.
    Wait Until Settled    ${MORE_BUTTON}
    Open Account Options Sheet
    Scroll Until Tappable    ${ALGORAND_COPY}
    Tap    ${ALGORAND_COPY}
    ${address}=    AppiumLibrary.Get Clipboard Text
    Should Match Regexp    ${address}    ^[A-Z2-7]{58}$    msg=The copy action put no Algorand address on the clipboard.
    RETURN    ${address}

Open Backup Info
    Tap    ${BACKUP_BANNER_CTA}
    Wait Until Page Contains Element    ${BACKUP_INFO_CONTINUE}    timeout=20s

Open Passphrase
    Open Backup Info
    Tap    ${BACKUP_INFO_CONTINUE}
    Wait Until Page Contains Element    ${BACKUP_WRITE_DOWN_BEGIN}    timeout=20s
    Tap    ${BACKUP_WRITE_DOWN_BEGIN}
    Wait Until Page Contains Element    ${BACKUP_MNEMONIC_CONTINUE}    timeout=30s

Remember Passphrase
    [Documentation]    Keeps the words the grid displays, in order, as ${PASSPHRASE} for this test.
    ...                Logging is off while they are read so they never reach the run's logs.
    ${level}=    Set Log Level    NONE
    TRY
        @{cells}=    Get WebElements    ${PASSPHRASE_CELL_ANY}
        ${count}=    Get Length    ${cells}
        VAR    @{words}    @{EMPTY}
        FOR    ${position}    IN RANGE    1    ${count + 1}
            ${word}=    Get Text In Container    passphrase_word_${position}    2
            Append To List    ${words}    ${word}
        END
        VAR    @{PASSPHRASE}    @{words}    scope=TEST
    FINALLY
        Set Log Level    ${level}
    END

Passphrase Should Match The Wallet
    [Documentation]    Derives the address the shown words open, the way the app derives it, and
    ...                compares it with the wallet's. The words reach the tool through the environment,
    ...                never a command line or the log.
    ${level}=    Set Log Level    NONE
    TRY
        Set Environment Variable    E2E_SHOWN_PHRASE    ${{ ' '.join($PASSPHRASE) }}
        ${derived}=    Run Process    node    ${TESTNET_FIXTURES_TOOL}    address-of-env    E2E_SHOWN_PHRASE
    FINALLY
        Remove Environment Variable    E2E_SHOWN_PHRASE
        Set Log Level    ${level}
    END
    Should Be Equal    ${derived.stdout.strip()}    ${WALLET_ADDRESS}
    ...    msg=The grid's words open another wallet than this one.    values=False

Open Verification Quiz
    Open Passphrase
    Remember Passphrase
    Tap    ${BACKUP_MNEMONIC_CONTINUE}
    Wait Until Page Contains Element    ${BACKUP_VERIFICATION_NEXT}    timeout=20s

Answer Quiz Correctly
    [Documentation]    Each item reads "Select word #N", so the word to pick is known once N is. An
    ...                option's ID carries its POSITION rather than its word - deliberately, since a
    ...                word in a testID becomes a resource-id on Android - so the option is matched
    ...                on what it displays. Logging is off throughout.
    @{items}=    Get WebElements    ${QUIZ_ITEM_ANY}
    ${count}=    Get Length    ${items}
    Should Be True    ${count} > 0    msg=The quiz shows no items, so nothing is verified.
    ${level}=    Set Log Level    NONE
    TRY
        FOR    ${i}    IN RANGE    ${count}
            # Android leaves the lower items out of the tree until they are on screen. The option
            # IDs carry positions, not words, so scrolling to them logs nothing secret.
            Run Keyword And Ignore Error    Scroll Until Tappable    tid=backup_verification_item_${i}_option_0
            Run Keyword And Ignore Error    Scroll Until Tappable    tid=backup_verification_item_${i}_option_2
            ${label}=    Get Text In Container    backup_verification_item_${i}    1
            ${digits}=    Get Regexp Matches    ${label}    \\d+
            Should Not Be Empty    ${digits}    msg=A quiz label no longer carries the word position.
            ${word}=    Get From List    ${PASSPHRASE}    ${{int($digits[0]) - 1}}
            ${prefix}=    Set Variable    backup_verification_item_${i}_option_
            # The locator holds a seed word, and a failed tap would print it in the failure message.
            ${tapped}=    Run Keyword And Return Status
            ...    Tap    xpath=//*[(starts-with(@resource-id,'${prefix}') or starts-with(@name,'${prefix}')) and (@text='${word}' or @label='${word}' or @name='${word}' or .//*[@text='${word}' or @label='${word}' or @name='${word}'])]
            IF    not ${tapped}    Fail    Could not pick the answer for quiz item ${i}.
        END
    FINALLY
        Set Log Level    ${level}
    END
