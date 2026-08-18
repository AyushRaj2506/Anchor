import React, { useState, useEffect, useRef } from 'react';
import { SUGGESTED_QUESTIONS, MOCK_SOURCES, TIPS, PREDEFINED_ANSWERS } from '../data/knowledgeData';
import './AskMyKnowledge.css';

/**
 * AskMyKnowledge - Chat and Q&A page with the user's saved second brain resources.
 */
function AskMyKnowledge({ onOpenResource }) {
  const [messages, setMessages] = useState([
    {
      id: 'm1',
      role: 'user',
      content: 'What are my DBMS assignments and their deadlines?',
      time: '10:24 AM',
    },
    {
      id: 'm2',
      role: 'assistant',
      content: `Here are the DBMS assignments I found in your resources:

• **DBMS Assignment**
  Due Date: May 15, 2024 at 11:59 PM
  Source: Database Normalization.pdf

This assignment is about normalization, functional dependencies, candidate keys, and normal forms.`,
      note: 'Note: I searched your resources and found 1 DBMS assignment. If you have other DBMS assignments that are not in your resources, I couldn\'t find information about them.',
      time: '10:24 AM',
      sourceIds: [1, 6],
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  function handleSend(textToSend) {
    const trimmed = (textToSend || inputValue).trim();
    if (!trimmed) return;

    // Add user message
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

    // Simulate AI thinking and response
    setTimeout(() => {
      setIsTyping(false);
      const normalizedQuery = trimmed.toLowerCase().replace(/[?.!]$/, '');
      const matched = PREDEFINED_ANSWERS[normalizedQuery];

      let assistantMessage;
      if (matched) {
        assistantMessage = {
          id: 'a-' + Date.now(),
          role: 'assistant',
          content: matched.answer,
          note: matched.note,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sourceIds: matched.sources,
        };
      } else {
        assistantMessage = {
          id: 'a-' + Date.now(),
          role: 'assistant',
          content: `I'll search your saved resources for: "${trimmed}". 

AI processing and semantic RAG search will be connected in a later milestone. Currently, I'm simulating finding resources for this topic.`,
          note: 'Note: AI engine is currently offline (UI Only mode).',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sourceIds: [1], // fallback source
        };
      }

      setMessages((prev) => [...prev, assistantMessage]);
    }, 1000);
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
          <p className="ak-subtitle">Ask anything about your saved resources. I'll answer using only your knowledge.</p>
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

                            {msg.note && (
                              <div className="ak-msg-note">
                                <span className="ak-note-info-icon" aria-hidden="true">ℹ</span>
                                <span>{msg.note}</span>
                              </div>
                            )}
                          </div>

                          <div className="ak-msg-footer">
                            <span className="ak-msg-time">{msg.time}</span>
                            <div className="ak-msg-feedback">
                              <button className="ak-feedback-btn" aria-label="Copy response">📋</button>
                              <button className="ak-feedback-btn" aria-label="Good response">👍</button>
                              <button className="ak-feedback-btn" aria-label="Bad response">👎</button>
                            </div>
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
                  <div className="ak-typing-indicator" aria-label="Anchor is searching resources...">
                    <span></span>
                    <span></span>
                    <span></span>
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
                rows={1}
              />
              <div className="ak-composer-actions">
                <div className="ak-composer-left-actions">
                  <button className="ak-composer-btn" aria-label="Attach file placeholder">📎</button>
                  <button className="ak-composer-btn" aria-label="Filter parameters placeholder">🎛</button>
                </div>
                <button
                  className="ak-send-btn"
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim()}
                  aria-label="Send question"
                >
                  🚀
                </button>
              </div>
            </div>
          </div>
          
          <div className="ak-disclaimer">
            <span>🛡 Answers are based only on your uploaded resources. I don't use external information.</span>
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
              <span className="ak-right-subtitle">Based on your resources</span>
            </div>

            <div className="ak-sources-list">
              {MOCK_SOURCES.map((source) => (
                <div key={source.id} className="ak-source-card">
                  <div className="ak-source-top">
                    <div className="ak-source-type-badge" style={{ background: source.iconBg }}>
                      {source.typeIcon} {source.type}
                    </div>
                    <button
                      className="ak-source-open-btn"
                      onClick={() => onOpenResource({ id: source.id, title: source.title, type: source.type, typeIcon: source.typeIcon, iconBg: source.iconBg, tags: [], category: 'DBMS', time: '2 hours ago' })}
                      aria-label={`Open details for ${source.title}`}
                    >
                      ↗
                    </button>
                  </div>
                  <h3 className="ak-source-filename">{source.title}</h3>
                  {source.location && <span className="ak-source-location">{source.location}</span>}
                  <p className="ak-source-excerpt">{source.excerpt}</p>
                </div>
              ))}
            </div>

            <button className="ak-view-all-sources" aria-label="View all sources (3)">
              View all sources (3) ›
            </button>
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
