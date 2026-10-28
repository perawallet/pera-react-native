*** Settings ***
Documentation       PIN, duress PIN and lock screen keywords. A PIN set at the start of a launch locks
...                 the app on its next cold start (useAutoLockListener), so Restart Pera is the fast
...                 lock; only the background auto-lock path needs the two-minute wait.
Resource            app.resource


*** Variables ***
${REGULAR_PIN}                  123456
${DURESS_PIN}                   654321
${OTHER_PIN}                    112233
${NEW_REGULAR_PIN}              445566
${NEW_DURESS_PIN}               778899
# The PIN the app holds once a case changes it; Restore Regular Pin reads it.
${CURRENT_PIN}                  ${REGULAR_PIN}
# AUTO_LOCK_TIMEOUT_MS is 2 minutes and the lock only arms once the background time exceeds it.
${AUTO_LOCK_BACKGROUND}         125

${MENU_SETTINGS_BUTTON}         tid=menu_settings_button
${SETTINGS_ITEM_SECURITY}       tid=settings_item_security
${PIN_TOGGLE_ID}                settings_security_pin_toggle
${DURESS_TOGGLE_ID}             settings_security_duress_pin_toggle
${SHAKE_TOGGLE_ID}              settings_security_shake_to_lock_toggle
${PIN_TOGGLE}                   tid=${PIN_TOGGLE_ID}
${DURESS_TOGGLE}                tid=${DURESS_TOGGLE_ID}
${SHAKE_TOGGLE}                 tid=${SHAKE_TOGGLE_ID}
${REKEY_TOGGLE}                 tid=settings_security_rekey_toggle
${CHANGE_PIN_BUTTON}            tid=settings_security_change_pin_button
# A bare testID on the sheet's container: a resource-id on Android, a name on iOS.
${PIN_SHEET}                    tid=settings_security_pin_edit_view
${PIN_SHEET_CLOSE}              tid=close-button
${LOCKOUT_VIEW}                 tid=security_lockout_view
${LOCKOUT_RESET_BUTTON}         tid=security_lockout_reset_button
# The PIN steps and the lock screen carry no testID, only their title (security.pin.* in en.json).
# Android exposes text as @text, iOS as @label; multi-line titles are matched on their first line.
${PIN_SETUP_TITLE}              xpath=//*[contains(@text,'Choose your') or contains(@label,'Choose your')]
${PIN_CONFIRM_TITLE}            xpath=//*[contains(@text,'Re-enter your') or contains(@label,'Re-enter your')]
${PIN_VERIFY_TITLE}             xpath=//*[contains(@text,'Enter your PIN') or contains(@label,'Enter your PIN')]
${PIN_CHANGE_OLD_TITLE}         xpath=//*[contains(@text,'Enter your old') or contains(@label,'Enter your old')]
${PIN_LOGGING_IN}               xpath=//*[contains(@text,'Logging in') or contains(@label,'Logging in')]


*** Keywords ***
Start On Security
    [Documentation]    Security screen, whatever the last case left: locked, wiped back to a decoy
    ...                wallet, or dropped to onboarding by a failed wipe. Sets no PIN, so a case that
    ...                skips on a flag costs only the navigation.
    Unlock If Locked
    ${onboarding}=    Run Keyword And Return Status    Page Should Contain Element    ${CREATE_WALLET_BUTTON}
    IF    ${onboarding}
        Create Wallet
        Wait Clear Of Startup Prompts
    END
    Tap If Present    ${TERMS_AGREE_BUTTON}
    Tap If Present    ${BANNERS_MODAL_CLOSE}
    Go Home
    Open Security Settings

Require Regular Pin
    [Documentation]    ${REGULAR_PIN} as the PIN and no duress PIN, on the Security screen.
    ${top}=    Run Keyword And Return Status    Page Should Contain Element    ${PIN_TOGGLE}
    IF    not ${top}    Scroll Into View    ${PIN_TOGGLE_ID}
    # The screen reads the PIN record after mount, so both switches start off; give the read a
    # moment before deciding the PIN is missing.
    ${pin_set}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${CHANGE_PIN_BUTTON}    timeout=3s
    IF    not ${pin_set}    Set Regular Pin    ${REGULAR_PIN}
    Ensure Duress Pin Off

Open Security Settings
    # Right after an unlock the lock screen is gone before Home has rendered.
    Wait Until Page Contains Element    ${MENU_TAB}    timeout=30s
    Tap    ${MENU_TAB}
    Wait Until Page Contains Element    ${MENU_SETTINGS_BUTTON}    timeout=15s
    Tap    ${MENU_SETTINGS_BUTTON}
    Wait Until Page Contains Element    ${SETTINGS_ITEM_SECURITY}    timeout=15s
    Tap    ${SETTINGS_ITEM_SECURITY}
    Wait Until Page Contains Element    ${PIN_TOGGLE}    timeout=15s

