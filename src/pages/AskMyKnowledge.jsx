import React, { useState, useEffect, useRef, useMemo } from 'react';
import { searchKnowledge } from '../services/relevance';
import { askQuestion } from '../services/ai';
import './AskMyKnowledge.css';

/**
 * AskMyKnowledge — Chatbot page grounded in user's saved resources and tasks.
 *
 * Hardcoded suggested questions and tips have been removed.
 * Example prompts are generated dynamically from actual user resources/tasks.
 * Sources are shown inline below each assistant answer.
 */
function AskMyKnowledge({ resources = [], tasks = [], onOpenResource, onNavigate }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState('Searching your knowledge...');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // ── Scroll to bottom on new message ──────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── Generate dynamic example prompts from actual data ────────────────
  const examplePrompts = useMemo(() => {
    const prompts = [];

    if (resources.length === 0 && tasks.length === 0) {
      return []; // No data — show no fake prompts
    }

    // Build prompts from actual resource categories/titles
    const categories = [...new Set(
      resources
        .map(r => r.aiCategory || r.category)
        .filter(Boolean)
    )].slice(0, 3);

    categories.forEach(cat => {
      prompts.push(`What are the important points in my ${cat} resources?`);
    });

    // Add deadline prompt if tasks exist
    if (tasks.length > 0) {
      prompts.push('What are my upcoming deadlines?');
    }

    // Add a content prompt if any resource has contentText
    const hasContent = resources.some(r => r.contentText);
    if (hasContent && categories.length > 0) {
      prompts.push(`Summarize my ${categories[0]} notes.`);
    }

    // Cap at 4 prompts
    return prompts.slice(0, 4);
  }, [resources, tasks]);

  const hasAnyData = resources.length > 0 || tasks.length > 0;

  // ── Send handler ─────────────────────────────────────────────────────
  async function handleSend(textToSend) {
    const trimmed = (textToSend || inputValue).trim();
    if (!trimmed || isTyping) return;

    const userMsgId  = 'u-' + Date.now();
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages(prev => [...prev, {
      id:      userMsgId,
      role:    'user',
      content: trimmed,
      time:    timeString,
    }]);
    setInputValue('');
    setIsTyping(true);
    setTypingText('Searching your knowledge...');

    // Auto-resize textarea back
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // ── Local relevance filtering ──
    const context      = searchKnowledge(trimmed, resources, tasks);
    const hasResources = context.resources && context.resources.length > 0;
    const hasTasks     = context.tasks     && context.tasks.length     > 0;

    // Short-circuit: no relevant context found locally
    if (!hasResources && !hasTasks) {
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, {
          id:      'a-' + Date.now(),
          role:    'assistant',
          content: "I couldn't find information related to your question in your saved resources or tasks.\n\nTry uploading a document or adding more resources to your library.",
          time:    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sources: [],
        }]);
      }, 600);
      return;
    }

    // ── Transition loading text ──
    const loadingTimer = setTimeout(() => setTypingText('Generating answer...'), 700);

    // ── Call Gemini via Vercel API ──
    try {
      const response = await askQuestion(trimmed, context);
      clearTimeout(loadingTimer);
      setIsTyping(false);

      // Map validated source IDs back to full local objects
      const resolvedSources = (response.sources || []).map(src => {
        if (src.type === 'resource') {
          const found = resources.find(r => r.id?.toString() === src.id?.toString());
          if (found) return { ...src, original: found, sourceType: 'resource' };
        } else if (src.type === 'task') {
          const found = tasks.find(t => t.id?.toString() === src.id?.toString());
          if (found) return { ...src, original: found, sourceType: 'task' };
        }
        return null;
      }).filter(Boolean);

      setMessages(prev => [...prev, {
        id:      'a-' + Date.now(),
        role:    'assistant',
        content: response.answer || "I couldn't find this information in your saved knowledge.",
        time:    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: resolvedSources,
        notFound: response.notFound,
      }]);

    } catch (err) {
      clearTimeout(loadingTimer);
      console.error('Ask My Knowledge failed:', err);
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id:      'a-' + Date.now(),
        role:    'assistant',
        content: "Sorry, I couldn't search your knowledge right now. Please try again.",
        time:    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: [],
        error: true,
      }]);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Auto-resize textarea
  function handleInput(e) {
    setInputValue(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }

  // ── Render a single message content (paragraph + bullet support) ──────
  function renderMessageContent(content) {
    return content.split('\n').map((line, idx) => {
      if (line.startsWith('•') || line.startsWith('-') || line.match(/^\d+\./)) {
        return (
          <ul key={idx} className="ak-msg-list">
            <li>{line.replace(/^[•\-]\s*|\d+\.\s*/, '').trim()}</li>
          </ul>
        );
      }
      if (!line.trim()) return null;
      return <p key={idx}>{line}</p>;
    }).filter(Boolean);
  }

  return (
    <main className="ak-page" id="main-content" tabIndex={-1}>

      {/* Page Header */}
      <section className="ak-header" aria-labelledby="ak-page-title">
        <div>
          <h1 id="ak-page-title" className="ak-title">Ask My Knowledge</h1>
          <p className="ak-subtitle">
            Ask questions about your saved resources and tasks. Answers are grounded in your knowledge only.
          </p>
        </div>
      </section>

      {/* Chat Container */}
      <div className="ak-chat-container" aria-label="Chat interface">

        {/* Messages area */}
        <div
          className="ak-messages"
          role="log"
          aria-label="Conversation history"
          aria-live="polite"
        >
          {/* Empty state */}
          {messages.length === 0 && !isTyping && (
            <div className="ak-empty">
              <span className="ak-empty-icon" aria-hidden="true">✨</span>
              <p className="ak-empty-title">Ask My Knowledge</p>
              {hasAnyData ? (
                <>
                  <p className="ak-empty-desc">
                    Ask anything about your saved resources and tasks. Your answers are grounded only in your saved knowledge.
                  </p>
                  {examplePrompts.length > 0 && (
                    <div className="ak-example-prompts" aria-label="Example questions">
                      {examplePrompts.map((prompt, idx) => (
                        <button
                          key={idx}
                          className="ak-example-btn"
                          onClick={() => handleSend(prompt)}
                          disabled={isTyping}
                          aria-label={`Ask: ${prompt}`}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="ak-empty-desc">
                  You don't have any saved knowledge yet. Upload a resource or create a task to start asking questions.
                </p>
              )}
            </div>
          )}

          {/* Message list */}
          {messages.map((msg) => {
            const isAssistant = msg.role === 'assistant';
            return (
              <div
                key={msg.id}
                className={`ak-msg-wrapper ${isAssistant ? 'ak-msg-wrapper--assistant' : 'ak-msg-wrapper--user'}`}
              >
                <div
                  className={`ak-avatar ${isAssistant ? 'ak-avatar--assistant' : 'ak-avatar--user'}`}
                  aria-hidden="true"
                >
                  {isAssistant ? '✨' : 'A'}
                </div>

                <div className={`ak-msg ${isAssistant ? 'ak-msg--assistant' : 'ak-msg--user'}`}>
                  <div className="ak-msg-bubble">
                    {renderMessageContent(msg.content)}
                  </div>

                  {/* Inline Sources — only for assistant messages with sources */}
                  {isAssistant && msg.sources && msg.sources.length > 0 && (
                    <div className="ak-inline-sources" aria-label="Sources">
                      {msg.sources.map((src, sidx) => (
                        <button
                          key={sidx}
                          className="ak-inline-source-btn"
                          onClick={() => {
                            if (src.sourceType === 'resource' && src.original) {
                              onOpenResource(src.original);
                            } else if (src.sourceType === 'task') {
                              onNavigate('tasks');
                            }
                          }}
                          aria-label={`Open source: ${src.title}`}
                        >
                          <span aria-hidden="true">
                            {src.sourceType === 'task' ? '☑' : '📄'}
                          </span>
                          {src.title}
                        </button>
                      ))}
                    </div>
                  )}

                  <span className="ak-msg-time">{msg.time}</span>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {isTyping && (
            <div className="ak-msg-wrapper ak-msg-wrapper--assistant">
              <div className="ak-avatar ak-avatar--assistant" aria-hidden="true">✨</div>
              <div className="ak-typing-wrapper">
                <div className="ak-typing-indicator" aria-label={typingText}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span className="ak-typing-label">{typingText}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Composer */}
        <div className="ak-composer">
          <label htmlFor="ak-composer-textarea" className="ak-label-sr">
            Ask a question about your knowledge
          </label>
          <textarea
            id="ak-composer-textarea"
            ref={textareaRef}
            className="ak-composer-textarea"
            placeholder="Ask about your saved knowledge..."
            value={inputValue}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
            rows={1}
            aria-label="Ask a question"
          />
          <button
            className="ak-send-btn"
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isTyping}
            aria-label="Send question"
          >
            Send
          </button>
        </div>
      </div>

      <p className="ak-disclaimer" aria-live="off">
        🛡 Answers are based only on your saved resources and tasks. Anchor does not use external knowledge.
      </p>

    </main>
  );
}

export default AskMyKnowledge;
