/* SPDX-License-Identifier: GPL-3.0-only */
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import "./room-chat.css";

const MAX_MESSAGE_LENGTH = 500;
const MAX_NAME_LENGTH = 24;

function formatTime(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function initials(name) {
  const trimmed = (name || "?").trim();
  return Array.from(trimmed)[0]?.toUpperCase() || "?";
}

function renderMessageText(text, selfName) {
  if (!selfName) return text;
  const tag = `@${selfName}`;
  const lowerText = text.toLocaleLowerCase();
  const lowerTag = tag.toLocaleLowerCase();
  const parts = [];
  let cursor = 0;
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const index = lowerText.indexOf(lowerTag, searchFrom);
    if (index < 0) break;
    const previous = text[index - 1];
    const next = text[index + tag.length];
    if ((previous && !/\s/u.test(previous)) || (next && /[\p{L}\p{N}_-]/u.test(next))) {
      searchFrom = index + tag.length;
      continue;
    }
    if (index > cursor) parts.push(text.slice(cursor, index));
    parts.push(
      <strong className="room-chat__mention-highlight" key={`mention-${index}`}>
        {text.slice(index, index + tag.length)}
      </strong>,
    );
    cursor = index + tag.length;
    searchFrom = cursor;
  }
  if (cursor === 0) return text;
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function RoomChat({
  players,
  messages,
  selfName,
  nameError,
  connected,
  onSetName,
  onSendMessage,
}) {
  const nameInputId = useId();
  const nameHintId = useId();
  const nameErrorId = useId();
  const composerId = useId();
  const mentionListId = useId();
  const messageRegionRef = useRef(null);
  const textareaRef = useRef(null);
  const [draftName, setDraftName] = useState(selfName);
  const [draftMessage, setDraftMessage] = useState("");
  const [mentionIndex, setMentionIndex] = useState(null);
  const [activeMention, setActiveMention] = useState(0);
  const priorMessageCountRef = useRef(messages.length);

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.slot - b.slot),
    [players],
  );
  const mentionMatches = useMemo(() => {
    if (mentionIndex === null) return [];
    const beforeCursor = draftMessage.slice(0, mentionIndex);
    const match = beforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
    if (!match) return [];
    const query = match[1].toLocaleLowerCase();
    return sortedPlayers
      .filter((player) => player.name.toLocaleLowerCase().includes(query))
      .slice(0, 6);
  }, [draftMessage, mentionIndex, sortedPlayers]);

  useEffect(() => {
    setDraftName(selfName);
  }, [selfName]);

  useEffect(() => {
    if (messages.length > priorMessageCountRef.current && messageRegionRef.current) {
      messageRegionRef.current.scrollTop = messageRegionRef.current.scrollHeight;
    }
    priorMessageCountRef.current = messages.length;
  }, [messages]);

  const saveName = (event) => {
    event.preventDefault();
    const nextName = draftName.trim();
    if (!nextName || nextName === selfName || !connected) return;
    onSetName(nextName);
  };

  const updateMessage = (value, cursorPosition) => {
    setDraftMessage(value);
    const match = value.slice(0, cursorPosition).match(/(?:^|\s)@([^\s@]*)$/);
    if (match) {
      setMentionIndex(cursorPosition - match[1].length - 1);
      setActiveMention(0);
    } else {
      setMentionIndex(null);
    }
  };

  const insertMention = (player) => {
    if (mentionIndex === null) return;
    const textBefore = draftMessage.slice(0, mentionIndex);
    const cursor = textareaRef.current?.selectionStart ?? draftMessage.length;
    const activeText = draftMessage.slice(mentionIndex, cursor);
    const typedMention = activeText.match(/^@([^\s@]*)/)?.[0] || "@";
    const textAfter = draftMessage.slice(mentionIndex + typedMention.length);
    const needsSpace = textAfter.length > 0 && !/^\s/.test(textAfter);
    const nextValue = `${textBefore}@${player.name}${needsSpace ? " " : ""}${textAfter}`;
    const nextCursor = textBefore.length + player.name.length + 1 + (needsSpace ? 1 : 0);
    setDraftMessage(nextValue);
    setMentionIndex(null);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const sendMessage = (event) => {
    event.preventDefault();
    const text = draftMessage.trim();
    if (!text || !connected) return;
    onSendMessage(text);
    setDraftMessage("");
    setMentionIndex(null);
  };

  const handleComposerKeyDown = (event) => {
    if (mentionMatches.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveMention((index) => (index + 1) % mentionMatches.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveMention((index) => (index - 1 + mentionMatches.length) % mentionMatches.length);
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        insertMention(mentionMatches[activeMention]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionIndex(null);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const activeOptionId = mentionMatches.length
    ? `${mentionListId}-option-${activeMention}`
    : undefined;

  return (
    <section className="room-chat" aria-labelledby={`${composerId}-title`}>
      <header className="room-chat__header">
        <div className="room-chat__heading">
          <p className="room-chat__eyebrow">Room channel</p>
          <h2 className="room-chat__title" id={`${composerId}-title`}>Chat</h2>
        </div>
        <div
          className="room-chat__connection"
          data-connected={connected ? "true" : "false"}
          role="status"
          aria-live="polite"
        >
          <span className="room-chat__connection-dot" aria-hidden="true" />
          {connected ? "Connected" : "Reconnecting"}
        </div>
      </header>

      <form className="room-chat__name-bar" onSubmit={saveName}>
        <div className="room-chat__name-field">
          <label htmlFor={nameInputId}>Your room name</label>
          <div className="room-chat__name-controls">
            <input
              className="room-chat__input"
              id={nameInputId}
              type="text"
              value={draftName}
              maxLength={MAX_NAME_LENGTH}
              placeholder="LoopRider"
              autoComplete="nickname"
              aria-describedby={`${nameHintId}${nameError ? ` ${nameErrorId}` : ""}`}
              onChange={(event) => setDraftName(event.target.value)}
            />
          </div>
          <p className="room-chat__name-hint" id={nameHintId}>
            1–24 letters, numbers, underscores, or hyphens. Only shown in this room.
          </p>
            {nameError && (
              <p className="room-chat__name-error" id={nameErrorId} role="alert">
                {nameError}
              </p>
            )}
        </div>
        <button
          className="room-chat__button"
          type="submit"
          disabled={!connected || !draftName.trim() || draftName.trim() === selfName}
        >
          Update
        </button>
      </form>

      <div
        className="room-chat__messages"
        ref={messageRegionRef}
        role="log"
        aria-label="Room chat messages"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {messages.length === 0 ? (
          <div className="room-chat__empty">
            <span className="room-chat__empty-mark" aria-hidden="true">BB</span>
            <p className="room-chat__empty-title">Set the groove together</p>
            <p className="room-chat__empty-copy">
              Share a cue, call the next change, or tag a player with @.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <article
              className="room-chat__message"
              key={message.id}
              data-player-slot={players.find((player) => player.id === message.playerId)?.slot}
            >
              <span className="room-chat__avatar" aria-hidden="true">
                {initials(message.name)}
              </span>
              <div className="room-chat__message-content">
                <p className="room-chat__message-meta">
                  <span
                    className="room-chat__message-name"
                    data-self={message.name === selfName ? "true" : "false"}
                  >
                    {message.name}
                  </span>
                  <time
                    className="room-chat__message-time"
                    dateTime={Number.isFinite(new Date(message.sentAt).getTime())
                      ? new Date(message.sentAt).toISOString()
                      : undefined}
                  >
                    {formatTime(message.sentAt)}
                  </time>
                </p>
                <p className="room-chat__message-text">{renderMessageText(message.text, selfName)}</p>
              </div>
            </article>
          ))
        )}
      </div>

      <form className="room-chat__composer" onSubmit={sendMessage}>
        {mentionMatches.length > 0 && (
          <div className="room-chat__mention-menu">
            <p className="room-chat__mention-heading">Room members</p>
            <div id={mentionListId} role="listbox" aria-label="Mention a room player">
              {mentionMatches.map((player, index) => (
                <button
                  className="room-chat__mention-option"
                  id={`${mentionListId}-option-${index}`}
                  key={player.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeMention}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertMention(player)}
                >
                  <span className="room-chat__mention-slot" aria-hidden="true">{player.slot + 1}</span>
                  <span className="room-chat__mention-name">{player.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="room-chat__composer-label" htmlFor={composerId}>
          Message the room
        </label>
        <div className="room-chat__compose-row">
          <textarea
            className="room-chat__textarea"
            id={composerId}
            ref={textareaRef}
            value={draftMessage}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder={connected ? "Call the next change…" : "Waiting for the room to reconnect"}
            disabled={!connected}
            rows={2}
            aria-autocomplete="list"
            aria-controls={mentionMatches.length > 0 ? mentionListId : undefined}
            aria-activedescendant={activeOptionId}
            aria-describedby={`${composerId}-hint`}
            onChange={(event) => updateMessage(event.target.value, event.target.selectionStart)}
            onKeyDown={handleComposerKeyDown}
          />
          <button
            className="room-chat__button room-chat__button--send"
            type="submit"
            disabled={!connected || !draftMessage.trim()}
          >
            Send
          </button>
        </div>
        <p className="room-chat__helper" id={`${composerId}-hint`}>
          Enter to send · Shift+Enter for a new line · Type @ to tag · Messages are not saved
        </p>
      </form>
    </section>
  );
}

export default RoomChat;
