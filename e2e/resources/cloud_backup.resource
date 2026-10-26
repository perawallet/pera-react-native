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

${MENU_SETTINGS_BUTTON}             xpath=//*[@resource-id='menu_settings_button' or @name='menu_settings_button' or @content-desc='menu_settings_button']
${SETTINGS_DEVELOPER_ROW}           xpath=//*[@resource-id='settings_item_developer_settings' or @name='settings_item_developer_settings' or @content-desc='settings_item_developer_settings']
${SETTINGS_APP_VERSION}             xpath=//*[@resource-id='settings_app_version' or @name='settings_app_version']
# The toast carries no testID; matched on settings.developer.debug_tools_enabled (English). iOS keeps
# a dismissed toast in the tree off-screen with visible=false.
${DEBUG_TOOLS_ENABLED_TOAST}        xpath=//*[(@text='Debug tools enabled' or @label='Debug tools enabled') and not(@visible='false')]
${DEBUG_TOOLS_ROW}                  xpath=//*[@resource-id='developer_settings_debug_tools_item' or @name='developer_settings_debug_tools_item' or @content-desc='developer_settings_debug_tools_item']
${FEATURE_FLAGS_ROW}                xpath=//*[@resource-id='debug_tools_feature_flags_item' or @name='debug_tools_feature_flags_item' or @content-desc='debug_tools_feature_flags_item']
${CB_FLAG_EXPAND}                   xpath=//*[@resource-id='feature_flag_expand_enable_cloud_backup' or @name='feature_flag_expand_enable_cloud_backup' or @content-desc='feature_flag_expand_enable_cloud_backup']
${CB_FLAG_OVERRIDE}                 xpath=//*[@resource-id='feature_flag_override_enable_cloud_backup' or @name='feature_flag_override_enable_cloud_backup' or @content-desc='feature_flag_override_enable_cloud_backup']
${CB_SETTINGS_ROW}                  xpath=//*[@resource-id='settings_item_cloud_backup' or @name='settings_item_cloud_backup' or @content-desc='settings_item_cloud_backup']

${CB_INTRO_SCREEN}                  xpath=//*[@resource-id='cloud_backup_intro_screen' or @name='cloud_backup_intro_screen']
${CB_INTRO_STEPS}                   xpath=//*[@resource-id='cloud_backup_intro_steps' or @name='cloud_backup_intro_steps']
${CB_INTRO_CONTINUE}                xpath=//*[@resource-id='cloud_backup_intro_continue_button' or @name='cloud_backup_intro_continue_button' or @content-desc='cloud_backup_intro_continue_button']
${CB_SCREEN}                        xpath=//*[@resource-id='cloud_backup_screen' or @name='cloud_backup_screen']
${CB_SETUP_OPTION}                  xpath=//*[@resource-id='cloud_backup_setup_option' or @name='cloud_backup_setup_option' or @content-desc='cloud_backup_setup_option']
${CB_RESTORE_OPTION}                xpath=//*[@resource-id='cloud_backup_restore_option' or @name='cloud_backup_restore_option' or @content-desc='cloud_backup_restore_option']
# Whichever screen the Settings row lands on: intro (first visit), choice, or overview (configured).
${CB_ENTRY_ANY}                     xpath=//*[@resource-id='cloud_backup_intro_screen' or @name='cloud_backup_intro_screen' or @resource-id='cloud_backup_screen' or @name='cloud_backup_screen' or @resource-id='cloud_backup_overview_screen' or @name='cloud_backup_overview_screen']

${CB_SETUP_SCREEN}                  xpath=//*[@resource-id='cloud_backup_setup_screen' or @name='cloud_backup_setup_screen']
${CB_SETUP_CHECKBOX}                xpath=//*[@resource-id='cloud_backup_setup_checkbox' or @name='cloud_backup_setup_checkbox' or @content-desc='cloud_backup_setup_checkbox']
${CB_SETUP_PROCEED}                 xpath=//*[@resource-id='cloud_backup_setup_proceed_button' or @name='cloud_backup_setup_proceed_button' or @content-desc='cloud_backup_setup_proceed_button']

${CB_VERIFY_SCREEN}                 xpath=//*[@resource-id='cloud_backup_verify_screen' or @name='cloud_backup_verify_screen']
${CB_VERIFY_PROCEED}                xpath=//*[@resource-id='cloud_backup_verify_proceed_button' or @name='cloud_backup_verify_proceed_button' or @content-desc='cloud_backup_verify_proceed_button']
# BackupQuizItem's label has no testID; matched on backup.verification.select_word (English).
${QUIZ_LABEL_ANY}                   xpath=//*[starts-with(@text,'Select word #') or (starts-with(@label,'Select word #') and @accessible='true')]
# The toast carries no testID; matched on cloud_backup.verify.error_message (English).
${CB_VERIFY_WRONG_TOAST}            xpath=//*[contains(@text,'Incorrect selection') or contains(@label,'Incorrect selection') or contains(@name,'Incorrect selection')]

