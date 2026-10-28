*** Settings ***
Documentation       Account assets: add-asset search and opt-in sheet, the manage sheet (sort, filter,
...                 remove), and on the funded testnet account asset detail plus real opt-in/out.
Resource            send_receive.resource


*** Variables ***
${ADD_ASSET_BUTTON}             tid=add_asset_button
${ASSET_SEARCH_INPUT}           tid=searchable-list-search-input
# USDC by asset id: the result list can show other assets above the match. Scroll Into View takes
# the bare id.
${USDC_MAINNET_ID}              asset_row_31566704
${USDC_TESTNET_ID}              asset_row_10458941
${USDC_MAINNET_ROW}             tid=${USDC_MAINNET_ID}
${USDC_TESTNET_ROW}             tid=${USDC_TESTNET_ID}
${ALGO_ROW}                     tid=asset_row_0
${OPT_IN_CONFIRM}               tid=opt_in_confirm
${OPT_IN_FEE}                   tid=opt_in_fee
${OPT_OUT_CONFIRM}              tid=opt_out_confirm

${MANAGE_ASSETS_BUTTON}         tid=manage_assets_button
${MANAGE_SORT}                  tid=manage_assets_sort
${MANAGE_FILTER}                tid=manage_assets_filter
${MANAGE_REMOVE}                tid=manage_assets_remove
${SORT_DEFAULT}                 tid=asset_sort_option_balanceDesc
${SORT_ALPHABETICAL}            tid=asset_sort_option_alphabeticalAsc
${SORT_APPLY}                   tid=asset_sort_apply_button
${FILTER_HIDE_ZERO}             tid=asset_filter_hide_zero_balance
${FILTER_DISPLAY_NFTS}          tid=asset_filter_display_nfts
${FILTER_APPLY}                 tid=asset_filter_apply_button
${REMOVE_SELECT_ALL}            tid=remove_assets_select_all_button

