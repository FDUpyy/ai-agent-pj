import { useCallback, useRef, useState, useEffect } from "react"
import { StreamParser, ParseResult, Artifact } from "../utils/streamParser"

type Role = "user" | "ai" | "system"

export interface ChatMessage {
  id: string
  role: Role
  content: string
}

interface UseChatStreamResult {
  messages: ChatMessage[]
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  input: string
  setInput: (value: string) => void
  sending: boolean
  error: string | null
  send: () => Promise<void>
  addSystemMessage: (content: string) => void
  containerRef: React.RefObject<HTMLDivElement>
  currentArtifact: Artifact | null
  isParsingArtifact: boolean
  sessionId: string | null
  setSessionId: (id: string | null) => void
}

export function useChatStream(): UseChatStreamResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  
  // Artifact state
  const [currentArtifact, setCurrentArtifact] = useState<Artifact | null>(null)
  const [isParsingArtifact, setIsParsingArtifact] = useState(false)
  const streamParser = useRef(new StreamParser())

  const scrollToBottom = () => {
    if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }

  // Load messages when sessionId changes
  useEffect(() => {
    if (!sessionId) {
        setMessages([])
        return
    }

    const fetchMessages = async () => {
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/sessions/${sessionId}`)
            if (response.ok) {
                const data = await response.json()
                setMessages(data.map((msg: any) => ({
                    id: msg.id,
                    role: msg.role,
                    content: msg.content
                })))
                setTimeout(scrollToBottom, 100)
            }
        } catch (error) {
            console.error("Failed to load messages:", error)
        }
    }
    fetchMessages()
  }, [sessionId])

  const addSystemMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-system`,
        role: "system",
        content,
      },
    ])
    setTimeout(scrollToBottom, 100)
  }, [])

  const send = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    // Extract mentions from input
    // Format is @[display](id)
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g
    const mentions: string[] = []
    let match
    while ((match = mentionRegex.exec(trimmed)) !== null) {
        mentions.push(match[2]) // The ID is in the second group
    }
    
    // Clean input for display/sending (optional, but keep mentions for context)
    // Actually, we usually send raw input with mentions to backend, backend handles parsing if needed
    // But here we extracted IDs separately for the API field.

    // If no session ID (transient state), create one NOW before sending
    let activeSessionId = sessionId
    if (!activeSessionId) {
        try {
            const res = await fetch("http://127.0.0.1:8000/api/sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: "New Chat" })
            })
            if (res.ok) {
                const data = await res.json()
                activeSessionId = data.id
                setSessionId(activeSessionId)
            } else {
                throw new Error("Failed to create session")
            }
        } catch (e) {
            console.error("Failed to create session on demand:", e)
            setError("无法创建会话，请重试。")
            return
        }
    }

    // Reset parser state for new turn
    streamParser.current.reset()
    setCurrentArtifact(null)
    setIsParsingArtifact(false)

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: trimmed, // Show raw or cleaned? Raw is fine for now as react-mentions format is readable enough
    }
    
    // Optimistically add user message
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
            message: trimmed,
            session_id: activeSessionId,
            mentions: mentions // Send extracted IDs
        }),
      })

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }
      
      if (!response.body) {
          throw new Error("No response body")
      }

      // Initialize AI message placeholder
      const aiMessageId = `${Date.now()}-ai`
      setMessages((prev) => [...prev, { id: aiMessageId, role: "ai", content: "" }])

      const reader = response.body.getReader()
      const decoder = new TextDecoder("utf-8")

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        const chunkText = decoder.decode(value, { stream: true })
        if (!chunkText) continue

        // Feed to parser
        const result: ParseResult = streamParser.current.parse(chunkText)
        
        // Update Artifact state
        if (result.artifact) {
            setCurrentArtifact({ ...result.artifact })
        }
        setIsParsingArtifact(result.isParsingArtifact)

        // Update AI message content (display content only)
        setMessages((prev) => 
            prev.map((m) => 
                m.id === aiMessageId 
                    ? { ...m, content: result.displayContent }
                    : m
            )
        )
        scrollToBottom()
      }
    } catch (err) {
      console.error("Chat stream error:", err)
      setError("与服务器通信时发生错误，请稍后重试。")
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, sessionId])

  return {
    messages,
    setMessages,
    input,
    setInput,
    sending: isLoading,
    error,
    send,
    addSystemMessage,
    containerRef,
    currentArtifact,
    isParsingArtifact,
    sessionId,
    setSessionId
  }
}
