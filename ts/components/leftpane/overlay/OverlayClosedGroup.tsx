import React, { useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';

import { concat } from 'lodash';
import { MemberListItem } from '../../MemberListItem';
import { SessionButton } from '../../basic/SessionButton';
import { SessionIdEditable } from '../../basic/SessionIdEditable';
import { SessionSpinner } from '../../basic/SessionSpinner';
import { OverlayHeader } from './OverlayHeader';

import { useSet } from '../../../hooks/useSet';
import { VALIDATION } from '../../../session/constants';
import { createClosedGroup } from '../../../session/conversations/createClosedGroup';
import { ToastUtils } from '../../../session/utils';
import { groupInfoActions } from '../../../state/ducks/metaGroups';
import { resetLeftOverlayMode } from '../../../state/ducks/section';
import { useContactsToInviteToGroup } from '../../../state/selectors/conversations';
import { useIsCreatingGroupFromUIPending } from '../../../state/selectors/groups';
import { getSearchResultsContactOnly, isSearching } from '../../../state/selectors/search';
import { useOurPkStr } from '../../../state/selectors/user';
import { SessionSearchInput } from '../../SessionSearchInput';
import { SpacerLG } from '../../basic/Text';
import { GroupInviteRequiredVersionBanner } from '../../NoticeBanner';

const StyledMemberListNoContacts = styled.div`
  font-family: var(--font-mono), var(--font-default);
  background: var(--background-secondary-color);
  text-align: center;
  padding: 20px;
`;

const StyledGroupMemberListContainer = styled.div`
  padding: 2px 0px;
  width: 100%;
  min-height: 40px;
  max-height: 400px;
  overflow-y: auto;
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);

  &::-webkit-scrollbar-track {
    background-color: var(--background-secondary-color);
  }
`;

const StyledGroupMemberList = styled.div`
  button {
    background-color: var(--background-secondary-color);
  }
`;

const NoContacts = () => {
  return (
    <StyledMemberListNoContacts>{window.i18n('noContactsForGroup')}</StyledMemberListNoContacts>
  );
};

/**
 * Makes some validity check and return true if the group was indead created
 */
async function createClosedGroupWithToasts(
  groupName: string,
  groupMemberIds: Array<string>
): Promise<boolean> {
  // Validate groupName and groupMembers length
  if (groupName.length === 0) {
    ToastUtils.pushToastError('invalidGroupName', window.i18n('invalidGroupNameTooShort'));

    return false;
  }
  if (groupName.length > VALIDATION.MAX_GROUP_NAME_LENGTH) {
    ToastUtils.pushToastError('invalidGroupName', window.i18n('invalidGroupNameTooLong'));
    return false;
  }

  // >= because we add ourself as a member AFTER this. so a 10 group is already invalid as it will be 11 with ourself
  // the same is valid with groups count < 1

  if (groupMemberIds.length < 1) {
    ToastUtils.pushToastError('pickClosedGroupMember', window.i18n('pickClosedGroupMember'));
    return false;
  }
  if (groupMemberIds.length >= VALIDATION.CLOSED_GROUP_SIZE_LIMIT) {
    ToastUtils.pushToastError('closedGroupMaxSize', window.i18n('closedGroupMaxSize'));
    return false;
  }

  await createClosedGroup(groupName, groupMemberIds);

  return true;
}

// duplicated form the legacy one below because this one is a lot more tightly linked with redux async thunks logic
export const OverlayClosedGroupV2 = () => {
  const dispatch = useDispatch();
  const us = useOurPkStr();
  const privateContactsPubkeys = useContactsToInviteToGroup();
  const isCreatingGroup = useIsCreatingGroupFromUIPending();
  const [groupName, setGroupName] = useState('');
  const {
    uniqueValues: members,
    addTo: addToSelected,
    removeFrom: removeFromSelected,
  } = useSet<string>([]);
  const isSearch = useSelector(isSearching);
  const searchResultContactsOnly = useSelector(getSearchResultsContactOnly);

  function closeOverlay() {
    dispatch(resetLeftOverlayMode());
  }

  async function onEnterPressed() {
    if (isCreatingGroup) {
      window?.log?.warn('Closed group creation already in progress');
      return;
    }
    // Validate groupName and groupMembers length
    if (groupName.length === 0) {
      ToastUtils.pushToastError('invalidGroupName', window.i18n('invalidGroupNameTooShort'));
      return;
    }
    if (groupName.length > VALIDATION.MAX_GROUP_NAME_LENGTH) {
      ToastUtils.pushToastError('invalidGroupName', window.i18n('invalidGroupNameTooLong'));
      return;
    }

    // >= because we add ourself as a member AFTER this. so a 10 group is already invalid as it will be 11 with ourself
    // the same is valid with groups count < 1

    if (members.length < 1) {
      ToastUtils.pushToastError('pickClosedGroupMember', window.i18n('pickClosedGroupMember'));
      return;
    }
    if (members.length >= VALIDATION.CLOSED_GROUP_SIZE_LIMIT) {
      ToastUtils.pushToastError('closedGroupMaxSize', window.i18n('closedGroupMaxSize'));
      return;
    }
    // trigger the add through redux.
    dispatch(
      groupInfoActions.initNewGroupInWrapper({
        members: concat(members, [us]),
        groupName,
        us,
      }) as any
    );
  }

  useKey('Escape', closeOverlay);

  const title = window.i18n('createGroup');
  const buttonText = window.i18n('create');
  const subtitle = window.i18n('createClosedGroupNamePrompt');
  const placeholder = window.i18n('createClosedGroupPlaceholder');

  const noContactsForClosedGroup = privateContactsPubkeys.length === 0;

  const contactsToRender = isSearch ? searchResultContactsOnly : privateContactsPubkeys;

  const disableCreateButton = !members.length && !groupName.length;

  return (
    <div className="module-left-pane-overlay">
      <OverlayHeader title={title} subtitle={subtitle} />
      <div className="create-group-name-input">
        <SessionIdEditable
          editable={!noContactsForClosedGroup}
          placeholder={placeholder}
          value={groupName}
          isGroup={true}
          maxLength={VALIDATION.MAX_GROUP_NAME_LENGTH}
          onChange={setGroupName}
          onPressEnter={onEnterPressed}
          dataTestId="new-closed-group-name"
        />
      </div>
      <SessionSpinner loading={isCreatingGroup} />
      <SpacerLG />
      <SessionSearchInput />
      {!noContactsForClosedGroup && window.sessionFeatureFlags.useClosedGroupV2 && (
        <GroupInviteRequiredVersionBanner />
      )}

      <StyledGroupMemberListContainer>
        {noContactsForClosedGroup ? (
          <NoContacts />
        ) : (
          <StyledGroupMemberList className="group-member-list__selection">
            {contactsToRender.map((memberPubkey: string) => (
              <MemberListItem
                pubkey={memberPubkey}
                isSelected={members.some(m => m === memberPubkey)}
                key={memberPubkey}
                onSelect={addToSelected}
                onUnselect={removeFromSelected}
                disableBg={true}
              />
            ))}
          </StyledGroupMemberList>
        )}
      </StyledGroupMemberListContainer>
      <SpacerLG style={{ flexShrink: 0 }} />
      <SessionButton
        text={buttonText}
        disabled={disableCreateButton}
        onClick={onEnterPressed}
        dataTestId="next-button"
        margin="auto 0 var(--margins-lg) 0 " // just to keep that button at the bottom of the overlay (even with an empty list)
      />
    </div>
  );
};

export const OverlayLegacyClosedGroup = () => {
  const dispatch = useDispatch();
  const privateContactsPubkeys = useContactsToInviteToGroup();
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const {
    uniqueValues: selectedMemberIds,
    addTo: addToSelected,
    removeFrom: removeFromSelected,
  } = useSet<string>([]);
  const isSearch = useSelector(isSearching);
  const searchResultContactsOnly = useSelector(getSearchResultsContactOnly);

  function closeOverlay() {
    dispatch(resetLeftOverlayMode());
  }

  async function onEnterPressed() {
    if (loading) {
      window?.log?.warn('Closed group creation already in progress');
      return;
    }
    setLoading(true);
    const groupCreated = await createClosedGroupWithToasts(groupName, selectedMemberIds);

    if (groupCreated) {
      closeOverlay();
      return;
    }
    setLoading(false);
  }

  useKey('Escape', closeOverlay);

  const title = window.i18n('createGroup');
  const buttonText = window.i18n('create');
  const subtitle = window.i18n('createClosedGroupNamePrompt');
  const placeholder = window.i18n('createClosedGroupPlaceholder');

  const noContactsForClosedGroup = privateContactsPubkeys.length === 0;

  const contactsToRender = isSearch ? searchResultContactsOnly : privateContactsPubkeys;

  const disableCreateButton = !selectedMemberIds.length && !groupName.length;

  return (
    <div className="module-left-pane-overlay">
      <OverlayHeader title={title} subtitle={subtitle} />
      <div className="create-group-name-input">
        <SessionIdEditable
          editable={!noContactsForClosedGroup}
          placeholder={placeholder}
          value={groupName}
          isGroup={true}
          maxLength={VALIDATION.MAX_GROUP_NAME_LENGTH}
          onChange={setGroupName}
          onPressEnter={onEnterPressed}
          dataTestId="new-closed-group-name"
        />
      </div>

      <SessionSpinner loading={loading} />

      <SpacerLG />
      <SessionSearchInput />

      <StyledGroupMemberListContainer>
        {noContactsForClosedGroup ? (
          <NoContacts />
        ) : (
          <StyledGroupMemberList className="group-member-list__selection">
            {contactsToRender.map((memberPubkey: string) => (
              <MemberListItem
                pubkey={memberPubkey}
                isSelected={selectedMemberIds.some(m => m === memberPubkey)}
                key={memberPubkey}
                onSelect={addToSelected}
                onUnselect={removeFromSelected}
                disableBg={true}
              />
            ))}
          </StyledGroupMemberList>
        )}
      </StyledGroupMemberListContainer>

      <SpacerLG style={{ flexShrink: 0 }} />

      <SessionButton
        text={buttonText}
        disabled={disableCreateButton}
        onClick={onEnterPressed}
        dataTestId="next-button"
        margin="auto 0 var(--margins-lg) 0 " // just to keep that button at the bottom of the overlay (even with an empty list)
      />
    </div>
  );
};