${CB_STORE_KEY_SCREEN}              xpath=//*[@resource-id='cloud_backup_store_encryption_key_screen' or @name='cloud_backup_store_encryption_key_screen']
${CB_STORE_KEY_CHECKBOX}            xpath=//*[@resource-id='cloud_backup_store_encryption_key_checkbox' or @name='cloud_backup_store_encryption_key_checkbox' or @content-desc='cloud_backup_store_encryption_key_checkbox']
${CB_STORE_KEY_ENABLE}              xpath=//*[@resource-id='cloud_backup_store_encryption_key_enable_button' or @name='cloud_backup_store_encryption_key_enable_button' or @content-desc='cloud_backup_store_encryption_key_enable_button']

${CB_OVERVIEW_SCREEN}               xpath=//*[@resource-id='cloud_backup_overview_screen' or @name='cloud_backup_overview_screen']
${CB_OVERVIEW_ACCOUNTS}             xpath=//*[@resource-id='cloud_backup_overview_accounts' or @name='cloud_backup_overview_accounts' or @content-desc='cloud_backup_overview_accounts']
${CB_OVERVIEW_CONTACTS}             xpath=//*[@resource-id='cloud_backup_overview_contacts' or @name='cloud_backup_overview_contacts' or @content-desc='cloud_backup_overview_contacts']
${CB_OVERVIEW_PASSKEYS}             xpath=//*[@resource-id='cloud_backup_overview_passkeys' or @name='cloud_backup_overview_passkeys' or @content-desc='cloud_backup_overview_passkeys']
${CB_OVERVIEW_CREDENTIAL_ADDRESS}   xpath=//*[@resource-id='cloud_backup_overview_credential_address' or @name='cloud_backup_overview_credential_address' or @content-desc='cloud_backup_overview_credential_address']
${CB_OVERVIEW_SYNC_DEVICES}         xpath=//*[@resource-id='cloud_backup_overview_sync_devices' or @name='cloud_backup_overview_sync_devices' or @content-desc='cloud_backup_overview_sync_devices']
${CB_OVERVIEW_TURN_OFF}             xpath=//*[@resource-id='cloud_backup_overview_turn_off' or @name='cloud_backup_overview_turn_off' or @content-desc='cloud_backup_overview_turn_off']
# TurnOffBackupSheet passes no testIDs, so its "Turn Off Backup" option is matched on its English title.
${CB_TURN_OFF_OPTION}               xpath=//*[@text='Turn Off Backup' or @label='Turn Off Backup']
${CB_TURN_OFF_CONFIRM}              xpath=//*[@resource-id='confirm_turn_off_backup_confirm' or @name='confirm_turn_off_backup_confirm' or @content-desc='confirm_turn_off_backup_confirm']

${CB_ACCOUNTS_SCREEN}               xpath=//*[@resource-id='cloud_backup_accounts_screen' or @name='cloud_backup_accounts_screen']
${CB_CONTACTS_SCREEN}               xpath=//*[@resource-id='cloud_backup_contacts_screen' or @name='cloud_backup_contacts_screen']
${CB_PASSKEYS_SCREEN}               xpath=//*[@resource-id='cloud_backup_passkeys_screen' or @name='cloud_backup_passkeys_screen']
# The row id carries the address; the Back Up button shares the prefix, so it is excluded.
${CB_ACCOUNT_ROW_ANY}               xpath=//*[(starts-with(@resource-id,'cloud_backup_account_') and not(contains(@resource-id,'_back_up'))) or (starts-with(@name,'cloud_backup_account_') and not(contains(@name,'_back_up')))]
${CB_ACCOUNT_BACK_UP}               xpath=//*[@resource-id='cloud_backup_account_back_up' or @name='cloud_backup_account_back_up' or @content-desc='cloud_backup_account_back_up']
${CB_ACCOUNT_BACKED_UP}             xpath=//*[@resource-id='backup_account_row_backed_up' or @name='backup_account_row_backed_up']
${CB_ACCOUNT_NOT_BACKED_UP}         xpath=//*[@resource-id='backup_account_row_not_backed_up' or @name='backup_account_row_not_backed_up']


