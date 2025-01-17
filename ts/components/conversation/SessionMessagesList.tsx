import { useLayoutEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import useKey from 'react-use/lib/useKey';
import {
  getOldBottomMessageId,
  getOldTopMessageId,
  getSortedMessagesTypesOfSelectedConversation,
} from '../../state/selectors/conversations';
import { useSelectedConversationKey } from '../../state/selectors/selectedConversation';
import { MessageDateBreak } from './message/message-item/DateBreak';
import { CommunityInvitation } from './message/message-item/CommunityInvitation';
import { GroupUpdateMessage } from './message/message-item/GroupUpdateMessage';
import { Message } from './message/message-item/Message';
import { MessageRequestResponse } from './message/message-item/MessageRequestResponse';
import { CallNotification } from './message/message-item/notification-bubble/CallNotification';

import { IsDetailMessageViewContext } from '../../contexts/isDetailViewContext';
import { SessionLastSeenIndicator } from './SessionLastSeenIndicator';
import { TimerNotification } from './TimerNotification';
import { DataExtractionNotification } from './message/message-item/DataExtractionNotification';
import { InteractionNotification } from './message/message-item/InteractionNotification';
import { assertUnreachable } from '../../types/sqlSharedTypes';
import type { WithMessageId } from '../../session/types/with';

function isNotTextboxEvent(e: KeyboardEvent) {
  return (e?.target as any)?.type === undefined;
}

let previousRenderedConvo: string | undefined;

export const SessionMessagesList = (props: {
  scrollAfterLoadMore: (
    messageIdToScrollTo: string,
    type: 'load-more-top' | 'load-more-bottom'
  ) => void;
  onPageUpPressed: () => void;
  onPageDownPressed: () => void;
  onHomePressed: () => void;
  onEndPressed: () => void;
}) => {
  const messagesProps = useSelector(getSortedMessagesTypesOfSelectedConversation);
  const convoKey = useSelectedConversationKey();

  const [didScroll, setDidScroll] = useState(false);
  const oldTopMessageId = useSelector(getOldTopMessageId);
  const oldBottomMessageId = useSelector(getOldBottomMessageId);

  useLayoutEffect(() => {
    const newTopMessageId = messagesProps.length
      ? messagesProps[messagesProps.length - 1].messageId
      : undefined;

    if (oldTopMessageId !== newTopMessageId && oldTopMessageId && newTopMessageId) {
      props.scrollAfterLoadMore(oldTopMessageId, 'load-more-top');
    }

    const newBottomMessageId = messagesProps.length ? messagesProps[0].messageId : undefined;

    if (newBottomMessageId !== oldBottomMessageId && oldBottomMessageId && newBottomMessageId) {
      props.scrollAfterLoadMore(oldBottomMessageId, 'load-more-bottom');
    }
  });

  useKey('PageUp', () => {
    props.onPageUpPressed();
  });

  useKey('PageDown', () => {
    props.onPageDownPressed();
  });

  useKey('Home', e => {
    if (isNotTextboxEvent(e)) {
      props.onHomePressed();
    }
  });

  useKey('End', e => {
    if (isNotTextboxEvent(e)) {
      props.onEndPressed();
    }
  });

  if (didScroll && previousRenderedConvo !== convoKey) {
    setDidScroll(false);
    previousRenderedConvo = convoKey;
  }

  return (
    <IsDetailMessageViewContext.Provider value={false}>
      {messagesProps.map(messageProps => {
        const { messageId } = messageProps;

        let ComponentToRender: React.FC<WithMessageId> | undefined;

        switch (messageProps.message.messageType) {
          case 'group-notification': {
            ComponentToRender = GroupUpdateMessage;
            break;
          }
          case 'group-invitation': {
            ComponentToRender = CommunityInvitation;
            break;
          }
          case 'message-request-response': {
            ComponentToRender = MessageRequestResponse;
            break;
          }
          case 'data-extraction': {
            ComponentToRender = DataExtractionNotification;
            break;
          }
          case 'timer-notification': {
            ComponentToRender = TimerNotification;
            break;
          }
          case 'call-notification': {
            ComponentToRender = CallNotification;
            break;
          }
          case 'interaction-notification': {
            ComponentToRender = InteractionNotification;
            break;
          }
          case 'regular-message': {
            ComponentToRender = Message;
            break;
          }
          default:
            assertUnreachable(
              messageProps.message.messageType,
              `unhandled case with ${messageProps.message.messageType}`
            );
        }

        const unreadIndicator = messageProps.showUnreadIndicator ? (
          <SessionLastSeenIndicator
            key={'unread-indicator'}
            messageId={messageId}
            didScroll={didScroll}
            setDidScroll={setDidScroll}
          />
        ) : null;

        const dateBreak =
          messageProps.showDateBreak !== undefined ? (
            <MessageDateBreak
              key={`date-break-${messageId}`}
              timestamp={messageProps.showDateBreak}
              messageId={messageId}
            />
          ) : null;

        return [
          <ComponentToRender key={messageId} messageId={messageId} />,
          unreadIndicator,
          dateBreak,
        ];
      })}
    </IsDetailMessageViewContext.Provider>
  );
};
