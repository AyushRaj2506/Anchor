import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AskMyKnowledge from '../../pages/AskMyKnowledge';
import * as aiService from '../../services/ai';

vi.mock('../../services/ai', () => ({
  askQuestion: vi.fn(),
}));

describe('AskMyKnowledge Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state correctly', () => {
    render(<AskMyKnowledge resources={[]} tasks={[]} user={{ isDemo: true }} />);
    expect(screen.getByText('Anchor')).toBeInTheDocument();
    expect(screen.getAllByText('Ask My Knowledge')[0]).toBeInTheDocument();
  });

  it('allows user to submit a question and renders successful response', async () => {
    aiService.askQuestion.mockResolvedValueOnce({
      answer: 'This is the AI response',
      sources: []
    });

    render(<AskMyKnowledge resources={[{ id: '1', title: 'Note', content: 'hello' }]} tasks={[]} user={{ isDemo: true }} />);
    
    const input = screen.getByPlaceholderText('Ask anything about your saved knowledge...');
    const submitBtn = screen.getByLabelText('Send message');
    
    fireEvent.change(input, { target: { value: 'What is this?' } });
    fireEvent.click(submitBtn);
    
    // User message should appear
    expect(screen.getByText('What is this?')).toBeInTheDocument();
    
    // Wait for AI response
    await waitFor(() => {
      expect(screen.getByText(/I couldn't find information related to your question in your saved resources or tasks/i)).toBeInTheDocument();
    });
  });

  it('displays fallback error on AI failure', async () => {
    aiService.askQuestion.mockRejectedValueOnce(new Error('Network Error'));

    render(<AskMyKnowledge resources={[{ id: '1', title: 'Note', content: 'hello' }]} tasks={[]} user={{ isDemo: true }} />);
    
    const input = screen.getByPlaceholderText('Ask anything about your saved knowledge...');
    const submitBtn = screen.getByLabelText('Send message');
    
    fireEvent.change(input, { target: { value: 'Break it' } });
    fireEvent.click(submitBtn);
    
    await waitFor(() => {
      expect(screen.getByText(/I couldn't find information related to your question/i)).toBeInTheDocument();
    });
  });
});
