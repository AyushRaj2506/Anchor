/**
 * knowledgeData.js
 *
 * Mock questions, predefined responses, sources, and tips for the Ask My Knowledge page.
 */

export const SUGGESTED_QUESTIONS = [
  'What are my upcoming deadlines?',
  'What is normalization in DBMS?',
  'What tasks do I need to complete?',
  'Summarize my DBMS notes',
  'Show important points from my resources',
  'What did I learn about OS system calls?',
];

export const MOCK_SOURCES = [
  {
    id: 1, // Database Normalization.pdf resource ID
    title: 'Database Normalization.pdf',
    type: 'PDF',
    typeIcon: '📄',
    iconBg: '#fde8e0',
    location: 'Page 3',
    excerpt: '"DBMS Assignment: Implement normalization up to BCNF..."',
  },
  {
    id: 6, // DBMS ER Diagram Example or DBMS Assignment.pdf placeholder id
    title: 'DBMS Assignment.pdf',
    type: 'PDF',
    typeIcon: '📄',
    iconBg: '#fde8e0',
    location: 'Page 1',
    excerpt: '"Assignment 1: Normalization and Functional Dependencies..."',
  },
  {
    id: 2, // Operating System Notes or DBMS Quick Notes
    title: 'DBMS Quick Notes',
    type: 'Note',
    typeIcon: '📝',
    iconBg: '#e3f0e3',
    location: '',
    excerpt: '"Normalization reduces data redundancy and improves..."',
  },
];

export const TIPS = [
  'Ask specific questions about your topics.',
  'Mention subjects like DBMS, OS, CN, etc.',
  'Use keywords from your notes or PDFs.',
  'I can only answer based on your resources.',
  'I won\'t make up information.',
];

// Predefined answers to show real interactive capability
export const PREDEFINED_ANSWERS = {
  'what are my dbms assignments and their deadlines?': {
    answer: `Here are the DBMS assignments I found in your resources:

• **DBMS Assignment**
  Due Date: May 15, 2024 at 11:59 PM
  Source: Database Normalization.pdf

This assignment is about normalization, functional dependencies, candidate keys, and normal forms.`,
    note: 'Note: I searched your resources and found 1 DBMS assignment. If you have other DBMS assignments that are not in your resources, I couldn\'t find information about them.',
    sources: [1, 6],
  },
  'what is normalization in dbms?': {
    answer: `Database normalization is the process of structuring a relational database in accordance with a series of so-called normal forms in order to reduce data redundancy and improve data integrity.

It divides larger tables into smaller tables and links them using relationships. Common normal forms include 1NF, 2NF, 3NF, and BCNF.`,
    note: 'Based on your Database Normalization.pdf resource.',
    sources: [1],
  },
  'what are my upcoming deadlines?': {
    answer: `Based on your resources, I found the following upcoming deadline:

• **DBMS Assignment**
  Due Date: May 15, 2024 at 11:59 PM
  Source: Database Normalization.pdf`,
    note: 'Keep track of this in your Tasks panel.',
    sources: [1],
  },
  'what tasks do i need to complete?': {
    answer: `You have tasks lined up. In your DBMS topics:
• Complete DBMS assignment on normalization.
• Practice normalization up to BCNF.

Check your Tasks page for Process Records or Networks topologies too.`,
    note: 'Derived from your linked study items.',
    sources: [1, 2],
  },
};