Require Duress Pin Feature
    [Documentation]    Skips before any PIN is set when the flag is off.
    Require Security Switch    ${DURESS_TOGGLE_ID}    enable_duress_pin
    Require Regular Pin

Require Security Switch
    [Documentation]    Duress PIN (enable_duress_pin) and shake to lock (enable_motion_lock) are
    ...                remote-config flags that default to off. The PIN switch proves this is the
    ...                Security screen, so a missing switch is the flag, not a broken navigation.
    [Arguments]    ${test_id}    ${flag}
    Page Should Contain Element    ${PIN_TOGGLE}
    ${shown}=    Reveal On Security Screen    ${test_id}
    Skip If    not ${shown}    Remote config flag ${flag} is off on this build.

Reveal On Security Screen
    [Documentation]    The advanced switches sit at the bottom of the screen and Android only reports
    ...                what is on screen.
    [Arguments]    ${test_id}
    ${shown}=    Run Keyword And Return Status    Page Should Contain Element    tid=${test_id}
    IF    ${shown}    RETURN    ${True}
    # The advanced panel starts collapsed when no advanced flag or setting is on; the switch is
    # then not rendered at all, so there is nothing to scroll to.
    ${expanded}=    Run Keyword And Return Status    Page Should Contain Element    ${REKEY_TOGGLE}
    IF    not ${expanded}    RETURN    ${False}
    ${shown}=    Run Keyword And Return Status    Scroll Into View    ${test_id}
    RETURN    ${shown}

Enter Pin
    [Documentation]    The pad advances by itself on the sixth digit.
    [Arguments]    ${pin}
    Wait Until Page Contains Element    tid=numpad_key_0    timeout=15s
    FOR    ${digit}    IN    @{{ list($pin) }}
        Tap    tid=numpad_key_${digit}
    END

Set Regular Pin
    [Arguments]    ${pin}
    Tap    ${PIN_TOGGLE}
    Enter New Pin Twice    ${pin}
    Wait Until Page Contains Element    ${CHANGE_PIN_BUTTON}    timeout=15s

Enter New Pin Twice
    [Documentation]    Setup then confirm; the sheet closes once the save handler accepts it.
    [Arguments]    ${pin}
    Wait Until Page Contains Element    ${PIN_SETUP_TITLE}    timeout=15s
    Enter Pin    ${pin}
    Wait Until Page Contains Element    ${PIN_CONFIRM_TITLE}    timeout=15s
    Enter Pin    ${pin}
    Wait Until Page Does Not Contain Element    ${PIN_SHEET}    timeout=15s

Start Duress Pin Setup
    Reveal On Security Screen    ${DURESS_TOGGLE_ID}
    Tap    ${DURESS_TOGGLE}
    Wait Until Page Contains Element    ${PIN_SETUP_TITLE}    timeout=15s

Set Duress Pin
    [Arguments]    ${pin}
    Start Duress Pin Setup
    Enter New Pin Twice    ${pin}
    Switch Should Be    ${DURESS_TOGGLE_ID}    ${True}

Disable Duress Pin
    [Documentation]    Turning duress off asks for the regular PIN first, so someone holding an
    ...                unlocked phone cannot quietly remove it.
    Reveal On Security Screen    ${DURESS_TOGGLE_ID}
    Tap    ${DURESS_TOGGLE}
    Wait Until Page Contains Element    ${PIN_VERIFY_TITLE}    timeout=15s
    Enter Pin    ${REGULAR_PIN}
    Wait Until Page Does Not Contain Element    ${PIN_SHEET}    timeout=15s
    Switch Should Be    ${DURESS_TOGGLE_ID}    ${False}

Ensure Duress Pin Off
    ${present}=    Reveal On Security Screen    ${DURESS_TOGGLE_ID}
    IF    not ${present}    RETURN
    ${on}=    Switch Is On    ${DURESS_TOGGLE_ID}
    IF    ${on}    Disable Duress Pin

Close Pin Sheet
    [Documentation]    The PIN sheet ignores backdrop taps and swipes; its close button is the only way out.
    Tap    ${PIN_SHEET_CLOSE}
    Wait Until Page Does Not Contain Element    ${PIN_SHEET}    timeout=10s

Change Regular Pin
    [Arguments]    ${current}    ${new}
    Tap    ${CHANGE_PIN_BUTTON}
    Wait Until Page Contains Element    ${PIN_CHANGE_OLD_TITLE}    timeout=15s
    Enter Pin    ${current}
    Enter New Pin Twice    ${new}
    Set Test Variable    ${CURRENT_PIN}    ${new}

Restore Regular Pin
    [Documentation]    Teardown for the case that changes the PIN: every other case unlocks with
    ...                ${REGULAR_PIN}. A no-op when the case failed before changing it.
    IF    $CURRENT_PIN == $REGULAR_PIN    RETURN
    Unlock If Locked    ${CURRENT_PIN}
    Go Home
    Open Security Settings
    Change Regular Pin    ${CURRENT_PIN}    ${REGULAR_PIN}

