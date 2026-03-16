"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, X, Send } from "lucide-react";

interface Message {
  id: number;
  text: string;
  type: "bot" | "user";
}

const QUICK_REPLIES = [
  "Find a math tutor",
  "How does pricing work?",
  "Is there a free trial?",
  "Group classes?",
] as const;

const BOT_RESPONSES: Record<string, string> = {
  "find a math tutor":
    "Great choice! We have 180+ math tutors covering everything from basic arithmetic to graduate-level analysis. Want me to filter by your level \u2014 high school, college, or beyond?",
  "how does pricing work?":
    "Tutors set their own rates, typically $25\u2013$120/hr. You only pay for sessions you book \u2014 no subscriptions or hidden fees. First-timers often get an intro rate!",
  "is there a free trial?":
    "Yes! Many tutors offer a free 15-minute intro call so you can see if it\u2019s a great fit before committing. Look for the \u2018Free Intro\u2019 badge on tutor profiles.",
  "group classes?":
    "Absolutely \u2014 group classes support up to 10 students and are a great way to learn collaboratively at a lower per-person cost. Available in most subjects!",
};

const FALLBACK =
  "Thanks for asking! I\u2019m learning every day. For complex questions, our support team usually replies within a few hours. Anything else I can help with?";

const WELCOME: Message = {
  id: 0,
  text: "Hi! I\u2019m your Teachwise assistant. I can help you find the perfect tutor, answer questions about our platform, or guide you through getting started.",
  type: "bot",
};

let nextId = 1;

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [showChips, setShowChips] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
    return () => {};
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
    return () => {};
  }, [open]);

  // Cleanup pending timers
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const addBotReply = useCallback((userText: string) => {
    const key = Object.keys(BOT_RESPONSES).find((k) =>
      userText.toLowerCase().includes(k.split(" ")[0])
    );
    const reply = key ? BOT_RESPONSES[key] : FALLBACK;

    timerRef.current = setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: nextId++, text: reply, type: "bot" },
      ]);
    }, 700);
  }, []);

  const handleChipClick = useCallback(
    (chipText: string) => {
      setMessages((prev) => [
        ...prev,
        { id: nextId++, text: chipText, type: "user" },
      ]);
      setShowChips(false);

      const key = chipText.toLowerCase().trim();
      const reply = BOT_RESPONSES[key] ?? FALLBACK;
      timerRef.current = setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { id: nextId++, text: reply, type: "bot" },
        ]);
      }, 700);
    },
    []
  );

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { id: nextId++, text, type: "user" },
    ]);
    setInputValue("");
    setShowChips(false);
    addBotReply(text);
  }, [inputValue, addBotReply]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleSend();
    },
    [handleSend]
  );

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        title="Ask Teachwise AI"
        aria-label={open ? 'Close chat assistant' : 'Open chat assistant'}
        className="fixed bottom-8 right-8 z-[500] w-[60px] h-[60px] rounded-full btn-gradient border-none flex items-center justify-center text-[26px] transition-transform duration-200 hover:scale-110"
        style={{ animation: "chatPulse 3s infinite" }}
      >
        <Bot size={24} strokeWidth={1.5} />
      </button>

      {/* Chat window */}
      <div
        className={`fixed bottom-[108px] right-8 z-[499] w-[360px] max-h-[500px] bg-[var(--surface)] light:bg-white border border-[rgba(79,142,255,0.25)] rounded-[22px] overflow-hidden flex flex-col shadow-[0_24px_64px_rgba(0,0,0,0.6),0_0_0_1px_rgba(79,142,255,0.1)] origin-bottom-right transition-[transform,opacity] duration-300 ${
          open
            ? "scale-100 translate-y-0 opacity-100 pointer-events-auto"
            : "scale-[0.85] translate-y-5 opacity-0 pointer-events-none"
        }`}
        style={{
          transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Header */}
        <div className="py-[18px] px-5 border-b border-[var(--border)] flex items-center gap-3 bg-[linear-gradient(135deg,rgba(79,142,255,0.1),rgba(0,229,255,0.05))] flex-shrink-0">
          <div className="w-[38px] h-[38px] rounded-full btn-gradient flex items-center justify-center text-lg flex-shrink-0">
            🎓
          </div>
          <div className="flex-1">
            <div className="font-head text-[1.05rem] font-bold">
              Teachwise AI
            </div>
            <div className="text-[0.7rem] text-accent-2 flex items-center gap-[5px] mt-[2px]">
              <span className="w-[5px] h-[5px] rounded-full bg-accent-2 animate-pulse" />
              Online &middot; here to help
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close chat"
            className="bg-none border-none text-[var(--muted)] text-xl leading-none p-1"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-[18px] px-4 flex flex-col gap-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[var(--border)]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[86%] py-[10px] px-[14px] rounded-[16px] text-[0.875rem] leading-[1.55] ${
                msg.type === "bot"
                  ? "bg-[rgba(79,142,255,0.12)] light:bg-[rgba(79,142,255,0.08)] border border-[rgba(79,142,255,0.2)] text-[var(--text)] self-start rounded-bl-[4px]"
                  : "btn-gradient text-white self-end rounded-br-[4px]"
              }`}
              style={{ animation: "msgIn 0.3s ease" }}
            >
              {msg.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick reply chips */}
        {showChips && (
          <div className="px-4 pb-3 flex gap-2 flex-wrap flex-shrink-0">
            {QUICK_REPLIES.map((chip) => (
              <button
                key={chip}
                onClick={() => handleChipClick(chip)}
                className="bg-[rgba(79,142,255,0.1)] border border-[rgba(79,142,255,0.25)] text-accent-2 text-[0.7rem] py-[5px] px-3 rounded-pill font-body transition-colors duration-200 hover:bg-[rgba(79,142,255,0.22)]"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="py-3 px-4 border-t border-[var(--border)] flex gap-[10px] items-center flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Type your message"
            placeholder="Ask anything\u2026"
            className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[var(--border)] rounded-pill py-[10px] px-4 text-[var(--text)] font-body text-[0.875rem] outline-none transition-[border-color] duration-200 focus:border-[rgba(79,142,255,0.5)] placeholder:text-[var(--muted)]"
          />
          <button
            onClick={handleSend}
            aria-label="Send message"
            className="w-9 h-9 rounded-full btn-gradient border-none text-white text-[15px] flex items-center justify-center transition-[transform,box-shadow] duration-200 hover:scale-110 hover:shadow-[0_0_16px_rgba(79,142,255,0.5)] flex-shrink-0"
          >
            <Send size={15} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </>
  );
}
