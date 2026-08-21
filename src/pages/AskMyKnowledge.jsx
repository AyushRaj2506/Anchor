import React, { useState, useEffect, useRef, useMemo } from 'react';
import { searchKnowledge } from '../services/relevance';
import { askQuestion } from '../services/ai';
import { auth } from '../config/firebase';
import './AskMyKnowledge.css';

/**
 * AskMyKnowledge — Production-quality grounded AI chat.
 */
function AskMyKnowledge({ resources = [], tasks = [], onOpenResource, onNavigate, user }) {
  const [messages,     setMessages]    = useState([]);
  const [inputValue,   setInputValue]  = useState('');
  const [isTyping,     setIsTyping]    = useState(false);
  const [typingText,   setTypingText]  = useState('Searching your knowledge...');
  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);

  // ── Scroll to bottom on new message ──────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── Focus input on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // ── Generate dynamic example prompts from actual data ────────────────
  const examplePrompts = useMemo(() => {
    if (resources.length === 0 && tasks.length === 0) return [];

    const prompts = [];

    // Prompt from individual resource titles
    const titledResources = resources.filter(r => r.title && r.title.trim().length > 3);
    if (titledResources.length > 0) {
      const r = titledResources[0];
      const t = (r.type || '').toLowerCase();
      if (t === 'pdf' || t === 'document') {
        prompts.push(`Summarize my "${r.title}" document`);
      } else if (t === 'note') {
        prompts.push(`What are the key points in my "${r.title}" note?`);
      } else {
        prompts.push(`What does my "${r.title}" resource cover?`);
      }
    }
    if (titledResources.length > 1) {
      const r = titledResources[1];
      prompts.push(`Explain the main ideas from "${r.title}"`);
    }

    // Category-level prompts
    const categories = [...new Set(
      resources.map(r => r.aiCategory || r.category).filter(Boolean)
    )].slice(0, 2);
    categories.forEach(cat => {
      if (!prompts.some(p => p.toLowerCase().includes(cat.toLowerCase()))) {
        prompts.push(`What are the important points in my ${cat} resources?`);
      }
    });

    // Task-related prompts
    if (tasks.length > 0) {
      const upcomingTasks = tasks.filter(t =>
        t.deadlineMs && t.status !== 'completed' && t.deadlineMs > Date.now()
      );
      if (upcomingTasks.length > 0) {
        prompts.push('What deadlines are coming up?');
      } else {
        prompts.push('What tasks are still pending?');
      }
    }

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
      let idToken = null;
      if (auth.currentUser && (!user || !user.isDemo)) {
        idToken = await auth.currentUser.getIdToken();
      }

      const response = await askQuestion(trimmed, context, idToken);
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
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id:      'a-' + Date.now(),
        role:    'assistant',
        content: "I couldn't process that question right now. Please try again.",
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
    ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
  }

  function handleClearChat() {
    setMessages([]);
    if (textareaRef.current) textareaRef.current.focus();
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

  function formatBytes(bytes) {
    if (!bytes) return '';
    const mb = bytes / 1024 / 1024;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  function typeIcon(t) {
    const type = (t || '').toLowerCase();
    if (type === 'pdf') return '📄';
    if (type === 'image') return '🖼';
    if (type === 'note') return '📝';
    if (type === 'url') return '🔗';
    return '📋';
  }

  return (
    <main className="ak-chat-app" id="main-content" tabIndex={-1}>
      {/* Header */}
      <header className="ak-chat-header">
        <div className="ak-chat-header-info">
          <span className="ak-chat-header-icon" aria-hidden="true">✨</span>
          <div className="ak-chat-header-text">
            <h1 className="ak-chat-title">Anchor</h1>
            <p className="ak-chat-subtitle">Ask My Knowledge</p>
            <p className="ak-chat-tagline">Grounded in your saved knowledge</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button className="ak-chat-clear" onClick={handleClearChat} aria-label="Clear chat">
            Clear chat
          </button>
        )}
      </header>

      {/* Messages */}
      <div className="ak-chat-messages" role="log" aria-live="polite">
        {messages.length === 0 && !isTyping ? (
          <div className="ak-chat-empty">
             <span className="ak-empty-sparkle" aria-hidden="true">✨</span>
             <h2 className="ak-empty-title">Ask My Knowledge</h2>
             {hasAnyData ? (
               <>
                 <p className="ak-empty-desc">Ask anything about your saved resources and tasks.</p>
                 <div className="ak-empty-suggestions">
                   {examplePrompts.map((prompt, idx) => (
                     <button
                       key={idx}
                       className="ak-empty-suggestion-btn"
                       onClick={() => handleSend(prompt)}
                       disabled={isTyping}
                     >
                       {prompt}
                     </button>
                   ))}
                 </div>
               </>
             ) : (
               <>
                 <p className="ak-empty-desc">Your knowledge base is empty<br/>Add a resource to start asking Anchor questions about your college material.</p>
                 <button
                   className="ak-empty-add-btn"
                   onClick={() => onNavigate && onNavigate('library')}
                 >
                   + Add Resource
                 </button>
               </>
             )}
          </div>
        ) : (
          <div className="ak-chat-thread">
             {messages.map(msg => {
                const isAI = msg.role === 'assistant';
                return (
                  <div key={msg.id} className={`ak-message-wrapper ${isAI ? 'ak-ai' : 'ak-user'}`}>
                    <div className="ak-message-info">
                      {isAI ? (
                        <div className="ak-message-sender">
                           <span className="ak-sender-avatar" aria-hidden="true">✨</span>
                           <span className="ak-sender-name">Anchor</span>
                           <span className="ak-sender-time">{msg.time}</span>
                        </div>
                      ) : (
                        <div className="ak-message-sender">
                           <span className="ak-sender-name">You</span>
                           <span className="ak-sender-time">{msg.time}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className={`ak-message-bubble ${isAI ? 'ak-bubble-ai' : 'ak-bubble-user'}`}>
                      {renderMessageContent(msg.content)}
                    </div>

                    {isAI && msg.sources && msg.sources.length > 0 && (
                      <div className="ak-message-sources">
                        <p className="ak-sources-title">Sources</p>
                        <div className="ak-sources-list">
                          {msg.sources.map((src, idx) => {
                            if (src.sourceType === 'resource') {
                              const r = src.original;
                              return (
                                <button 
                                  key={idx} 
                                  className="ak-source-chip"
                                  onClick={() => onOpenResource(r)}
                                >
                                  <span className="ak-source-chip-icon">{typeIcon(r.type)}</span>
                                  <span className="ak-source-chip-text">{r.title}</span>
                                  <span className="ak-source-chip-meta">
                                    {r.type || 'Document'} {r.fileSize ? `· ${formatBytes(r.fileSize)}` : ''}
                                  </span>
                                </button>
                              );
                            }
                            const t = src.original;
                            return (
                              <button 
                                key={idx} 
                                className="ak-source-chip"
                                onClick={() => onNavigate('tasks')}
                              >
                                <span className="ak-source-chip-icon">☑</span>
                                <span className="ak-source-chip-text">{t.title}</span>
                                <span className="ak-source-chip-meta">Task · {t.status || 'pending'}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
             })}
             
             {isTyping && (
                <div className="ak-message-wrapper ak-ai">
                  <div className="ak-message-info">
                    <div className="ak-message-sender">
                       <span className="ak-sender-avatar" aria-hidden="true">✨</span>
                       <span className="ak-sender-name">Anchor</span>
                    </div>
                  </div>
                  <div className="ak-message-bubble ak-bubble-ai ak-typing-bubble">
                    <div className="ak-dots">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
             )}
             <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="ak-chat-composer">
        <div className="ak-composer-inner">
          <textarea
            ref={textareaRef}
            className="ak-composer-input"
            placeholder="Ask anything about your saved knowledge..."
            value={inputValue}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
            rows={1}
            aria-label="Ask about your saved knowledge"
          />
          <button
            className="ak-composer-send"
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isTyping}
            aria-label="Send message"
          >
            ➤
          </button>
        </div>
      </div>
    </main>
  );
}

export default AskMyKnowledge;