Lock By Restart
    [Documentation]    A cold start with a PIN set opens on the lock screen.
    Restart Pera
    Wait Until Page Contains Element    ${PIN_VERIFY_TITLE}    timeout=30s

Lock By Background
    Background Application    ${AUTO_LOCK_BACKGROUND}
    Wait Until Page Contains Element    ${PIN_VERIFY_TITLE}    timeout=30s

Unlock If Locked
    [Arguments]    ${pin}=${REGULAR_PIN}
    ${locked}=    Run Keyword And Return Status    Page Should Contain Element    ${PIN_VERIFY_TITLE}
    IF    ${locked}    Unlock With Pin    ${pin}

Clear Pin Pad
    [Documentation]    The pad keeps typed digits across attempts and has no testID on its dots, so a
    ...                tap lost or doubled under load would shift every later PIN. Start each lock
    ...                screen entry from an empty pad.
    Wait Until Page Contains Element    tid=numpad_key_delete    timeout=15s
    FOR    ${i}    IN RANGE    6
        Click Element    tid=numpad_key_delete
    END

Unlock With Pin
    [Arguments]    ${pin}
    Clear Pin Pad
    Enter Pin    ${pin}
    Wait Until Page Does Not Contain Element    ${PIN_VERIFY_TITLE}    timeout=30s

Enter Rejected Pin
    [Documentation]    A PIN the lock screen must refuse. It is verified behind a Logging in overlay,
    ...                then the dots shake for 250ms and clear; digits typed during the shake are lost.
    [Arguments]    ${pin}
    Clear Pin Pad
    Enter Pin    ${pin}
    Wait Out Pin Check
    Wait Until Page Contains Element    ${PIN_VERIFY_TITLE}    timeout=5s
    Sleep    0.5s    reason=The dots shake for 250ms and clear; digits typed meanwhile are lost.

Wait Out Pin Check
    [Documentation]    The Logging in overlay replaces the whole lock screen while a PIN is checked,
    ...                title included, and can take a moment to appear after the sixth digit.
    Run Keyword And Return Status    Wait Until Page Contains Element    ${PIN_LOGGING_IN}    timeout=3s
    Wait Until Page Does Not Contain Element    ${PIN_LOGGING_IN}    timeout=30s

Enter Duress Pin At Lock Screen
    [Documentation]    The wipe and decoy wallet are created behind the Logging in overlay, and the
    ...                lock lifts only after both finish.
    [Arguments]    ${pin}
    Clear Pin Pad
    Enter Pin    ${pin}
    Wait Until Page Does Not Contain Element    ${PIN_VERIFY_TITLE}    timeout=120s

Settle After Wipe
    [Documentation]    The wipe clears preferences, so the accepted terms and banner state go with it.
    Tap If Shown    ${TERMS_AGREE_BUTTON}    10s
    Wait Clear Of Startup Prompts
    Go Home
    Open Security Settings

Regular Pin Should Still Be Set
    [Documentation]    A wipe clears the PIN; reaching Home proves nothing because the decoy
    ...                wallet lands there too.
    Wait Until Page Contains Element    ${CHANGE_PIN_BUTTON}    timeout=15s
    ...    error=The regular PIN is gone, so a wipe ran when it should not have.

Wallet Should Have Been Wiped
    Switch Should Be    ${PIN_TOGGLE_ID}    ${False}
    # The switch also reads off for a moment before the PIN record loads.
    ${pin_set}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${CHANGE_PIN_BUTTON}    timeout=3s
    Should Not Be True    ${pin_set}    The regular PIN survived the duress PIN, so the wipe did not run.

Turn Pin Off
    [Documentation]    Suite setup and teardown: a PIN left on locks every later suite on its cold
    ...                start, and a run that died mid-change can leave ${NEW_REGULAR_PIN} behind, so
    ...                this tries every PIN a suite sets. Removing the PIN record removes the duress
    ...                PIN with it.
    Unlock With Known Pins
    Go Home
    Open Security Settings
    ${pin_set}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${CHANGE_PIN_BUTTON}    timeout=3s
    IF    not ${pin_set}    RETURN
    Tap    ${PIN_TOGGLE}
    Wait Until Page Contains Element    ${PIN_VERIFY_TITLE}    timeout=15s
    FOR    ${pin}    IN    @{E2E_PINS}
        Clear Pin Pad
        Enter Pin    ${pin}
        ${off}=    Run Keyword And Return Status
        ...    Wait Until Page Does Not Contain Element    ${CHANGE_PIN_BUTTON}    timeout=5s
        IF    ${off}    RETURN
    END
    Fail    None of the known PINs turned the PIN off.
