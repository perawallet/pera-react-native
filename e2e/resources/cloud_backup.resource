*** Settings ***
Documentation       Cloud Backup keywords. The feature is gated on the enable_cloud_backup flag, which
...                 defaults off; the only on-device way in is the Debug Tools override screen.
...                 Container testIDs (PWView, PWScreen, raw Pressable) carry no accessibility label,
...                 so they are matched on resource-id (Android) or name (iOS) instead of
...                 accessibility_id.
Library             Collections
Library             String
Resource            app.resource


*** Variables ***
${BACKEND_KEYED}                    %{PERA_E2E_BACKEND_KEYED=}
# Mirrors VERIFICATION_WORD_COUNT in useCloudBackupVerifyScreen.ts.
${CB_QUIZ_ITEMS}                    3

${MENU_SETTINGS_BUTTON}             accessibility_id=menu_settings_button
${SETTINGS_SECURITY_ROW}            accessibility_id=settings_item_security
${SETTINGS_DEVELOPER_ROW}           accessibility_id=settings_item_developer_settings
${SETTINGS_APP_VERSION}             xpath=//*[@resource-id='settings_app_version' or @name='settings_app_version']
${DEBUG_TOOLS_ROW}                  accessibility_id=developer_settings_debug_tools_item
${FEATURE_FLAGS_ROW}                accessibility_id=debug_tools_feature_flags_item
${CB_FLAG_EXPAND}                   accessibility_id=feature_flag_expand_enable_cloud_backup
${CB_FLAG_OVERRIDE}                 accessibility_id=feature_flag_override_enable_cloud_backup
${CB_SETTINGS_ROW}                  accessibility_id=settings_item_cloud_backup

${CB_INTRO_SCREEN}                  xpath=//*[@resource-id='cloud_backup_intro_screen' or @name='cloud_backup_intro_screen']
${CB_INTRO_STEPS}                   xpath=//*[@resource-id='cloud_backup_intro_steps' or @name='cloud_backup_intro_steps']
${CB_INTRO_CONTINUE}                accessibility_id=cloud_backup_intro_continue_button
${CB_SCREEN}                        xpath=//*[@resource-id='cloud_backup_screen' or @name='cloud_backup_screen']
${CB_SETUP_OPTION}                  accessibility_id=cloud_backup_setup_option
${CB_RESTORE_OPTION}                accessibility_id=cloud_backup_restore_option
# Whichever screen the Settings row lands on: intro (first visit), choice, or overview (configured).
${CB_ENTRY_ANY}                     xpath=//*[@resource-id='cloud_backup_intro_screen' or @name='cloud_backup_intro_screen' or @resource-id='cloud_backup_screen' or @name='cloud_backup_screen' or @resource-id='cloud_backup_overview_screen' or @name='cloud_backup_overview_screen']

${CB_SETUP_SCREEN}                  xpath=//*[@resource-id='cloud_backup_setup_screen' or @name='cloud_backup_setup_screen']
${CB_SETUP_CHECKBOX}                accessibility_id=cloud_backup_setup_checkbox
${CB_SETUP_PROCEED}                 accessibility_id=cloud_backup_setup_proceed_button

${CB_VERIFY_SCREEN}                 xpath=//*[@resource-id='cloud_backup_verify_screen' or @name='cloud_backup_verify_screen']
${CB_VERIFY_PROCEED}                accessibility_id=cloud_backup_verify_proceed_button
# The toast carries no testID; matched on cloud_backup.verify.error_message (English).
${CB_VERIFY_WRONG_TOAST}            xpath=//*[contains(@text,'Incorrect selection') or contains(@label,'Incorrect selection') or contains(@name,'Incorrect selection')]

${CB_STORE_KEY_SCREEN}              xpath=//*[@resource-id='cloud_backup_store_encryption_key_screen' or @name='cloud_backup_store_encryption_key_screen']
${CB_STORE_KEY_CHECKBOX}            accessibility_id=cloud_backup_store_encryption_key_checkbox
${CB_STORE_KEY_ENABLE}              accessibility_id=cloud_backup_store_encryption_key_enable_button

