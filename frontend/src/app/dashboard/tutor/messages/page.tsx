'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { MessageSquare, Send, ArrowLeft, Loader2 } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import Avatar from '@/components/ui/Avatar'
import { formatRelativeTime } from '@/lib/format'
import type { ChatConversation, ChatMessage } from '@/types/chat'

export default function TutorMessagesPage() {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [otherParty, setOtherParty] = useState<{
    id: number | null
    name: string
    avatar_url: string | null
    type: string
  } | null>(null)
  const [isBlocked, setIsBlocked] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiGet<{ conversations: ChatConversation[] }>(
        '/api/v1/chat/conversations'
      )
      if (res.success) {
        setConversations(res.data.conversations)
      }
    } catch {
    } finally {
      setLoadingConversations(false)
    }
  }, [])

  const fetchMessages = useCallback(async (convId: number) => {
    try {
      const res = await apiGet<{
        messages: ChatMessage[]
        other_party: {
          id: number | null
          name: string
          avatar_url: string | null
          type: string
        }
        is_blocked: boolean
      }>('/api/v1/chat/conversations/' + convId + '/messages')
      if (res.success) {
        setMessages(res.data.messages)
        setOtherParty(res.data.other_party)
        setIsBlocked(res.data.is_blocked)
      }
    } catch {
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  useEffect(() => {
    if (selectedConvId === null) return
    setLoadingMessages(true)
    fetchMessages(selectedConvId).finally(() => setLoadingMessages(false))

    pollRef.current = setInterval(() => {
      fetchMessages(selectedConvId)
      fetchConversations()
    }, 5000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [selectedConvId, fetchMessages, fetchConversations])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConvId || sending || isBlocked) return
    setSending(true)
    try {
      const res = await apiPost<{ message: ChatMessage }>(
        '/api/v1/chat/conversations/' + selectedConvId + '/messages',
        { content: newMessage.trim() }
      )
      if (res.success) {
        setMessages((prev) => [...prev, res.data.message])
        setNewMessage('')
        fetchConversations()
      }
    } catch {
    } finally {
      setSending(false)
    }
  }

  const filteredConversations = conversations.filter((c) =>
    c.other_party.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedConv = conversations.find((c) => c.id === selectedConvId)

  return (
    <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '16px' }}>
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
        >
          Messages
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Chat with your students in real time
        </p>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <div
          style={{
            width: '320px',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          <div style={{ padding: '16px' }}>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '100px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {loadingConversations ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '40px 0',
                }}
              >
                <Loader2
                  size={24}
                  strokeWidth={1.5}
                  style={{ color: 'var(--muted)', animation: 'spin 1s linear infinite' }}
                />
              </div>
            ) : filteredConversations.length === 0 ? (
              <EmptyState
                icon={<MessageSquare size={22} strokeWidth={1.5} />}
                title="No conversations"
                description="Your messages will appear here when students reach out."
              />
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    background:
                      selectedConvId === conv.id
                        ? 'rgba(255,255,255,0.05)'
                        : 'transparent',
                    borderBottom: '1px solid var(--border)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedConvId !== conv.id) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedConvId !== conv.id) {
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  <Avatar
                    name={conv.other_party.name}
                    avatarUrl={conv.other_party.avatar_url}
                    size="md"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '2px',
                      }}
                    >
                      <span
                        style={{
                          color: 'var(--text)',
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {conv.other_party.name}
                      </span>
                      {conv.last_message?.created_at && (
                        <span
                          style={{
                            color: 'var(--muted)',
                            fontSize: '0.75rem',
                            flexShrink: 0,
                            marginLeft: '8px',
                          }}
                        >
                          {formatRelativeTime(conv.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          color: 'var(--muted)',
                          fontSize: '0.8rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {conv.last_message?.content ?? 'No messages yet'}
                      </span>
                      {conv.unread_count > 0 && (
                        <span
                          style={{
                            background: 'var(--accent)',
                            color: '#fff',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            borderRadius: '100px',
                            padding: '2px 8px',
                            flexShrink: 0,
                            marginLeft: '8px',
                          }}
                        >
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          {selectedConvId === null ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <EmptyState
                icon={<MessageSquare size={22} strokeWidth={1.5} />}
                title="Select a conversation"
                description="Choose a conversation from the left to start chatting."
              />
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <button
                  onClick={() => setSelectedConvId(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <ArrowLeft size={20} strokeWidth={1.5} />
                </button>
                {otherParty && (
                  <>
                    <Avatar
                      name={otherParty.name}
                      avatarUrl={otherParty.avatar_url}
                      size="sm"
                    />
                    <div>
                      <div
                        style={{
                          color: 'var(--text)',
                          fontWeight: 600,
                          fontSize: '0.95rem',
                        }}
                      >
                        {otherParty.name}
                      </div>
                      <div
                        style={{
                          color: 'var(--muted)',
                          fontSize: '0.75rem',
                          textTransform: 'capitalize',
                        }}
                      >
                        {otherParty.type}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  minHeight: 0,
                }}
              >
                {loadingMessages ? (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      flex: 1,
                    }}
                  >
                    <Loader2
                      size={24}
                      strokeWidth={1.5}
                      style={{
                        color: 'var(--muted)',
                        animation: 'spin 1s linear infinite',
                      }}
                    />
                  </div>
                ) : messages.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      flex: 1,
                    }}
                  >
                    <EmptyState
                      icon={<MessageSquare size={22} strokeWidth={1.5} />}
                      title="No messages yet"
                      description="Send a message to start the conversation."
                    />
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOwn =
                      selectedConv &&
                      msg.sender_type !== selectedConv.other_party.type
                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: 'flex',
                          justifyContent: isOwn ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '70%',
                            background: isOwn
                              ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
                              : 'var(--surface)',
                            color: isOwn ? '#fff' : 'var(--text)',
                            borderRadius: 16,
                            padding: '10px 16px',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '0.9rem',
                              lineHeight: 1.5,
                              wordBreak: 'break-word',
                            }}
                          >
                            {msg.is_deleted ? (
                              <span
                                style={{
                                  fontStyle: 'italic',
                                  opacity: 0.6,
                                }}
                              >
                                This message was deleted
                              </span>
                            ) : (
                              msg.content
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: '0.7rem',
                              marginTop: '4px',
                              opacity: 0.7,
                              textAlign: isOwn ? 'right' : 'left',
                            }}
                          >
                            {msg.created_at
                              ? formatRelativeTime(msg.created_at)
                              : ''}
                            {msg.edited_at && ' (edited)'}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div
                style={{
                  padding: '14px 20px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                {isBlocked ? (
                  <div
                    style={{
                      textAlign: 'center',
                      color: 'var(--muted)',
                      fontSize: '0.85rem',
                      padding: '8px 0',
                    }}
                  >
                    This conversation has been blocked.
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleSend()
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '12px 18px',
                        borderRadius: '100px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || sending}
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        border: 'none',
                        background:
                          newMessage.trim() && !sending
                            ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
                            : 'var(--surface)',
                        color:
                          newMessage.trim() && !sending
                            ? '#fff'
                            : 'var(--muted)',
                        cursor:
                          newMessage.trim() && !sending
                            ? 'pointer'
                            : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'background 0.2s, color 0.2s',
                      }}
                    >
                      {sending ? (
                        <Loader2
                          size={18}
                          strokeWidth={1.5}
                          style={{ animation: 'spin 1s linear infinite' }}
                        />
                      ) : (
                        <Send size={18} strokeWidth={1.5} />
                      )}
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
