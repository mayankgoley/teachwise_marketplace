'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { MessageSquare, Send, ArrowLeft, Loader2, Paperclip } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import Avatar from '@/components/ui/Avatar'
import { formatRelativeTime } from '@/lib/format'
import type { ChatConversation, ChatMessage } from '@/types/chat'

interface MessagesResponse {
  messages: ChatMessage[]
  other_party: { id: number; name: string; avatar_url: string | null; type: string }
  is_blocked: boolean
}

export default function StudentMessagesPage() {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [filteredConversations, setFilteredConversations] = useState<ChatConversation[]>([])
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [otherParty, setOtherParty] = useState<{ id: number; name: string; avatar_url: string | null; type: string } | null>(null)
  const [isBlocked, setIsBlocked] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const loadConversations = useCallback(async () => {
    const res = await apiGet<{ conversations: ChatConversation[] }>('/api/v1/chat/conversations')
    if (res.success) {
      setConversations(res.data.conversations)
      setFilteredConversations(res.data.conversations)
    }
    setLoadingConversations(false)
  }, [])

  const loadMessages = useCallback(async (convId: number) => {
    setLoadingMessages(true)
    const res = await apiGet<MessagesResponse>('/api/v1/chat/conversations/' + convId + '/messages')
    if (res.success) {
      setMessages(res.data.messages)
      setOtherParty(res.data.other_party)
      setIsBlocked(res.data.is_blocked)
    }
    setLoadingMessages(false)
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (selectedConvId) {
      loadMessages(selectedConvId)
    }
  }, [selectedConvId, loadMessages])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (!selectedConvId) return
    const interval = setInterval(() => {
      loadMessages(selectedConvId)
    }, 5000)
    return () => clearInterval(interval)
  }, [selectedConvId, loadMessages])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations)
      return
    }
    const q = searchQuery.toLowerCase()
    setFilteredConversations(
      conversations.filter((c) => c.other_party.name.toLowerCase().includes(q))
    )
  }, [searchQuery, conversations])

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConvId || sending) return
    const content = newMessage.trim()
    setNewMessage('')
    setSending(true)
    const res = await apiPost('/api/v1/chat/conversations/' + selectedConvId + '/messages', { content })
    if (res.success) {
      await loadMessages(selectedConvId)
      await loadConversations()
    }
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const selectConversation = (convId: number) => {
    setSelectedConvId(convId)
    setMessages([])
    setOtherParty(null)
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 80px)', overflow: 'hidden', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--card)' }}>
      <div style={{ width: '320px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }} className={selectedConvId !== null ? 'hidden md:flex' : 'flex'}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }} className="font-head">Messages</h2>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '100px', padding: '10px 16px', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingConversations ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <Loader2 size={24} strokeWidth={1.5} style={{ color: 'var(--muted)', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : filteredConversations.length === 0 ? (
            <EmptyState
              icon={<MessageSquare size={22} strokeWidth={1.5} />}
              title="No conversations"
              description="Start a conversation with a tutor from their profile page."
            />
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: selectedConvId === conv.id ? 'rgba(79,142,255,0.08)' : 'transparent', transition: 'background 0.15s' }}
              >
                <Avatar name={conv.other_party.name} avatarUrl={conv.other_party.avatar_url} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text)', fontWeight: conv.unread_count > 0 ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.other_party.name}</span>
                    {conv.last_message_at && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--muted)', flexShrink: 0, marginLeft: '8px' }}>{formatRelativeTime(conv.last_message_at)}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.last_message?.content || 'No messages yet'}</span>
                    {conv.unread_count > 0 && (
                      <span style={{ flexShrink: 0, marginLeft: '8px', minWidth: '18px', height: '18px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: '#fff', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{conv.unread_count}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }} className={selectedConvId === null ? 'hidden md:flex' : 'flex'}>
        {selectedConvId === null ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={24} strokeWidth={1.5} style={{ color: 'var(--muted)' }} />
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>Select a conversation to start messaging</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <button
                onClick={() => setSelectedConvId(null)}
                className="md:hidden"
                style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center' }}
              >
                <ArrowLeft size={20} strokeWidth={1.5} />
              </button>
              {otherParty && (
                <>
                  <Avatar name={otherParty.name} avatarUrl={otherParty.avatar_url} size="sm" />
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>{otherParty.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{otherParty.type === 'tutor' ? 'Tutor' : 'Student'}</div>
                  </div>
                </>
              )}
            </div>

            <div ref={messagesContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {loadingMessages && messages.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                  <Loader2 size={24} strokeWidth={1.5} style={{ color: 'var(--muted)', animation: 'spin 1s linear infinite' }} />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                  <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No messages yet. Say hello!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.sender_type === 'student'
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                      <div>
                        <div style={{ background: isOwn ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : 'rgba(255,255,255,0.05)', color: isOwn ? '#fff' : 'var(--text)', borderRadius: '16px', padding: '10px 16px', maxWidth: '70%', fontSize: '0.875rem', lineHeight: 1.5, wordBreak: 'break-word', minWidth: 'fit-content' }}>
                          {msg.content}
                        </div>
                        {msg.created_at && (
                          <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '4px', textAlign: isOwn ? 'right' : 'left', paddingLeft: isOwn ? 0 : '4px', paddingRight: isOwn ? '4px' : 0 }}>
                            {formatRelativeTime(msg.created_at)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {!isBlocked && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <button style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
                  <Paperclip size={20} strokeWidth={1.5} />
                </button>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '100px', padding: '10px 16px', color: 'var(--text)', fontSize: '0.875rem', outline: 'none' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  style={{ width: '40px', height: '40px', borderRadius: '50%', background: newMessage.trim() && !sending ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : 'rgba(255,255,255,0.05)', border: 'none', cursor: newMessage.trim() && !sending ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}
                >
                  {sending ? (
                    <Loader2 size={18} strokeWidth={1.5} style={{ color: '#fff', animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Send size={18} strokeWidth={1.5} style={{ color: '#fff' }} />
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