*** Keywords ***
Skip Unless Backend Keyed
    [Documentation]    A correct quiz answer registers the backup, which needs a deviceId from the
    ...                backend; a build without BACKEND_API_KEY gets a 401 there and never leaves
    ...                the verify screen, which reads exactly like a missing element.
    Skip If    not $BACKEND_KEYED
    ...    Needs a build carrying BACKEND_API_KEY; set PERA_E2E_BACKEND_KEYED=1 when the build has one.

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
    Swipe Until In View    ${SETTINGS_DEVELOPER_ROW}
    Tap    ${SETTINGS_DEVELOPER_ROW}
    Swipe Until In View    ${DEBUG_TOOLS_ROW}
    Tap    ${DEBUG_TOOLS_ROW}
    # Debug Tools is still sliding in when its rows appear; a tap then misses the row.
    Wait Until Settled    ${FEATURE_FLAGS_ROW}
    Tap    ${FEATURE_FLAGS_ROW}
    Scroll Into View    feature_flag_expand_enable_cloud_backup
    Tap    ${CB_FLAG_EXPAND}
    Scroll Into View    feature_flag_override_enable_cloud_backup
    Tap    ${CB_FLAG_OVERRIDE}

Unlock Debug Tools
    [Documentation]    Ten taps on the version row, each within 1s of the last (AppVersion.tsx resets the
    ...                count on a longer gap). Re-locating the element per tap can exceed that on a
    ...                loaded device, so the point is resolved once and tapped by coordinate.
    # The footer stays in the lower quarter even scrolled to the end, which Swipe Until In View refuses.
    Scroll Into View    settings_app_version
    ${loc}=    Get Element Location    ${SETTINGS_APP_VERSION}
    ${size}=    Get Element Size    ${SETTINGS_APP_VERSION}
    VAR    @{point}    ${{int($loc['x'] + $size['width'] / 2)}}    ${{int($loc['y'] + $size['height'] / 2)}}
    AppiumLibrary.Tap    ${point}    count=10    duration=0.05s
    # The success toast proves the unlock, and while up it swallows taps on the top row of the next
    # screens (Feature Flags on Debug Tools).
    Wait Until Page Contains Element    ${DEBUG_TOOLS_ENABLED_TOAST}    timeout=5s
    Wait Until Page Does Not Contain Element    ${DEBUG_TOOLS_ENABLED_TOAST}    timeout=10s

Swipe Until In View
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
    Swipe Until In View    ${CB_OVERVIEW_TURN_OFF}
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
    # Last row above the sticky footer: it never reaches the upper three quarters Swipe Until In View wants.
    Scroll Into View    cloud_backup_setup_checkbox
    Tap    ${CB_SETUP_CHECKBOX}

Acknowledge Store Key
    Scroll Into View    cloud_backup_store_encryption_key_checkbox
    Tap    ${CB_STORE_KEY_CHECKBOX}

Should Be Enabled
    [Arguments]    ${locator}    ${expected}    ${msg}
    ${enabled}=    Get Element Attribute    ${locator}    enabled
    Should Be Equal As Strings    ${enabled}    ${expected}    msg=${msg}    values=False

Read Passphrase
    [Documentation]    The grid cell holds the testID and has no text of its own; the position number
    ...                and the word follow it as text nodes (siblings on Android, children on iOS,
    ...                where each text also appears twice, nested in itself). Walking one page source
    ...                in document order reads both trees the same way: the word is the second
    ...                distinct text after its cell. Safe to read: a fresh backup-encryption key for
    ...                the throwaway wallet, not an account passphrase.
    ${src}=    Get Source
    @{cells}=    Get Regexp Matches    ${src}    (?:resource-id|name)="passphrase_word_(\\d+)"    1
    @{cells}=    Remove Duplicates    ${cells}
    VAR    @{words}    @{EMPTY}
    FOR    ${n}    IN    @{cells}
        @{segment}=    Get Regexp Matches    ${src}    (?s)passphrase_word_${n}"((?:(?!passphrase_word_\\d+").)*)    1
        @{texts}=    Get Regexp Matches    ${segment}[0]    \\s(?:text|label)="([^"]+)"    1
        ${word}=    Evaluate    ([t for i, t in enumerate($texts) if i == 0 or t != $texts[i - 1]] + ['', ''])[1]
        Append To List    ${words}    ${word}
    END
    RETURN    @{words}

Quiz Item
    [Arguments]    ${index}
    RETURN    xpath=//*[@resource-id='cloud_backup_verify_item_${index}' or @name='cloud_backup_verify_item_${index}']

