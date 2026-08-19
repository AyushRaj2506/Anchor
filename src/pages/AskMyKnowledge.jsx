import React, { useState, useEffect, useRef } from 'react';
import { SUGGESTED_QUESTIONS, TIPS } from '../data/knowledgeData';
import { searchKnowledge } from '../services/relevance';
import { askQuestion } from '../services/ai';
import './AskMyKnowledge.css';

/**
 * AskMyKnowledge - Chat and Q&A page grounded in user's saved resources and tasks.
 */
function AskMyKnowledge({ resources = [], tasks = [], onOpenResource, onNavigate }) {
  const [messages, setMessages] = useState([
    {
      id: 'init',
      role: 'assistant',
      content: 'Ask questions about your saved resources and tasks. I will answer using only your knowledge.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState('Searching your knowledge...');
  const [activeSources, setActiveSources] = useState([]);
  const messagesEndRef = useRef(null);

  // Clear messages on mount to start fresh, or keep the initial greeting
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  async function handleSend(textToSend) {
    const trimmed = (textToSend || inputValue).trim();
    if (!trimmed || isTyping) return;

    // Reset previous sources for the new query
    setActiveSources([]);

    // 1. Add User Message
    const userMsgId = 'u-' + Date.now();
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessage = {
      id: userMsgId,
      role: 'user',
      content: trimmed,
      time: timeString,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);
    setTypingText('Searching your knowledge...');

    // 2. Local Relevance Filtering
    const context = searchKnowledge(trimmed, resources, tasks);
    const hasResources = context.resources && context.resources.length > 0;
    const hasTasks = context.tasks && context.tasks.length > 0;

    // Cost control/No-result behavior: If no context matches, bypass Gemini entirely
    if (!hasResources && !hasTasks) {
      setTimeout(() => {
        setIsTyping(false);
        const assistantMsgId = 'a-' + Date.now();
        const noResultMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: "I couldn't find information related to your question in your saved resources or tasks.\n\nTry asking about a resource, subject, placement notice, internship, or task you've saved.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, noResultMessage]);
      }, 800);
      return;
    }

    // 3. Switch loading state text
    setTimeout(() => {
      if (isTyping) {
        setTypingText('Generating answer...');
      }
    }, 600);

    // 4. Call Vercel Ask API
    try {
      setTypingText('Generating answer...');
      const response = await askQuestion(trimmed, context);
      
      setIsTyping(false);
      const assistantMsgId = 'a-' + Date.now();
      const assistantMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: response.answer,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // 5. Map validated sources back to their full local resource/task metadata objects
      if (response.sources && response.sources.length > 0) {
        const resolvedSources = response.sources.map(src => {
          if (src.type === 'resource') {
            const found = resources.find(r => r.id.toString() === src.id.toString());
            if (found) {
              return {
                id: found.id,
                title: found.title,
                type: found.type || 'Document',
                typeIcon: found.typeIcon || '📋',
                iconBg: found.iconBg || '#e8f0e8',
                excerpt: found.description || found.notes || 'No description added.',
                location: found.category || 'Library',
                original: found,
                sourceType: 'resource'
              };
            }
          } else if (src.type === 'task') {
            const found = tasks.find(t => t.id.toString() === src.id.toString());
            if (found) {
              return {
                id: found.id,
                title: found.title,
                type: 'Task',
                typeIcon: '☑',
                iconBg: '#fef4e0',
                excerpt: found.description || 'No description added.',
                location: `${found.status || 'todo'} • ${found.priority || 'Medium'}`,
                original: found,
                sourceType: 'task'
              };
            }
          }
          return null;
        }).filter(Boolean);

        setActiveSources(resolvedSources);
      }

    } catch (err) {
      console.error('Ask My Knowledge failed:', err);
      setIsTyping(false);
      const assistantMsgId = 'a-' + Date.now();
      const errorMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: "Sorry, I couldn't answer that right now. Please try again.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  }

  function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <main className="ak-page" id="main-content" tabIndex={-1}>
      {/* Page Header */}
      <section className="ak-header" aria-labelledby="ak-page-title">
        <div>
          <h1 id="ak-page-title" className="ak-title">Ask My Knowledge</h1>
          <p className="ak-subtitle">Ask anything about your saved resources and tasks. I'll answer using only your knowledge.</p>
        </div>
      </section>

      {/* Main Grid Layout */}
      <div className="ak-body">
        {/* Left Column: Chat Area */}
        <div className="ak-left">
          {/* Suggested Questions */}
          <section className="ak-suggestions card" aria-labelledby="ak-suggested-heading">
            <h2 id="ak-suggested-heading" className="ak-suggestions-title">
              <span className="ak-suggestions-icon" aria-hidden="true">💡</span> Suggested Questions
            </h2>
            <div className="ak-chips">
              {SUGGESTED_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  className="ak-chip-btn"
                  onClick={() => setInputValue(q)}
                  disabled={isTyping}
                  aria-label={`Ask suggested question: ${q}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </section>

          {/* Conversation list wrapper */}
          <div className="ak-chat-card card">
            <div className="ak-chat-flow" role="log" aria-label="Conversation history">
              {messages.map((msg) => {
                const isAssistant = msg.role === 'assistant';
                return (
                  <div
                    key={msg.id}
                    className={`ak-msg-wrapper ${isAssistant ? 'ak-msg-wrapper--assistant' : 'ak-msg-wrapper--user'}`}
                  >
                    {isAssistant ? (
                      <>
                        <div className="ak-avatar ak-avatar--assistant" aria-hidden="true">
                          ✨
                        </div>
                        <div className="ak-msg ak-msg--assistant">
                          <div className="ak-msg-bubble">
                            {msg.content.split('\n').map((line, lidx) => {
                              if (line.startsWith('•')) {
                                return (
                                  <ul key={lidx} className="ak-msg-list">
                                    <li>{line.replace('•', '').trim()}</li>
                                  </ul>
                                );
                              }
                              return <p key={lidx}>{line}</p>;
                            })}
                          </div>

                          <div className="ak-msg-footer">
                            <span className="ak-msg-time">{msg.time}</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="ak-msg ak-msg--user">
                          <div className="ak-msg-bubble">
                            <p>{msg.content}</p>
                          </div>
                          <div className="ak-msg-footer">
                            <span className="ak-msg-time">{msg.time}</span>
                          </div>
                        </div>
                        <div className="ak-avatar ak-avatar--user" aria-label="You" role="img">
                          A
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {isTyping && (
                <div className="ak-msg-wrapper ak-msg-wrapper--assistant">
                  <div className="ak-avatar ak-avatar--assistant" aria-hidden="true">
                    ✨
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className="ak-typing-indicator" aria-label={typingText}>
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: '12px' }}>
                      {typingText}
                    </span>
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
                className="ak-composer-textarea"
                placeholder="Ask a question about your knowledge..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isTyping}
                rows={1}
              />
              <div className="ak-composer-actions">
                <div className="ak-composer-left-actions">
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: '6px' }}>
                    Single-question session
                  </span>
                </div>
                <button
                  className="ak-send-btn"
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim() || isTyping}
                  aria-label="Send question"
                >
                  🚀
                </button>
              </div>
            </div>
          </div>
          
          <div className="ak-disclaimer">
            <span>🛡 Answers are based only on your saved resources and tasks. Anchor does not use external knowledge.</span>
          </div>
        </div>

        {/* Right Column: Sources & Tips Panel */}
        <div className="ak-right">
          {/* Sources panel */}
          <section className="card ak-right-section" aria-labelledby="ak-sources-heading">
            <div className="ak-sources-header">
              <h2 id="ak-sources-heading" className="ak-right-title">
                📄 Sources
              </h2>
              <span className="ak-right-subtitle">Based on your saved items</span>
            </div>

            <div className="ak-sources-list">
              {activeSources.length > 0 ? (
                activeSources.map((source) => (
                  <div key={source.id} className="ak-source-card">
                    <div className="ak-source-top">
                      <div className="ak-source-type-badge" style={{ background: source.iconBg }}>
                        {source.typeIcon} {source.type}
                      </div>
                      <button
                        className="ak-source-open-btn"
                        onClick={() => {
                          if (source.sourceType === 'resource') {
                            onOpenResource(source.original);
                          } else if (source.sourceType === 'task') {
                            onNavigate('tasks');
                          }
                        }}
                        aria-label={`Open details for ${source.title}`}
                      >
                        ↗
                      </button>
                    </div>
                    <h3 className="ak-source-filename">{source.title}</h3>
                    {source.location && <span className="ak-source-location">{source.location}</span>}
                    <p className="ak-source-excerpt">{source.excerpt}</p>
                  </div>
                ))
              ) : (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.88rem', fontStyle: 'italic' }}>
                  No sources cited yet.
                </div>
              )}
            </div>

            {activeSources.length > 0 && (
              <div className="ak-view-all-sources" style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', textAlign: 'center', paddingTop: '8px' }}>
                Cited {activeSources.length} source(s)
              </div>
            )}
          </section>

          {/* Tips panel */}
          <section className="card ak-right-section" aria-labelledby="ak-tips-heading">
            <h2 id="ak-tips-heading" className="ak-right-title">
              💡 Tips
            </h2>
            <span className="ak-right-subtitle">Get the best answers</span>
            <ul className="ak-tips-list" role="list">
              {TIPS.map((tip, idx) => (
                <li key={idx} className="ak-tip-item">
                  {tip}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}

export default AskMyKnowledge;
