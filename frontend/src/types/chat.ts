export interface ChatParty {
  id: number | null
  name: string
  avatar_url: string | null
  type: 'student' | 'tutor'
}

export interface LastMessage {
  content: string | null
  sender_type: 'student' | 'tutor'
  created_at: string | null
  message_type: 'text' | 'image' | 'file'
}

export interface ChatConversation {
  id: number
  other_party: ChatParty
  last_message: LastMessage | null
  unread_count: number
  is_blocked: boolean
  last_message_at: string | null
  created_at: string | null
}

export interface ChatMessage {
  id: number
  conversation_id: number
  sender_type: 'student' | 'tutor'
  sender_id: number
  content: string
  is_read: boolean
  status: 'sent' | 'delivered' | 'read'
  read_at: string | null
  message_type: 'text' | 'image' | 'file'
  file_url: string | null
  file_name: string | null
  file_size: number | null
  file_mime_type: string | null
  edited_at: string | null
  is_deleted: boolean
  created_at: string | null
}
