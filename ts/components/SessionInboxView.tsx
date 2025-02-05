import { fromPairs, map } from 'lodash';

import { Provider } from 'react-redux';
import useMount from 'react-use/lib/useMount';
import useUpdate from 'react-use/lib/useUpdate';
import { persistStore } from 'redux-persist';
import { PersistGate } from 'redux-persist/integration/react';
import styled from 'styled-components';

import { AnimatePresence } from 'framer-motion';
import { LeftPane } from './leftpane/LeftPane';
// moment does not support es-419 correctly (and cause white screen on app start)
import { ConvoHub } from '../session/conversations';
import { UserUtils } from '../session/utils';
import { createStore } from '../state/createStore';
import { initialCallState } from '../state/ducks/call';
import {
  getEmptyConversationState,
  openConversationWithMessages,
} from '../state/ducks/conversations';
import { initialDefaultRoomState } from '../state/ducks/defaultRooms';
import { initialModalState } from '../state/ducks/modalDialog';
import { initialOnionPathState } from '../state/ducks/onion';
import { initialPrimaryColorState } from '../state/ducks/primaryColor';
import { initialSearchState } from '../state/ducks/search';
import { initialSectionState } from '../state/ducks/section';
import { getEmptyStagedAttachmentsState } from '../state/ducks/stagedAttachments';
import { initialThemeState } from '../state/ducks/theme';
import { initialUserConfigState } from '../state/ducks/userConfig';
import { StateType } from '../state/reducer';
import { SessionMainPanel } from './SessionMainPanel';

import { SettingsKey } from '../data/settings-key';
import { groupInfoActions, initialGroupState } from '../state/ducks/metaGroups';
import { getSettingsInitialState, updateAllOnStorageReady } from '../state/ducks/settings';
import { initialSogsRoomInfoState } from '../state/ducks/sogsRoomInfo';
import { useHasDeviceOutdatedSyncing } from '../state/selectors/settings';
import { SessionTheme } from '../themes/SessionTheme';
import { Storage } from '../util/storage';
import { UserGroupsWrapperActions } from '../webworker/workers/browser/libsession_worker_interface';
import { NoticeBanner } from './NoticeBanner';
import { Flex } from './basic/Flex';
import { initialReleasedFeaturesState } from '../state/ducks/releasedFeatures';

function makeLookup<T>(items: Array<T>, key: string): { [key: string]: T } {
  // Yep, we can't index into item without knowing what it is. True. But we want to.
  const pairs = map(items, item => [(item as any)[key] as string, item]);

  return fromPairs(pairs);
}

const StyledGutter = styled.div`
  width: var(--left-panel-width) !important;
  transition: none;
`;

async function createSessionInboxStore() {
  // Here we set up a full redux store with initial state for our LeftPane Root
  const conversations = ConvoHub.use()
    .getConversations()
    .map(conversation => conversation.getConversationModelProps());

  const userGroups: Record<string, any> = {};

  (await UserGroupsWrapperActions.getAllGroups()).forEach(m => {
    userGroups[m.pubkeyHex] = m;
  });

  const initialState: StateType = {
    conversations: {
      ...getEmptyConversationState(),
      conversationLookup: makeLookup(conversations, 'id'),
    },
    user: {
      ourDisplayNameInProfile: UserUtils.getOurProfile()?.displayName || '',
      ourNumber: UserUtils.getOurPubKeyStrFromCache(),
    },
    section: initialSectionState,
    defaultRooms: initialDefaultRoomState,
    search: initialSearchState,
    theme: initialThemeState,
    primaryColor: initialPrimaryColorState,
    onionPaths: initialOnionPathState,
    modals: initialModalState,
    userConfig: initialUserConfigState,
    stagedAttachments: getEmptyStagedAttachmentsState(),
    call: initialCallState,
    sogsRoomInfo: initialSogsRoomInfoState,
    settings: getSettingsInitialState(),
    groups: initialGroupState,
    userGroups: { userGroups },
    releasedFeatures: initialReleasedFeaturesState,
  };

  return createStore(initialState);
}

async function setupLeftPane(forceUpdateInboxComponent: () => void) {
  window.openConversationWithMessages = openConversationWithMessages;

  window.inboxStore = await createSessionInboxStore();

  window.inboxStore?.dispatch(
    updateAllOnStorageReady({
      hasBlindedMsgRequestsEnabled: Storage.getBoolOrFalse(
        SettingsKey.hasBlindedMsgRequestsEnabled
      ),
      someDeviceOutdatedSyncing: Storage.getBoolOrFalse(SettingsKey.someDeviceOutdatedSyncing),
      settingsLinkPreview: Storage.getBoolOrFalse(SettingsKey.settingsLinkPreview),
      hasFollowSystemThemeEnabled: Storage.getBoolOrFalse(SettingsKey.hasFollowSystemThemeEnabled),
      hasShiftSendEnabled: Storage.getBoolOrFalse(SettingsKey.hasShiftSendEnabled),
      hideRecoveryPassword: Storage.getBoolOrFalse(SettingsKey.hideRecoveryPassword),
    })
  );
  window.inboxStore?.dispatch(groupInfoActions.loadMetaDumpsFromDB() as any); // this loads the dumps from DB and fills the 03-groups slice with the corresponding details
  forceUpdateInboxComponent();
  window.getState = window.inboxStore.getState;
}

const SomeDeviceOutdatedSyncingNotice = () => {
  const outdatedBannerShouldBeShown = useHasDeviceOutdatedSyncing();

  const dismiss = () => {
    void Storage.put(SettingsKey.someDeviceOutdatedSyncing, false);
  };

  if (!outdatedBannerShouldBeShown) {
    return null;
  }
  return (
    <NoticeBanner
      text={window.i18n('deleteAfterGroupFirstReleaseConfigOutdated')}
      onBannerClick={dismiss}
      icon="exit"
      dataTestId="some-of-your-devices-outdated-inbox"
    />
  );
};

export const SessionInboxView = () => {
  const update = useUpdate();
  // run only on mount
  useMount(() => {
    void setupLeftPane(update);
  });

  if (!window.inboxStore) {
    return null;
  }

  const persistor = persistStore(window.inboxStore);
  window.persistStore = persistor;

  return (
    <div className="inbox index">
      <Provider store={window.inboxStore}>
        <PersistGate loading={null} persistor={persistor}>
          <SessionTheme>
            <SomeDeviceOutdatedSyncingNotice />
            <AnimatePresence>
              <Flex container={true} height="0" flexShrink={100} flexGrow={1}>
                <StyledGutter>
                  <LeftPane />
                </StyledGutter>
                <SessionMainPanel />
              </Flex>
            </AnimatePresence>
          </SessionTheme>
        </PersistGate>
      </Provider>
    </div>
  );
};
