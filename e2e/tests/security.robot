*** Settings ***
Documentation       PIN, duress PIN and lockout on Android and iOS from one suite. Every case starts on
...                 the Security screen and, once its flag gate passes, sets ${REGULAR_PIN} with no
...                 duress PIN, so any case runs alone. A duress wipe does not drop to onboarding: it provisions a decoy wallet and
...                 lands on an ordinary empty Home, so a wipe is proved by the PIN being gone.
Resource            ../resources/security.resource

Suite Setup         Run Keywords    Start Pera With Wallet    AND    Turn Pin Off
Suite Teardown      Run Keywords    Turn Pin Off    AND    Close Pera
Test Setup          Start On Security
Test Teardown       Capture Failure Screenshot
Test Tags           security


*** Test Cases ***
Duress Pin Can Be Enabled
    [Tags]    id:security.duress.enable    p0    rc
    Require Duress Pin Feature
    Set Duress Pin    ${DURESS_PIN}
    Regular Pin Should Still Be Set

Duress Pin Equal To The Regular Pin Is Rejected
    [Tags]    id:security.duress.rejects-regular-pin    p0    rc
    Require Duress Pin Feature
    Start Duress Pin Setup
    Enter Pin    ${REGULAR_PIN}
    Wait Until Page Contains Element    ${PIN_CONFIRM_TITLE}    timeout=15s
    Enter Pin    ${REGULAR_PIN}
    # The save handler refuses it and restarts the sheet at setup; the error toast is too brief to wait on.
    Wait Until Page Contains Element    ${PIN_SETUP_TITLE}    timeout=15s
    Close Pin Sheet
    Switch Should Be    ${DURESS_TOGGLE_ID}    ${False}

Mismatched Duress Confirmation Saves Nothing
    [Tags]    id:security.duress.mismatch-not-saved    p1
    Require Duress Pin Feature
    Start Duress Pin Setup
    Enter Pin    ${DURESS_PIN}
    Wait Until Page Contains Element    ${PIN_CONFIRM_TITLE}    timeout=15s
    Enter Pin    ${OTHER_PIN}
    # A mismatch stays on the confirm step; only a refused save goes back to setup.
    Wait Until Page Contains Element    ${PIN_CONFIRM_TITLE}    timeout=15s
    Page Should Contain Element    ${PIN_SHEET}
    Close Pin Sheet
    Switch Should Be    ${DURESS_TOGGLE_ID}    ${False}

Shake To Lock Can Be Switched On And Off
    [Documentation]    Only the switch: no device farm or simulator can drive the shake itself.
    [Tags]    id:security.shake-to-lock.toggle    p2
    Require Security Switch    ${SHAKE_TOGGLE_ID}    enable_motion_lock
    # The switch stays disabled until a PIN is set.
    Require Regular Pin
    Reveal On Security Screen    ${SHAKE_TOGGLE_ID}
    ${before}=    Switch Is On    ${SHAKE_TOGGLE_ID}
    Tap    ${SHAKE_TOGGLE}
    Switch Should Be    ${SHAKE_TOGGLE_ID}    ${{not $before}}
    Tap    ${SHAKE_TOGGLE}
    Switch Should Be    ${SHAKE_TOGGLE_ID}    ${before}

Regular Pin Unlocks Without Wiping
    [Tags]    id:security.duress.regular-pin-no-wipe    p0    rc
    Require Duress Pin Feature
    Set Duress Pin    ${DURESS_PIN}
    Lock By Restart
    Unlock With Pin    ${REGULAR_PIN}
    Open Security Settings
    Regular Pin Should Still Be Set
    Switch Should Be    ${DURESS_TOGGLE_ID}    ${True}

Wrong Pin Neither Unlocks Nor Wipes
    [Tags]    id:security.duress.wrong-pin-no-wipe    p0
    Require Duress Pin Feature
    Set Duress Pin    ${DURESS_PIN}
    Lock By Restart
    Enter Rejected Pin    ${OTHER_PIN}
    Unlock With Pin    ${REGULAR_PIN}
    Open Security Settings
    Regular Pin Should Still Be Set

Disabled Duress Pin Is Just A Wrong Pin
    [Tags]    id:security.duress.disable    p1
    Require Duress Pin Feature
    Set Duress Pin    ${DURESS_PIN}
    Disable Duress Pin
    Lock By Restart
    Enter Rejected Pin    ${DURESS_PIN}
    Unlock With Pin    ${REGULAR_PIN}
    Open Security Settings
    Regular Pin Should Still Be Set

