'use client'

import { useState, useCallback, useEffect } from 'react'

// Strip markdown before speaking so the TTS output is clean prose
const MARKDOWN_RE = /(\*\*|__|\*|_|~~|`{1,3}|#{1,6}\s|!\[.*?\]\(.*?\)|\[([^\]]+)\]\(.*?\))/g

function stripMarkdown(text: string): string {
  return text.replace(MARKDOWN_RE, '$2').trim()
}

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    setIsSupported(typeof window !== 'undefined' && 'speechSynthesis' in window)
  }, [])

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(stripMarkdown(text))
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }, [])

  const stop = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [])

  return { speak, stop, isSpeaking, isSupported }
}