${DETAIL_SEND}                  tid=asset_detail_send_button
${DETAIL_RECEIVE}               tid=asset_detail_receive_button
${DETAIL_SWAP}                  tid=asset_detail_swap_button
${NFTS_TAB}                     tid=tab_nfts
${FIRST_COLLECTIBLE}            xpath=(//*[starts-with(@content-desc, 'collectible_row_') or starts-with(@resource-id, 'collectible_row_') or starts-with(@name,'collectible_row_')])[1]
# Screen containers carry a bare testID (no accessibility label), which Android exposes as
# resource-id only; iOS exposes it as name.
${ASSET_DETAILS_SCREEN}         tid=asset_details_screen
${REMOVE_ASSETS_SCREEN}         tid=remove_assets_screen
${COLLECTIBLE_DETAIL_SCREEN}    tid=collectible_detail_screen


*** Keywords ***
Search Assets For USDC
    [Arguments]    ${result}
    Wait Until Settled    ${ADD_ASSET_BUTTON}
    Tap    ${ADD_ASSET_BUTTON}
    Wait Until Page Contains Element    ${ASSET_SEARCH_INPUT}    timeout=15s
    Input Text    ${ASSET_SEARCH_INPUT}    USDC
    # Remote lookup; allow for a slow backend rather than retyping.
    Wait Until Page Contains Element    ${result}    timeout=30s

Open Opt In Sheet
    [Arguments]    ${result}    ${asset_id}    ${already_listed}=${False}
    IF    not ${already_listed}    Search Assets For USDC    ${result}
    Dismiss Keyboard
    # The row sits under the search sheet's layer and a tap there can be dropped; repeat while the
    # confirmation has not appeared.
    FOR    ${i}    IN RANGE    3
        # The results come from a remote lookup and re-render, so the row can be gone by the
        # time the tap lands. Tap's own retry only waits 5s for it; search again instead of
        # failing on a row that the next response will bring straight back.
        ${there}=    Run Keyword And Return Status
        ...    Page Should Contain Element    ${result}
        IF    not ${there}
            # Already on the results; the remote lookup re-renders, so wait for the row to come
            # back rather than reopening the search for one specific asset id.
            ${back}=    Run Keyword And Return Status
            ...    Wait Until Page Contains Element    ${result}    timeout=20s
            VAR    ${there}    ${back}
        END
        # Being in the tree is not being on screen. A result below the fold is still found by
        # Page Should Contain Element, and Click Element then taps where the row is not - which is
        # why three attempts miss identically. Which position USDC takes depends on what the remote
        # lookup returns, so it is only sometimes off screen. Scroll once a tap has already failed,
        # to leave the ordinary path exactly as it was.
        #
        # Only when the row is in the tree. UiScrollable hunts by flinging the first scrollable, and
        # a downward fling on a bottom sheet dismisses it: asked for a row the lookup had dropped, it
        # scrolled the sheet away and left the run on Home, where every later locator was missing for
        # a reason that had nothing to do with the case. Nothing is on screen that is not in the
        # tree, so there is never a reason to scroll for an absent row.
        IF    ${i} > 0 and ${there}    Run Keyword And Ignore Error    Scroll Into View    ${asset_id}
        Run Keyword And Ignore Error    Tap    ${result}
        ${open}=    Run Keyword And Return Status
        ...    Wait Until Page Contains Element    ${OPT_IN_CONFIRM}    timeout=5s
        IF    ${open}    BREAK
    END
    IF    not ${open}    Skip If Asset Search Errored
    Wait Until Settled    ${OPT_IN_CONFIRM}

Skip If Asset Search Errored
    [Documentation]    The asset list is a remote lookup, and when it fails the sheet replaces the
    ...                results with the app's shared error view - search text still in the box, no
    ...                rows, and no way back to them. A row that was there a second ago is then gone
    ...                for good, which reads as a tap that missed rather than as a backend that
    ...                stopped answering. This is the line the currency list and the DEX list
    ...                already draw: an environment that cannot supply the data is not a defect in
    ...                the case. The sheet carries no testID for that view, so the title is what
    ...                there is to match on; SettingsCurrencyScreen's errorTestID is the shape to
    ...                copy when the screen gets one.
    ${errored}=    Run Keyword And Return Status
    ...    Page Should Contain Text    An error has occurred    loglevel=NONE
    Skip If    ${errored}
    ...    The asset search returned its error state: the remote lookup stopped answering, so there is nothing to opt into.

Open Manage Sheet
    # Home is still laying out after the reset, and a tap at a moving button misses it.
    Wait Until Settled    ${MANAGE_ASSETS_BUTTON}
    Tap    ${MANAGE_ASSETS_BUTTON}
    Wait Until Settled    ${MANAGE_SORT}

Open Sort Sheet
    Open Manage Sheet
    Tap    ${MANAGE_SORT}
    Wait Until Settled    ${SORT_APPLY}

Apply Sort
    [Arguments]    ${option}
    Open Sort Sheet
    Tap    ${option}
    Tap    ${SORT_APPLY}
    Wait Until Page Does Not Contain Element    ${SORT_APPLY}    timeout=10s

Open Filter Sheet
    Open Manage Sheet
    Tap    ${MANAGE_FILTER}
    Wait Until Settled    ${FILTER_APPLY}

Toggle Display NFTs
    Open Filter Sheet
    Tap    ${FILTER_DISPLAY_NFTS}
    Tap    ${FILTER_APPLY}
    Wait Until Page Does Not Contain Element    ${FILTER_APPLY}    timeout=10s

Open Remove Assets
    Open Manage Sheet
    Tap    ${MANAGE_REMOVE}
    Wait Until Page Contains Element    ${REMOVE_ASSETS_SCREEN}    timeout=15s

Open ALGO Detail
    Wait Until Page Contains Element    ${ALGO_ROW}    timeout=30s
    Tap    ${ALGO_ROW}
    Wait Until Page Contains Element    ${ASSET_DETAILS_SCREEN}    timeout=20s

Opt In To Testnet USDC
    Open Opt In Sheet    ${USDC_TESTNET_ROW}    ${USDC_TESTNET_ID}
    Slide To Confirm    ${OPT_IN_CONFIRM}
    Wait Until Page Does Not Contain Element    ${OPT_IN_CONFIRM}    timeout=90s
    Go Home
    Wait Until Page Contains Element    ${USDC_TESTNET_ROW}    timeout=60s

Opt Out Of Testnet USDC
    [Documentation]    Swiping a held row left asks to opt out; only a zero balance can opt out.
    Wait Until Page Contains Element    ${USDC_TESTNET_ROW}    timeout=30s
    ${loc}=    Get Element Location    ${USDC_TESTNET_ROW}
    ${size}=    Get Element Size    ${USDC_TESTNET_ROW}
    ${y}=    Evaluate    int($loc['y'] + $size['height'] / 2)
    ${x1}=    Evaluate    int($loc['x'] + $size['width'] * 0.9)
    ${x2}=    Evaluate    int($loc['x'] + $size['width'] * 0.1)
    Swipe    start_x=${x1}    start_y=${y}    end_x=${x2}    end_y=${y}    duration=800ms
    Slide To Confirm    ${OPT_OUT_CONFIRM}
    Wait Until Page Does Not Contain Element    ${OPT_OUT_CONFIRM}    timeout=90s
    Wait Until Page Does Not Contain Element    ${USDC_TESTNET_ROW}    timeout=60s

Holds Testnet USDC
    Wait Until Page Contains Element    ${ALGO_ROW}    timeout=30s
    ${usdc}=    Run Keyword And Return Status    Page Should Contain Element    ${USDC_TESTNET_ROW}
    RETURN    ${usdc}

Any USDC Row
    [Documentation]    Whichever USDC the current node offers: mainnet and testnet carry different
    ...                asset ids, and a case that switched the node leaves the other one listed.
    ...                Searches once, and hands back the row that answered.
    Wait Until Settled    ${ADD_ASSET_BUTTON}
    Tap    ${ADD_ASSET_BUTTON}
    Wait Until Page Contains Element    ${ASSET_SEARCH_INPUT}    timeout=15s
    Input Text    ${ASSET_SEARCH_INPUT}    USDC
    ${either}=    Set Variable
    ...    xpath=//*[@resource-id='${USDC_MAINNET_ID}' or @name='${USDC_MAINNET_ID}' or @resource-id='${USDC_TESTNET_ID}' or @name='${USDC_TESTNET_ID}']
    ${found}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${either}    timeout=30s
    IF    not ${found}    Skip If Asset Search Errored
    Should Be True    ${found}
    ...    msg=A USDC search returned neither the mainnet nor the testnet asset, so the remote lookup gave nothing to opt into.
    ${mainnet}=    Run Keyword And Return Status
    ...    Page Should Contain Element    ${USDC_MAINNET_ROW}
    IF    ${mainnet}    RETURN    ${USDC_MAINNET_ROW}    ${USDC_MAINNET_ID}
    RETURN    ${USDC_TESTNET_ROW}    ${USDC_TESTNET_ID}