${CB_OVERVIEW_SCREEN}               xpath=//*[@resource-id='cloud_backup_overview_screen' or @name='cloud_backup_overview_screen']
${CB_OVERVIEW_ACCOUNTS}             accessibility_id=cloud_backup_overview_accounts
${CB_OVERVIEW_CONTACTS}             accessibility_id=cloud_backup_overview_contacts
${CB_OVERVIEW_PASSKEYS}             accessibility_id=cloud_backup_overview_passkeys
${CB_OVERVIEW_CREDENTIAL_ADDRESS}   accessibility_id=cloud_backup_overview_credential_address
${CB_OVERVIEW_SYNC_DEVICES}         accessibility_id=cloud_backup_overview_sync_devices
${CB_OVERVIEW_TURN_OFF}             accessibility_id=cloud_backup_overview_turn_off
# TurnOffBackupSheet passes no testIDs, so its "Turn Off Backup" option is matched on its English title.
${CB_TURN_OFF_OPTION}               xpath=//*[@text='Turn Off Backup' or @label='Turn Off Backup']
${CB_TURN_OFF_CONFIRM}              accessibility_id=confirm_turn_off_backup_confirm

${CB_ACCOUNTS_SCREEN}               xpath=//*[@resource-id='cloud_backup_accounts_screen' or @name='cloud_backup_accounts_screen']
${CB_CONTACTS_SCREEN}               xpath=//*[@resource-id='cloud_backup_contacts_screen' or @name='cloud_backup_contacts_screen']
${CB_PASSKEYS_SCREEN}               xpath=//*[@resource-id='cloud_backup_passkeys_screen' or @name='cloud_backup_passkeys_screen']
# The row id carries the address; the Back Up button shares the prefix, so it is excluded.
${CB_ACCOUNT_ROW_ANY}               xpath=//*[(starts-with(@resource-id,'cloud_backup_account_') and not(contains(@resource-id,'_back_up'))) or (starts-with(@name,'cloud_backup_account_') and not(contains(@name,'_back_up')))]
${CB_ACCOUNT_BACK_UP}               accessibility_id=cloud_backup_account_back_up
${CB_ACCOUNT_BACKED_UP}             xpath=//*[@resource-id='backup_account_row_backed_up' or @name='backup_account_row_backed_up']
${CB_ACCOUNT_NOT_BACKED_UP}         xpath=//*[@resource-id='backup_account_row_not_backed_up' or @name='backup_account_row_not_backed_up']


*** Keywords ***
Skip Unless Backend Keyed
    [Documentation]    A correct quiz answer registers the backup, which needs a deviceId from the
    ...                backend; a build without BACKEND_API_KEY gets a 401 there and never leaves
    ...                the verify screen, which reads exactly like a missing element.
    Skip If    not $BACKEND_KEYED
    ...    Needs a build carrying BACKEND_API_KEY; set PERA_E2E_BACKEND_KEYED=1 when the build has one.

Open Settings
    Go Home
    Tap    ${MENU_TAB}
    Wait Until Page Contains Element    ${MENU_SETTINGS_BUTTON}    timeout=15s
    Tap    ${MENU_SETTINGS_BUTTON}
    Wait Until Page Contains Element    ${SETTINGS_SECURITY_ROW}    timeout=15s

Open Cloud Backup
    [Documentation]    Settings row, turning the flag on first when the row is not offered.
    Open Settings
    ${offered}=    Run Keyword And Return Status    Page Should Contain Element    ${CB_SETTINGS_ROW}
    IF    not ${offered}
        Enable Cloud Backup Flag
        Open Settings
    END
    Page Should Contain Element    ${CB_SETTINGS_ROW}
    ...    message=The Cloud Backup row is still missing from Settings with enable_cloud_backup overridden on.
    Tap    ${CB_SETTINGS_ROW}
    Wait Until Page Contains Element    ${CB_ENTRY_ANY}    timeout=20s

Enable Cloud Backup Flag
    [Documentation]    Settings -> Developer -> Debug Tools -> Feature Flags. Only called while the flag is
    ...                off: the override switch toggles, so tapping it when already on turns it off.
    Unlock Debug Tools
    Scroll Into View    ${SETTINGS_DEVELOPER_ROW}
    Tap    ${SETTINGS_DEVELOPER_ROW}
    Scroll Into View    ${DEBUG_TOOLS_ROW}
    Tap    ${DEBUG_TOOLS_ROW}
    Wait Until Page Contains Element    ${FEATURE_FLAGS_ROW}    timeout=15s
    Tap    ${FEATURE_FLAGS_ROW}
    Wait Until Page Contains Element    ${CB_FLAG_EXPAND}    timeout=15s
    Scroll Into View    ${CB_FLAG_EXPAND}
    Tap    ${CB_FLAG_EXPAND}
    Wait Until Page Contains Element    ${CB_FLAG_OVERRIDE}    timeout=15s
    Tap    ${CB_FLAG_OVERRIDE}

