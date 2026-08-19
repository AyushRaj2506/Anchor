/**
 * libraryData.js
 *
 * Central mock data file for the Library page.
 * When we add a real database later, this file gets replaced
 * with API calls — nothing else needs to change.
 */

export const LIBRARY_RESOURCES = [
  {
    id: 1,
    title: 'Database Normalization.pdf',
    category: 'DBMS',
    type: 'PDF',
    typeIcon: '📄',
    iconBg: '#fde8e0',
    iconColor: '#c97b5a',
    time: '2 hours ago',
    tags: ['dbms', 'normalization', 'database'],
    bookmarked: true,
  },
  {
    id: 2,
    title: 'Operating System Notes',
    category: 'Operating System',
    type: 'Note',
    typeIcon: '📝',
    iconBg: '#e3f0e3',
    iconColor: '#4a6741',
    time: '1 day ago',
    tags: ['os', 'system calls', 'important'],
    bookmarked: true,
  },
  {
    id: 3,
    title: 'CN Topology Diagram.png',
    category: 'Computer Networks',
    type: 'Image',
    typeIcon: '🖼',
    iconBg: '#e0ebf5',
    iconColor: '#3a7bd5',
    time: '2 days ago',
    tags: ['network', 'diagram'],
    bookmarked: false,
  },
  {
    id: 4,
    title: 'React useEffect Explained',
    category: 'Web Development',
    type: 'URL',
    typeIcon: '🔗',
    iconBg: '#fef4e0',
    iconColor: '#b8710a',
    time: '2 days ago',
    tags: ['react', 'hooks', 'useeffect'],
    bookmarked: true,
  },
  {
    id: 5,
    title: 'AI Project Requirements.md',
    category: 'AI / ML',
    type: 'Document',
    typeIcon: '📋',
    iconBg: '#ede3f5',
    iconColor: '#7e57c2',
    time: '5 days ago',
    tags: ['ai', 'project'],
    bookmarked: false,
  },
  {
    id: 6,
    title: 'DBMS ER Diagram Example',
    category: 'DBMS',
    type: 'Image',
    typeIcon: '🖼',
    iconBg: '#e0ebf5',
    iconColor: '#3a7bd5',
    time: '3 days ago',
    tags: ['dbms', 'er diagram', 'example'],
    bookmarked: true,
  },
  {
    id: 7,
    title: 'CN Unit 3 Notes.pdf',
    category: 'Computer Networks',
    type: 'PDF',
    typeIcon: '📄',
    iconBg: '#fde8e0',
    iconColor: '#c97b5a',
    time: '4 days ago',
    tags: ['computer networks', 'unit 3', 'notes'],
    bookmarked: true,
  },
  {
    id: 8,
    title: 'SQL Joins Cheatsheet',
    category: 'DBMS',
    type: 'Document',
    typeIcon: '📋',
    iconBg: '#ede3f5',
    iconColor: '#7e57c2',
    time: '2 weeks ago',
    tags: ['sql', 'dbms', 'cheatsheet'],
    bookmarked: true,
  },
  {
    id: 9,
    title: 'OS Lab Manual Notes',
    category: 'Operating System',
    type: 'Note',
    typeIcon: '📝',
    iconBg: '#e3f0e3',
    iconColor: '#4a6741',
    time: '1 week ago',
    tags: ['os', 'lab', 'notes'],
    bookmarked: true,
  },
  {
    id: 10,
    title: 'Vite Setup Documentation',
    category: 'Web Development',
    type: 'URL',
    typeIcon: '🔗',
    iconBg: '#fef4e0',
    iconColor: '#b8710a',
    time: '3 weeks ago',
    tags: ['vite', 'setup', 'javascript'],
    bookmarked: true,
  },
];


// All unique resource types — used as a static type list for Add Resource modal and Type filter
// (UI configuration — not mock data records)
export const RESOURCE_TYPES = ['PDF', 'Note', 'Image', 'URL', 'Document'];

/**
 * Per-resource mock detail data.
 * Keyed by resource id.
 * In a future milestone this will come from Firestore.
 */
