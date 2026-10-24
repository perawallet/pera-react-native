*** Settings ***
Documentation       Native capabilities: camera permission, capture protection, connectivity and
...                 biometrics. How each is driven differs by platform, so every such step is an
...                 adapter keyword (Deny Camera Permission, Screen Should Be Capture Protected,
...                 Set Network Offline, Enroll Biometrics, Match Biometric and their pairs).
Resource            accounts.resource
Resource            security.resource


*** Variables ***
# Bare testIDs on a touchable: a resource-id on Android, a name on iOS.
${QR_SCANNER_BUTTON}            xpath=//*[@resource-id='account_screen_qr_scanner_button' or @name='account_screen_qr_scanner_button']
# The scanner's no-camera/denied view has no testID; its title is the handle (camera.no_camera_device_found).
${CAMERA_DENIED_TITLE}          xpath=//*[@text='No camera device found or missing permissions.' or @label='No camera device found or missing permissions.']
${CAMERA_DENIED_CLOSE}          xpath=//*[@text='Close' or @label='Close']
# The offline pill has no testID either (common.offline_mode).
${OFFLINE_BANNER}               xpath=//*[@text='Offline Mode' or @label='Offline Mode']
${BIOMETRIC_TOGGLE_ID}          settings_security_biometric_toggle
${BIOMETRIC_TOGGLE}             xpath=//*[@resource-id='${BIOMETRIC_TOGGLE_ID}' or @name='${BIOMETRIC_TOGGLE_ID}' or @content-desc='${BIOMETRIC_TOGGLE_ID}']


*** Keywords ***
Restore Camera Permission
    Capture Failure Screenshot
    Grant Camera Permission
    Relaunch Pera

Restore Network
    Capture Failure Screenshot
    Set Network Online

Open Passphrase
    Open Account Option    ${OPTION_VIEW_PASSPHRASE}
    Wait Until Settled    ${PASSPHRASE_ACK_REVEAL}
    FOR    ${i}    IN RANGE    4
        ${row_locator}=    Passphrase Ack Row    ${i}
        Tap    ${row_locator}
    END
    Tap    ${PASSPHRASE_ACK_REVEAL}
    Wait Until Page Contains Element    ${PASSPHRASE_GRID}    timeout=20s

Require Biometric Switch
    [Documentation]    The switch shows only with a PIN set and a biometric enrolled on the device, and
    ...                the screen reads availability on mount, so reopen it after enrolling.
    Enroll Biometrics
    Go Home
    Open Security Settings
    ${shown}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${BIOMETRIC_TOGGLE}    timeout=5s
    Skip If    not ${shown}
    ...    No biometric is enrolled on this device. Android emulators enrol a fingerprint only through the system Settings screen-lock flow, which the harness does not automate.

Biometric Match Should Turn Switch On
    Match Biometric
    ${on}=    Switch Locator    ${BIOMETRIC_TOGGLE_ID}    ${True}
    Page Should Contain Element    ${on}

Biometric Match Should Unlock
    [Documentation]    While the system prompt is up the app's own elements are hidden, so Home has to
    ...                be present as well as the PIN pad gone.
    Match Biometric
    Page Should Not Contain Element    ${PIN_VERIFY_TITLE}
    Page Should Contain Element    ${MENU_TAB}

Turn Biometrics And Pin Off
    [Documentation]    Removing the PIN deletes the biometric unlock with it (usePinCode).
    Capture Failure Screenshot
    Turn Pin Off

Leave Scanner To Home
    [Documentation]    Home after the scanner, however many layers are still up.
    ...
    ...                Back alone was not enough: it reached Home on one pass and not the next,
    ...                because a back press on the scanner can be swallowed and the screen is
    ...                capture-protected, so the screenshot that follows is blank and says
    ...                nothing. Fall back to the fixture reset, which is how every other suite
    ...                gets to Home and does not depend on a press landing.
    FOR    ${attempt}    IN RANGE    3
        ${home}=    Run Keyword And Return Status
        ...    Wait Until Page Contains Element    ${MENU_TAB}    timeout=8s
        IF    ${home}    RETURN
        Run Keyword And Ignore Error    Tap Back
    END
    Run Keyword And Ignore Error    Go Home
    Wait Until Page Contains Element    ${MENU_TAB}    timeout=15s
    ...    error=Neither the back press nor a fixture reset got the scanner flow back to Home.

