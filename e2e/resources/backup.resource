*** Settings ***
Documentation       The passphrase backup reminder: the banner on a funded account whose phrase has not
...                 been backed up, and the wizard behind it. Not Cloud Backup.
Library             Collections
Library             String
Resource            onboarding.resource


*** Variables ***
# A funded 24-word Universal wallet. Recovering it does not mark its phrase backed up, so the
# reminder shows; an unfunded account with nothing rekeyed to it is never reminded.
${MNEMONIC_FUNDED}                  %{MNEMONIC_24_FUNDED=}

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
    Import From Welcome    ${RECOVER_UNIVERSAL_WALLET}    MNEMONIC_24_FUNDED
    Wait Clear Of Startup Prompts
    # The banner waits on the account's funded-state query.
    Wait Until Page Contains Element    ${BACKUP_BANNER_CTA}    timeout=60s

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
    ${level}=    Set Log Level    NONE
    TRY
        ${matches}=    Evaluate    $PASSPHRASE == $MNEMONIC_FUNDED.split()
    FINALLY
        Set Log Level    ${level}
    END
    Should Be True    ${matches}    msg=The grid did not show the wallet's recovery phrase word for word.

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
