/* SPDX-License-Identifier: GPL-3.0-only */
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { RoomChatMessage } from "../types.ts";

const MAX_MESSAGE_LENGTH = 500;
const MAX_NAME_LENGTH = 24;

/* the pixel font for the chat's headings and marks; the focus ring of its fields and buttons */
const PIXEL = "[font-family:'Jersey_10',ui-monospace,monospace]";
const FOCUS = "focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#3ee6ff]";
const FIELD = clsx(
  "w-full min-w-0 rounded-[9px] border border-[#695384] bg-[#1b112d] text-[15px] text-white",
  "placeholder:text-[#a99aba] placeholder:opacity-100",
  FOCUS,
);
const FIELD_LABEL = "text-[12px] font-bold text-[#b7a9ca]";
/* the chat's lime buttons; Send is wider and taller (but as tall as Update on a phone) */
function chatButton(send = false) {
  return clsx(
    "inline-flex cursor-pointer items-center justify-center rounded-[9px] border border-transparent bg-[#c6ff3d] py-2",
    "px-[14px] text-[13px] font-extrabold text-[#160d2b] max-[480px]:min-h-[46px] max-[480px]:px-[11px]",
    "transition-[translate,background-color,border-color] duration-[.12s] ease-[ease] motion-reduce:transition-none",
    "enabled:hover:-translate-y-px enabled:hover:bg-[#e0ff9b] disabled:cursor-not-allowed disabled:opacity-52",
    FOCUS,
    send ? "min-h-[48px] min-w-[88px] max-[480px]:min-w-[72px]" : "min-h-[44px]",
  );
}

/* a room player, as the chat lists them for @mentions */
export interface RoomChatPlayer {
  id: string;
  slot: number;
  name: string;
}