Changed Regular Pin Is The Only One That Unlocks
    [Tags]    id:security.pin.change    p1
    Require Regular Pin
    Change Regular Pin    ${REGULAR_PIN}    ${NEW_REGULAR_PIN}
    Lock By Restart
    Enter Rejected Pin    ${REGULAR_PIN}
    Unlock With Pin    ${NEW_REGULAR_PIN}
    Open Security Settings
    Regular Pin Should Still Be Set
    [Teardown]    Run Keywords    Capture Failure Screenshot
    ...    AND    Restore Regular Pin

Changing The Regular Pin Keeps The Duress Pin
    [Tags]    id:security.duress.survives-pin-change    p1
    Require Duress Pin Feature
    Set Duress Pin    ${DURESS_PIN}
    Change Regular Pin    ${REGULAR_PIN}    ${NEW_REGULAR_PIN}
    Lock By Restart
    Enter Rejected Pin    ${REGULAR_PIN}
    Unlock With Pin    ${NEW_REGULAR_PIN}
    Open Security Settings
    Regular Pin Should Still Be Set
    Switch Should Be    ${DURESS_TOGGLE_ID}    ${True}
    [Teardown]    Run Keywords    Capture Failure Screenshot
    ...    AND    Restore Regular Pin

Repeated Wrong Pins Lock Out Without Wiping
    [Documentation]    Five wrong PINs swap the pad for a 30s lockout that offers, but does not run,
    ...                Reset All Data.
    [Tags]    id:security.lockout.no-wipe    p0    slow
    Require Regular Pin
    Lock By Restart
    FOR    ${attempt}    IN RANGE    5
        Enter Pin    ${OTHER_PIN}
        Wait Out Pin Check
        ${locked_out}=    Run Keyword And Return Status    Page Should Contain Element    ${LOCKOUT_VIEW}
        IF    ${locked_out}    BREAK
        Sleep    0.5s    reason=Let the error shake clear the dots before the next attempt.
    END
    Wait Until Page Contains Element    ${LOCKOUT_VIEW}    timeout=15s
    Page Should Contain Element    ${LOCKOUT_RESET_BUTTON}
    Wait Until Page Contains Element    ${PIN_VERIFY_TITLE}    timeout=45s
    Unlock With Pin    ${REGULAR_PIN}
    Open Security Settings
    Regular Pin Should Still Be Set

Backgrounding Past The Timeout Locks And Returns To The Same Screen
    [Tags]    id:security.autolock.background    p1    slow
    Require Regular Pin
    Lock By Background
    Unlock With Pin    ${REGULAR_PIN}
    Wait Until Page Contains Element    ${PIN_TOGGLE}    timeout=15s
    Regular Pin Should Still Be Set

Duress Pin Wipes The Wallet Silently
    [Tags]    id:security.duress.wipe    p0    rc
    Require Duress Pin Feature
    Set Duress Pin    ${DURESS_PIN}
    Lock By Restart
    Enter Duress Pin At Lock Screen    ${DURESS_PIN}
    Page Should Not Contain Element    ${CREATE_WALLET_BUTTON}
    # Anything naming the duress PIN would expose the user to whoever made them enter it.
    Page Should Not Contain Text    Duress
    Settle After Wipe
    Wallet Should Have Been Wiped

Wipe Survives An App Restart
    [Tags]    id:security.duress.wipe-persists-restart    p0
    Require Duress Pin Feature
    Set Duress Pin    ${DURESS_PIN}
    Lock By Restart
    Enter Duress Pin At Lock Screen    ${DURESS_PIN}
    Restart Pera
    Wait Until Page Contains Element    ${MENU_TAB}    timeout=30s
    Settle After Wipe
    Wallet Should Have Been Wiped

Replaced Duress Pin Stops Wiping And The New One Wipes
    [Documentation]    There is no change-duress screen; replacing it is off then on with a new PIN.
    [Tags]    id:security.duress.replace    p1
    Require Duress Pin Feature
    Set Duress Pin    ${DURESS_PIN}
    Disable Duress Pin
    Set Duress Pin    ${NEW_DURESS_PIN}
    Lock By Restart
    Enter Rejected Pin    ${DURESS_PIN}
    Enter Duress Pin At Lock Screen    ${NEW_DURESS_PIN}
    Settle After Wipe
    Wallet Should Have Been Wiped
