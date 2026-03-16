'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { MessageSquare, Send, Loader2 } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import Avatar from '@/components/ui/Avatar'
import type {
  GuardianMessageThread,
  GuardianMessage as GuardianMessageType,
} from '@/types/guardian'

export default function GuardianMessagesPage() {
  const [threads, setThreads] = useState<GuardianMessageThread[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchThreads = useCallback(async () => {
    try {
      const res = await apiGet<{ threads: GuardianMessageThread[] }>(
        '/api/v1/guardian/messages'
      )
      if (res.success) {
        setThreads(res.data.threads)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchThreads()
  }, [fetchThreads])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedIdx, threads])

  const selectedThread = selectedIdx !== null ? threads[selectedIdx] : null

  const handleSend = async () => {
    if (!replyContent.trim() || !selectedThread || sending) return
    const content = replyContent.trim()
    setReplyContent('')
    setSending(true)
    try {
      const res = await apiPost('/api/v1/guardian/messages', {
        tutor_id: selectedThread.tutor.id,
        student_id: selectedThread.child.id,
        content,
      })
      if (res.success) {
        await fetchThreads()
      }
    } catch {
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatMessageTime = (dateStr: string | null): string => {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return ''
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <Loader2
          size={32}
          strokeWidth={1.5}
          style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }}
        />
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '16px' }}>
          Loading messages...
        </p>
      </div>
    )
  }

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
        >
          Messages
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Communicate with your children&apos;s tutors
        </p>
      </div>

      {threads.length === 0 ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
          }}
        >
          <EmptyState
            icon={<MessageSquare size={22} strokeWidth={1.5} />}
            title="No messages"
            description="Conversations with your children's tutors will appear here."
          />
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            overflow: 'hidden',
            background: 'var(--surface)',
            height: 'calc(100vh - 200px)',
            minHeight: '400px',
          }}
        >
          {/* Thread list */}
          <div
            style={{
              width: '320px',
              borderRight: '1px solid var(--border)',
              overflowY: 'auto',
              flexShrink: 0,
            }}
          >
            {threads.map((thread, idx) => {
              const isSelected = selectedIdx === idx
              const lastMsg =
                thread.messages.length > 0
                  ? thread.messages[thread.messages.length - 1]
                  : null
              return (
                <div
                  key={`${thread.tutor.id}-${thread.child.id}`}
                  onClick={() => setSelectedIdx(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    background: isSelected
                      ? 'rgba(79,142,255,0.08)'
                      : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <Avatar
                    name={thread.tutor.name}
                    avatarUrl={thread.tutor.avatar_url}
                    size="sm"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="flex items-center justify-between"
                      style={{ marginBottom: '2px' }}
                    >
                      <span
                        style={{
                          fontSize: '0.875rem',
                          color: 'var(--text)',
                          fontWeight: thread.unread_count > 0 ? 700 : 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {thread.tutor.name}
                      </span>
                      {thread.unread_count > 0 && (
                        <span
                          style={{
                            flexShrink: 0,
                            marginLeft: '8px',
                            minWidth: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background:
                              'linear-gradient(135deg, var(--accent), var(--accent2))',
                            color: '#fff',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 5px',
                          }}
                        >
                          {thread.unread_count}
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--muted)',
                        margin: '0 0 2px',
                      }}
                    >
                      Re: {thread.child.name}
                    </p>
                    {lastMsg && (
                      <p
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--muted)',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {lastMsg.content}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Message area */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
            }}
          >
            {selectedThread === null ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MessageSquare
                    size={24}
                    strokeWidth={1.5}
                    style={{ color: 'var(--muted)' }}
                  />
                </div>
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
                  Select a conversation to view messages
                </p>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--border)',
                    flexShrink: 0,
                  }}
                >
                  <Avatar
                    name={selectedThread.tutor.name}
                    avatarUrl={selectedThread.tutor.avatar_url}
                    size="sm"
                  />
                  <div>
                    <div
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: 'var(--text)',
                      }}
                    >
                      {selectedThread.tutor.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                      Re: {selectedThread.child.name}
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {selectedThread.messages.length === 0 ? (
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <p
                        style={{
                          color: 'var(--muted)',
                          fontSize: '0.875rem',
                        }}
                      >
                        No messages yet. Start the conversation!
                      </p>
                    </div>
                  ) : (
                    selectedThread.messages.map((msg: GuardianMessageType) => {
                      const isOwn = msg.sender_type === 'guardian'
                      return (
                        <div
                          key={msg.id}
                          style={{
                            display: 'flex',
                            justifyContent: isOwn ? 'flex-end' : 'flex-start',
                          }}
                        >
                          <div>
                            <div
                              style={{
                                background: isOwn
                                  ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
                                  : 'var(--surface)',
                                border: isOwn ? 'none' : '1px solid var(--border)',
                                color: isOwn ? '#fff' : 'var(--text)',
                                borderRadius: '16px',
                                padding: '10px 16px',
                                maxWidth: '70%',
                                fontSize: '0.875rem',
                                lineHeight: 1.5,
                                wordBreak: 'break-word',
                                minWidth: 'fit-content',
                              }}
                            >
                              {msg.content}
                            </div>
                            {msg.created_at && (
                              <div
                                style={{
                                  fontSize: '0.65rem',
                                  color: 'var(--muted)',
                                  marginTop: '4px',
                                  textAlign: isOwn ? 'right' : 'left',
                                  paddingLeft: isOwn ? 0 : '4px',
                                  paddingRight: isOwn ? '4px' : 0,
                                }}
                              >
                                {formatMessageTime(msg.created_at)}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply form */}
                <div
                  style={{
                    padding: '12px 16px',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    flexShrink: 0,
                  }}
                >
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border)',
                      borderRadius: '100px',
                      padding: '10px 16px',
                      color: 'var(--text)',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!replyContent.trim() || sending}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background:
                        replyContent.trim() && !sending
                          ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
                          : 'rgba(255,255,255,0.05)',
                      border: 'none',
                      cursor:
                        replyContent.trim() && !sending ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'background 0.15s',
                    }}
                  >
                    {sending ? (
                      <Loader2
                        size={18}
                        strokeWidth={1.5}
                        style={{
                          color: '#fff',
                          animation: 'spin 1s linear infinite',
                        }}
                      />
                    ) : (
                      <Send
                        size={18}
                        strokeWidth={1.5}
                        style={{ color: '#fff' }}
                      />
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