export interface RoomChatProps {
  players: RoomChatPlayer[];
  messages: RoomChatMessage[];
  selfName: string;
  nameError: string;
  connected: boolean;
  onSetName: (name: string) => void;
  onSendMessage: (text: string) => void;
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function initials(name: string) {
  const trimmed = (name || "?").trim();
  return Array.from(trimmed)[0]?.toUpperCase() || "?";
}

function renderMessageText(text: string, selfName: string) {
  if (!selfName) return text;
  const tag = `@${selfName}`;
  const lowerText = text.toLocaleLowerCase();
  const lowerTag = tag.toLocaleLowerCase();
  const parts: React.ReactNode[] = [];
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
      <strong className="font-extrabold text-[#c6ff3d]" key={`mention-${index}`}>
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
}: RoomChatProps) {
  const nameInputId = useId();
  const nameHintId = useId();
  const nameErrorId = useId();
  const composerId = useId();
  const mentionListId = useId();
  const messageRegionRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draftName, setDraftName] = useState(selfName);
  const [draftMessage, setDraftMessage] = useState("");
  const [mentionIndex, setMentionIndex] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [activeMention, setActiveMention] = useState(0);
  const priorMessageCountRef = useRef(messages.length);

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.slot - b.slot),
    [players],
  );
  const mentionMatches = useMemo(() => {
    if (mentionIndex === null) return [];
    const query = mentionQuery.toLocaleLowerCase();
    return sortedPlayers
      .filter((player) => player.name.toLocaleLowerCase().includes(query))
      .slice(0, 6);
  }, [mentionIndex, mentionQuery, sortedPlayers]);

  useEffect(() => {
    setDraftName(selfName);
  }, [selfName]);

  useEffect(() => {
    if (messages.length > priorMessageCountRef.current && messageRegionRef.current) {
      messageRegionRef.current.scrollTop = messageRegionRef.current.scrollHeight;
    }
    priorMessageCountRef.current = messages.length;
  }, [messages]);

  const saveName = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextName = draftName.trim();
    if (!nextName || nextName === selfName || !connected) return;
    onSetName(nextName);
  };

  const updateMessage = (value: string, cursorPosition: number) => {
    setDraftMessage(value);
    const match = value.slice(0, cursorPosition).match(/(?:^|\s)@([^\s@]*)$/);
    if (match) {
      setMentionIndex(cursorPosition - match[1].length - 1);
      setMentionQuery(match[1]);
      setActiveMention(0);
    } else {
      setMentionIndex(null);
      setMentionQuery("");
    }
  };

  const insertMention = (player: RoomChatPlayer) => {
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
    setMentionQuery("");
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const sendMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draftMessage.trim();
    if (!text || !connected) return;
    onSendMessage(text);
    setDraftMessage("");
    setMentionIndex(null);
    setMentionQuery("");
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        setMentionQuery("");
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
    <section className="grid min-h-[430px] min-w-0 grid-rows-[auto_auto_minmax(220px,1fr)_auto] overflow-hidden rounded-[16px] border border-[#493766] bg-[#10091f] bg-[radial-gradient(ellipse_at_100%_0%,rgb(90_54_139/18%),transparent_21rem)] text-[#ddd4fb] shadow-[0_18px_45px_rgb(0_0_0/16%)] [font-family:'DM_Sans',ui-sans-serif,system-ui,sans-serif] min-[720px]:min-h-[540px] max-[480px]:min-h-[420px] max-[480px]:rounded-[13px]" aria-labelledby={`${composerId}-title`}>
      <header className="flex items-center justify-between gap-4 border-b border-[#493766] bg-[rgb(36_22_64/78%)] px-5 py-[17px] max-[480px]:px-[14px]">
        <div className="min-w-0">
          <p className={clsx(PIXEL, "mt-0 mb-[2px] text-[12px] font-bold uppercase tracking-[.08em] text-[#d1bfef]")}>Room channel</p>
          <h2 className={clsx(PIXEL, "m-0 text-[22px] leading-[1.15] text-white")} id={`${composerId}-title`}>Chat</h2>
        </div>
        <div
          className="inline-flex flex-none items-center gap-2 text-[12px] font-bold text-[#b7a9ca] max-[480px]:gap-[6px] max-[480px]:text-[11px]"
          data-connected={connected ? "true" : "false"}
          role="status"
          aria-live="polite"
        >
          <span className={clsx("h-[9px] w-[9px] rounded-full", connected
            ? "bg-[#c6ff3d] shadow-[0_0_0_4px_rgb(198_255_61/12%)]"
            : "bg-[#f3b14d] shadow-[0_0_0_4px_rgb(243_177_77/12%)]")} aria-hidden="true" />
          {connected ? "Connected" : "Reconnecting"}
        </div>
      </header>

      <form className="flex items-end gap-[10px] border-b border-[rgb(73_55_102/78%)] px-5 py-[14px] max-[480px]:px-[14px]" onSubmit={saveName}>
        <div className="grid min-w-0 flex-1 gap-[5px]">
          <label className={FIELD_LABEL} htmlFor={nameInputId}>Your room name</label>
          <div className="flex min-w-0 items-center gap-2">
            <input
              className={clsx(FIELD, "min-h-[44px] px-[11px] py-2")}
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
          <p className="m-0 text-[11px] leading-[1.4] text-[#a99aba]" id={nameHintId}>
            1–24 letters, numbers, underscores, or hyphens. Only shown in this room.
          </p>
            {nameError && (
              <p className="m-0 text-[12px] text-[#ffb2c3]" id={nameErrorId} role="alert">
                {nameError}
              </p>
            )}
        </div>
        <button
          className={chatButton()}
          type="submit"
          disabled={!connected || !draftName.trim() || draftName.trim() === selfName}
        >
          Update
        </button>
      </form>

      <div
        className="min-h-0 overflow-y-auto overscroll-contain px-5 pt-[10px] pb-4 [scrollbar-color:#695384_#1b112d] [scrollbar-width:thin] max-[480px]:px-[14px]"
        ref={messageRegionRef}
        role="log"
        aria-label="Room chat messages"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {messages.length === 0 ? (
          <div className="grid min-h-full content-center justify-items-center px-[10px] py-6 text-center">
            <span className={clsx(PIXEL, "mb-3 grid h-[42px] w-[42px] place-items-center rounded-[12px] border border-[#695384] text-[21px] text-[#3ee6ff]")} aria-hidden="true">BB</span>
            <p className={clsx(PIXEL, "m-0 text-[17px] text-white")}>Set the groove together</p>
            <p className="mx-0 mt-[6px] mb-0 max-w-[260px] text-[13px] leading-[1.5] text-[#b7a9ca]">
              Share a cue, call the next change, or tag a player with @.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <article
              className="grid animate-room-chat-arrive grid-cols-[34px_minmax(0,1fr)] gap-[10px] border-b border-[rgb(73_55_102/58%)] py-3 motion-reduce:animate-none"
              key={message.id}
              data-player-slot={players.find((player) => player.id === message.playerId)?.slot}
            >
              <span className={clsx(PIXEL, "grid h-[34px] w-[34px] place-items-center rounded-[10px] border border-[rgb(62_230_255/38%)] bg-[#2a1c40] text-[14px] font-bold text-[#3ee6ff]")} aria-hidden="true">
                {initials(message.name)}
              </span>
              <div className="min-w-0">
                <p className="mt-0 mb-[3px] flex flex-wrap items-baseline gap-[7px]">
                  <span
                    className="text-[13px] font-extrabold text-white [overflow-wrap:anywhere] data-[self=true]:text-[#c6ff3d]"
                    data-self={message.name === selfName ? "true" : "false"}
                  >
                    {message.name}
                  </span>
                  <time
                    className="text-[11px] text-[#a99aba] tabular-nums"
                    dateTime={Number.isFinite(new Date(message.sentAt).getTime())
                      ? new Date(message.sentAt).toISOString()
                      : undefined}
                  >
                    {formatTime(message.sentAt)}
                  </time>
                </p>
                <p className="m-0 whitespace-pre-wrap text-[14px] leading-[1.5] text-[#e5def1] [overflow-wrap:anywhere]">{renderMessageText(message.text, selfName)}</p>
              </div>
            </article>
          ))
        )}
      </div>

      <form className="relative border-t border-[#493766] bg-[rgb(36_22_64/68%)] px-5 pt-[14px] pb-[18px] max-[480px]:px-[14px]" onSubmit={sendMessage}>
        {mentionMatches.length > 0 && (
          <div className="absolute right-5 bottom-[calc(100%-8px)] left-5 z-[2] max-h-[210px] overflow-y-auto rounded-[11px] border border-[#75618e] bg-[#1b112d] shadow-[0_12px_32px_rgb(0_0_0/38%)] max-[480px]:right-[14px] max-[480px]:left-[14px]">
            <p className="m-0 px-3 pt-2 pb-[5px] text-[11px] font-extrabold uppercase tracking-[.08em] text-[#a99aba]">Room members</p>
            <div id={mentionListId} role="listbox" aria-label="Mention a room player">
              {mentionMatches.map((player, index) => (
                <button
                  className={clsx("flex min-h-[44px] w-full cursor-pointer items-center gap-[10px] border-t border-[rgb(73_55_102/60%)] bg-transparent px-3 py-[7px] text-left text-white hover:bg-[#38274f] aria-selected:bg-[#38274f]", FOCUS)}
                  id={`${mentionListId}-option-${index}`}
                  key={player.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeMention}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertMention(player)}
                >
                  <span className="grid h-[25px] w-[25px] flex-none place-items-center rounded-[7px] bg-[#412d61] text-[11px] font-extrabold text-[#ddcefa]" aria-hidden="true">{player.slot + 1}</span>
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold">{player.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <label className={clsx(FIELD_LABEL, "mb-[7px] block")} htmlFor={composerId}>
          Message the room
        </label>
        <div className="flex items-end gap-[10px]">
          <textarea
            className={clsx(FIELD, "block max-h-[140px] min-h-[48px] resize-y px-3 py-[11px] leading-[1.45]")}
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
            className={chatButton(true)}
            type="submit"
            disabled={!connected || !draftMessage.trim()}
          >
            Send
          </button>
        </div>
        <p className="mt-[7px] mb-0 text-[11px] leading-[1.4] text-[#a99aba]" id={`${composerId}-hint`}>
          Enter to send · Shift+Enter for a new line · Type @ to tag · Messages are not saved
        </p>
      </form>
    </section>
  );
}

export default RoomChat;