Unlock Debug Tools
    [Documentation]    Ten taps on the version row, each within 1s of the last (AppVersion.tsx resets the
    ...                count on a longer gap). Re-locating the element per tap can exceed that on a
    ...                loaded device, so the point is resolved once and tapped by coordinate.
    Scroll Into View    ${SETTINGS_APP_VERSION}
    ${loc}=    Get Element Location    ${SETTINGS_APP_VERSION}
    ${size}=    Get Element Size    ${SETTINGS_APP_VERSION}
    VAR    @{point}    ${{int($loc['x'] + $size['width'] / 2)}}    ${{int($loc['y'] + $size['height'] / 2)}}
    AppiumLibrary.Tap    ${point}    count=10    duration=0.05s

Scroll Into View
    [Documentation]    Swipes until the element sits in the upper three quarters of the window, clear of
    ...                sticky footers. Android leaves off-screen rows out of the tree; iOS keeps them
    ...                with an off-screen position, which also says which way to scroll.
    [Arguments]    ${locator}
    ${h}=    Get Window Height
    FOR    ${i}    IN RANGE    8
        ${present}=    Run Keyword And Return Status    Page Should Contain Element    ${locator}
        IF    ${present}
            ${loc}=    Get Element Location    ${locator}
            IF    0 < ${loc}[y] < ${h} * 0.75    RETURN
            IF    ${loc}[y] <= 0
                Swipe By Percent    50    35    50    70    duration=0.4s
                CONTINUE
            END
        END
        Swipe By Percent    50    70    50    35    duration=0.4s
    END
    Fail    ${locator} never scrolled into view.

Start At Choice
    [Documentation]    The set-up-or-restore screen with no backup configured. A configured backup is
    ...                turned off first (local only; the remote backup stays).
    Open Cloud Backup
    ${configured}=    Run Keyword And Return Status    Page Should Contain Element    ${CB_OVERVIEW_SCREEN}
    IF    ${configured}    Turn Off Cloud Backup
    Tap If Present    ${CB_INTRO_CONTINUE}
    Wait Until Page Contains Element    ${CB_SETUP_OPTION}    timeout=20s

Turn Off Cloud Backup
    Scroll Into View    ${CB_OVERVIEW_TURN_OFF}
    Tap    ${CB_OVERVIEW_TURN_OFF}
    Wait Until Settled    ${CB_TURN_OFF_OPTION}
    Tap    ${CB_TURN_OFF_OPTION}
    Wait Until Settled    ${CB_TURN_OFF_CONFIRM}
    Tap    ${CB_TURN_OFF_CONFIRM}
    Wait Until Page Contains Element    ${CB_SCREEN}    timeout=20s

Start At Setup Passphrase
    Start At Choice
    Tap    ${CB_SETUP_OPTION}
    Wait Until Page Contains Element    ${CB_SETUP_SCREEN}    timeout=30s

Start At Verify Quiz
    [Documentation]    Returns the passphrase the setup screen showed, for answering the quiz.
    Start At Setup Passphrase
    @{words}=    Read Passphrase
    Acknowledge Passphrase
    Tap    ${CB_SETUP_PROCEED}
    Wait Until Page Contains Element    ${CB_VERIFY_SCREEN}    timeout=20s
    RETURN    @{words}

Start At Store Key
    @{words}=    Start At Verify Quiz
    Answer Verify Quiz    ${words}
    Tap    ${CB_VERIFY_PROCEED}
    Wait Until Page Contains Element    ${CB_STORE_KEY_SCREEN}    timeout=25s

Start At Overview
    [Documentation]    A configured backup's overview, activating one first if the device has none.
    Open Cloud Backup
    ${configured}=    Run Keyword And Return Status    Page Should Contain Element    ${CB_OVERVIEW_SCREEN}
    IF    ${configured}    RETURN
    Start At Store Key
    Acknowledge Store Key
    Tap    ${CB_STORE_KEY_ENABLE}
    Wait Until Page Contains Element    ${CB_OVERVIEW_SCREEN}    timeout=30s

Acknowledge Passphrase
    Scroll Into View    ${CB_SETUP_CHECKBOX}
    Tap    ${CB_SETUP_CHECKBOX}

Acknowledge Store Key
    Scroll Into View    ${CB_STORE_KEY_CHECKBOX}
    Tap    ${CB_STORE_KEY_CHECKBOX}

Should Be Enabled
    [Arguments]    ${locator}    ${expected}    ${msg}
    ${enabled}=    Get Element Attribute    ${locator}    enabled
    Should Be Equal As Strings    ${enabled}    ${expected}    msg=${msg}    values=False