export const RESOURCE_DETAILS = {
  1: {
    summary: 'This document explains the concept of database normalization in detail. It covers the need for normalization, functional dependencies, candidate keys, and the normal forms (1NF to BCNF) with examples. It also discusses denormalization and real-world applications.',
    importantInfo: [
      'Normalization reduces data redundancy.',
      '1NF eliminates repeating groups.',
      '2NF eliminates partial dependencies.',
      '3NF eliminates transitive dependencies.',
      'BCNF is a stronger version of 3NF.',
    ],
    deadlines: [
      { id: 'd1', title: 'DBMS Assignment', date: 'May 15, 11:59 PM' },
    ],
    actionItems: [
      { id: 'a1', text: 'Complete DBMS assignment on normalization.', done: false },
      { id: 'a2', text: 'Review functional dependencies and candidate keys.', done: false },
      { id: 'a3', text: 'Practice normalization up to BCNF on sample problems.', done: false },
    ],
    tags: ['dbms', 'normalization', 'database', 'relational model'],
    fileName: 'Database Normalization.pdf',
    uploadedOn: 'May 12, 2024 at 9:45 AM',
    fileSize: '1.24 MB',
    uploadedBy: 'You',
    previewPages: 12,
  },
  2: {
    summary: 'These notes cover the fundamental concepts of Operating Systems including process management, scheduling algorithms, memory management, and file systems. Key topics include deadlocks, virtual memory, and inter-process communication.',
    importantInfo: [
      'A process is a program in execution.',
      'Scheduling algorithms include FCFS, SJF, and Round Robin.',
      'Deadlock requires four conditions: mutual exclusion, hold-and-wait, no preemption, circular wait.',
      'Virtual memory allows a process to use more memory than physically available.',
    ],
    deadlines: [
      { id: 'd1', title: 'OS Lab Record', date: 'May 17, 11:59 PM' },
    ],
    actionItems: [
      { id: 'a1', text: 'Revise scheduling algorithms for exam.', done: false },
      { id: 'a2', text: 'Practice deadlock detection examples.', done: false },
    ],
    tags: ['os', 'important', 'processes', 'scheduling'],
    fileName: 'OS-Important-Notes.txt',
    uploadedOn: 'May 13, 2024 at 11:00 AM',
    fileSize: '0.34 MB',
    uploadedBy: 'You',
    previewPages: 8,
  },
  3: {
    summary: 'A visual diagram covering common network topologies including Bus, Star, Ring, Mesh, and Hybrid topologies. Each topology shows how nodes are connected and highlights the pros and cons of each architecture.',
    importantInfo: [
      'Star topology is the most common in LANs.',
      'Mesh topology provides redundancy.',
      'Bus topology is simple but a single break affects all nodes.',
      'Ring topology passes data in one direction.',
    ],
    deadlines: [
      { id: 'd1', title: 'CN Presentation', date: 'May 25, 11:59 PM' },
    ],
    actionItems: [
      { id: 'a1', text: 'Redraw star topology for lab report.', done: false },
    ],
    tags: ['network', 'diagram', 'topology', 'cn'],
    fileName: 'CN-Topology-Diagram.png',
    uploadedOn: 'May 11, 2024 at 2:30 PM',
    fileSize: '0.89 MB',
    uploadedBy: 'You',
    previewPages: 1,
  },
  4: {
    summary: 'This URL links to an in-depth article explaining the React useEffect hook. It covers when useEffect runs, how to use the dependency array, how to clean up side effects, and common mistakes developers make with useEffect.',
    importantInfo: [
      'useEffect runs after every render by default.',
      'Passing an empty [] runs it only once (on mount).',
      'Return a cleanup function to avoid memory leaks.',
      'Avoid missing dependencies in the dependency array.',
    ],
    deadlines: [
      { id: 'd1', title: 'React Project Setup', date: 'May 22, 11:59 PM' },
    ],
    actionItems: [
      { id: 'a1', text: 'Implement useEffect in the React project.', done: false },
      { id: 'a2', text: 'Write a cleanup function for the API fetch.', done: false },
    ],
    tags: ['react', 'javascript', 'hooks', 'web dev'],
    fileName: 'react-useeffect-explained (URL)',
    uploadedOn: 'May 10, 2024 at 4:15 PM',
    fileSize: '—',
    uploadedBy: 'You',
    previewPages: 0,
  },
  5: {
    summary: 'This markdown document outlines the requirements for the AI course project. It describes the problem statement, expected deliverables, dataset details, model requirements, evaluation criteria, and submission guidelines.',
    importantInfo: [
      'Dataset must be from a public repository.',
      'Minimum accuracy of 85% is required.',
      'Submit a Jupyter Notebook and a project report.',
      'Deadline is May 20, 11:59 PM.',
    ],
    deadlines: [
      { id: 'd1', title: 'AI Project Report', date: 'May 20, 11:59 PM' },
    ],
    actionItems: [
      { id: 'a1', text: 'Finalize dataset selection.', done: false },
      { id: 'a2', text: 'Train baseline model.', done: false },
      { id: 'a3', text: 'Write project report introduction.', done: false },
    ],
    tags: ['ai', 'project', 'ml', 'requirements'],
    fileName: 'AI-Project-Requirements.md',
    uploadedOn: 'May 9, 2024 at 10:00 AM',
    fileSize: '0.05 MB',
    uploadedBy: 'You',
    previewPages: 4,
  },
};

// Default detail data for resources that don't have a specific entry
export const DEFAULT_RESOURCE_DETAIL = {
  summary: 'No summary available for this resource yet.',
  importantInfo: ['No important information extracted yet.'],
  deadlines: [],
  actionItems: [],
  tags: [],
  fileName: '—',
  uploadedOn: '—',
  fileSize: '—',
  uploadedBy: 'You',
  previewPages: 0,
};