Asked Word Position
    [Documentation]    The "Select word #N" label drawn inside the item's container. Matched by position,
    ...                since the label follows the container in Android's source but precedes it in
    ...                iOS's, so a source-order match would take a neighbouring row's label there.
    [Arguments]    ${index}
    ${item}=    Quiz Item    ${index}
    ${box}=    Get Element Location    ${item}
    ${size}=    Get Element Size    ${item}
    @{labels}=    Get WebElements    ${QUIZ_LABEL_ANY}
    FOR    ${label}    IN    @{labels}
        ${at}=    Get Element Location    ${label}
        IF    ${box}[y] <= ${at}[y] < ${box}[y] + ${size}[height]
            ${text}=    Get Text    ${label}
            @{found}=    Get Regexp Matches    ${text}    Select word \\#(\\d+)    1
            IF    $found    RETURN    ${found}[0]
        END
    END
    Fail    Quiz item ${index} shows no "Select word #N" label.

Quiz Option Locator
    [Documentation]    The option under item ${index} that shows ${word}.
    ...
    ...                An option's testID carries its POSITION, not the word, and deliberately so:
    ...                the options are words from the recovery phrase, and a word in a testID
    ...                becomes a resource-id on Android - visible in the view hierarchy, in any
    ...                captured tree and in CI artifacts. So match on what the option displays.
    [Arguments]    ${index}    ${word}
    ${prefix}=    Set Variable    cloud_backup_verify_item_${index}_option_
    RETURN    xpath=//*[(starts-with(@resource-id,'${prefix}') or starts-with(@name,'${prefix}')) and (@text='${word}' or @label='${word}' or @name='${word}' or @resource-id='${word}' or .//*[@text='${word}' or @label='${word}' or @name='${word}'])]

Quiz Option Words
    [Documentation]    The words item ${index} is offering, read off the options themselves.
    [Arguments]    ${index}
    ${prefix}=    Set Variable    cloud_backup_verify_item_${index}_option_
    # The option is a touchable whose word sits in a child text node, so reading the option
    # itself gives back an empty string on Android - which then went on as the "wrong word".
    @{elements}=    Get WebElements
    ...    xpath=//*[starts-with(@resource-id,'${prefix}') or starts-with(@name,'${prefix}')]//*[string-length(@text) > 0 or string-length(@label) > 0 or string-length(@name) > 0]
    @{words}=    Create List
    FOR    ${element}    IN    @{elements}
        ${text}=    Get Text    ${element}
        ${word}=    Set Variable    ${{ $text.strip() }}
        ${known}=    Evaluate    $word in $words
        IF    $word and not ${known}    Append To List    ${words}    ${word}
    END
    RETURN    @{words}

Distractor For
    [Documentation]    An option the app offers for the item that is not the correct word.
    ...
    ...                The options render a moment after the item scrolls into view, and reading
    ...                them in that moment returns only the one word that is already there. "The
    ...                quiz offered no alternative" is then a statement about our timing, not about
    ...                the app, so keep asking for a few seconds before believing it.
    [Arguments]    ${index}    ${correct}
    @{options}=    Wait Until Keyword Succeeds    5s    0.5s
    ...    Quiz Options Other Than    ${index}    ${correct}
    RETURN    ${options}[0]

Quiz Options Other Than
    [Arguments]    ${index}    ${correct}
    @{options}=    Quiz Option Words    ${index}
    Remove Values From List    ${options}    ${correct}
    Should Not Be Empty    ${options}
    ...    msg=Quiz item ${index} offers no word other than the correct "${correct}", so answering it proves nothing.
    RETURN    @{options}

Answer Verify Quiz
    [Documentation]    Answers every item from the passphrase the setup screen showed. With
    ...                wrong_index, that one item gets a distractor instead; returns the word used.
    ...                Each item is answered once: selection is a style only, so a replaced answer
    ...                cannot be read back to confirm it took.
    [Arguments]    ${words}    ${wrong_index}=${-1}
    VAR    ${wrong}    ${EMPTY}
    FOR    ${i}    IN RANGE    ${CB_QUIZ_ITEMS}
        ${item}=    Quiz Item    ${i}
        Swipe Until In View    ${item}
        ${n}=    Asked Word Position    ${i}
        ${word}=    Get From List    ${words}    ${{int($n) - 1}}
        IF    ${i} == ${wrong_index}
            ${word}=    Distractor For    ${i}    ${word}
            VAR    ${wrong}    ${word}
        END
        # The last item's options sit just above the sticky footer, below where Swipe Until In View settles.
        ${option}=    Quiz Option Locator    ${i}    ${word}
        Scroll Until Tappable    ${option}
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