Read Passphrase
    [Documentation]    The grid cell holds the testID and has no text of its own; the position number
    ...                and the word follow it as text nodes (siblings on Android, children on iOS).
    ...                Walking one page source in document order reads both trees the same way: the
    ...                word is the second non-empty text after its cell. Safe to read: a fresh
    ...                backup-encryption key for the throwaway wallet, not an account passphrase.
    ${src}=    Get Source
    @{cells}=    Get Regexp Matches    ${src}    (?:resource-id|name)="passphrase_word_(\\d+)"    1
    @{cells}=    Remove Duplicates    ${cells}
    VAR    @{words}    @{EMPTY}
    FOR    ${n}    IN    @{cells}
        ${pattern}=    Catenate    SEPARATOR=
        ...    (?s)passphrase_word_${n}"(?:(?!passphrase_word_\\d+").)*?\\s(?:text|label)="[^"]+"
        ...    (?:(?!passphrase_word_\\d+").)*?\\s(?:text|label)="([^"]+)"
        @{found}=    Get Regexp Matches    ${src}    ${pattern}    1
        VAR    ${word}    ${{$found[0] if $found else ''}}
        Append To List    ${words}    ${word}
    END
    RETURN    @{words}

Quiz Item
    [Arguments]    ${index}
    RETURN    xpath=//*[@resource-id='cloud_backup_verify_item_${index}' or @name='cloud_backup_verify_item_${index}']

Asked Word Position
    [Documentation]    The "Select word #N" label that follows the item's container and precedes the
    ...                next item's, read from the page source so a label from a neighbouring row can
    ...                never be taken for this one.
    [Arguments]    ${index}
    ${src}=    Get Source
    ${pattern}=    Catenate    SEPARATOR=
    ...    (?s)cloud_backup_verify_item_${index}"(?:(?!cloud_backup_verify_item_\\d+").)*?Select word \#(\\d+)
    @{found}=    Get Regexp Matches    ${src}    ${pattern}    1
    Should Not Be Empty    ${found}    msg=Quiz item ${index} shows no "Select word #N" label.
    RETURN    ${found}[0]

Distractor For
    [Documentation]    An option the app offers for the item that is not the correct word.
    [Arguments]    ${index}    ${correct}
    ${src}=    Get Source
    @{options}=    Get Regexp Matches    ${src}    cloud_backup_verify_item_${index}_option_([a-zA-Z]+)"    1
    Remove Values From List    ${options}    ${correct}
    Should Not Be Empty    ${options}
    ...    msg=Quiz item ${index} offers no word other than the correct "${correct}", so answering it proves nothing.
    RETURN    ${options}[0]

Answer Verify Quiz
    [Documentation]    Answers every item from the passphrase the setup screen showed. With
    ...                wrong_index, that one item gets a distractor instead; returns the word used.
    ...                Each item is answered once: selection is a style only, so a replaced answer
    ...                cannot be read back to confirm it took.
    [Arguments]    ${words}    ${wrong_index}=${-1}
    VAR    ${wrong}    ${EMPTY}
    FOR    ${i}    IN RANGE    ${CB_QUIZ_ITEMS}
        ${item}=    Quiz Item    ${i}
        Scroll Into View    ${item}
        ${n}=    Asked Word Position    ${i}
        ${word}=    Get From List    ${words}    ${{int($n) - 1}}
        IF    ${i} == ${wrong_index}
            ${word}=    Distractor For    ${i}    ${word}
            VAR    ${wrong}    ${word}
        END
        ${option}=    Set Variable    accessibility_id=cloud_backup_verify_item_${i}_option_${word}
        Scroll Into View    ${option}
        Tap    ${option}
    END
    RETURN    ${wrong}

Account Row Should Declare Its Backup State
    Page Should Contain Element    ${CB_ACCOUNT_ROW_ANY}
    ...    message=The cloud-backup account list shows no account rows, so the wallet on this device is not offered for backup.
    ${backed_up}=    Run Keyword And Return Status    Page Should Contain Element    ${CB_ACCOUNT_BACKED_UP}
    ${not_backed_up}=    Run Keyword And Return Status    Page Should Contain Element    ${CB_ACCOUNT_NOT_BACKED_UP}
    Should Be True    ${backed_up} or ${not_backed_up}
    ...    msg=The account row shows neither backup indicator, so the screen does not say whether the account is protected.
    # DeviceAccountRow renders Back Up only when the account is not yet covered.
    IF    ${not_backed_up}
        Page Should Contain Element    ${CB_ACCOUNT_BACK_UP}
        ...    message=The account is marked not backed up but its row offers no Back Up action.
    END
