/**
 * taskData.js
 *
 * Central mock data file for the Tasks page.
 * status: 'todo' | 'inprogress' | 'completed'
 * priority: 'High' | 'Medium' | 'Low'
 */

export const TASKS = [
  // ── To Do ──────────────────────────────────────
  {
    id: 1,
    title: 'DBMS Assignment',
    category: 'DBMS',
    status: 'todo',
    priority: 'High',
    deadline: 'May 15, 11:59 PM',
    deadlineMs: new Date('2026-05-15T23:59:00').getTime(),
    bookmarked: false,
  },
  {
    id: 2,
    title: 'CN Unit 3 Revision',
    category: 'Computer Networks',
    status: 'todo',
    priority: 'Medium',
    deadline: 'May 19, 11:59 PM',
    deadlineMs: new Date('2026-05-19T23:59:00').getTime(),
    bookmarked: false,
  },
  {
    id: 3,
    title: 'React Project Setup',
    category: 'Web Development',
    status: 'todo',
    priority: 'Medium',
    deadline: 'May 22, 11:59 PM',
    deadlineMs: new Date('2026-05-22T23:59:00').getTime(),
    bookmarked: false,
  },
  {
    id: 4,
    title: 'Maths Practice Problems',
    category: 'Mathematics',
    status: 'todo',
    priority: 'Low',
    deadline: 'May 28, 11:59 PM',
    deadlineMs: new Date('2026-05-28T23:59:00').getTime(),
    bookmarked: false,
  },
  {
    id: 5,
    title: 'AI Ethics Essay Draft',
    category: 'AI / ML',
    status: 'todo',
    priority: 'Medium',
    deadline: 'May 30, 11:59 PM',
    deadlineMs: new Date('2026-05-30T23:59:00').getTime(),
    bookmarked: false,
  },
  {
    id: 6,
    title: 'Update Portfolio Website',
    category: 'Personal',
    status: 'todo',
    priority: 'Low',
    deadline: 'Jun 5, 11:59 PM',
    deadlineMs: new Date('2026-06-05T23:59:00').getTime(),
    bookmarked: false,
  },
  {
    id: 7,
    title: 'OS Virtual Memory Notes',
    category: 'Operating System',
    status: 'todo',
    priority: 'High',
    deadline: 'May 18, 11:59 PM',
    deadlineMs: new Date('2026-05-18T23:59:00').getTime(),
    bookmarked: false,
  },

  // ── In Progress ─────────────────────────────────
  {
    id: 8,
    title: 'OS Lab Record',
    category: 'Operating System',
    status: 'inprogress',
    priority: 'Medium',
    deadline: 'May 17, 11:59 PM',
    deadlineMs: new Date('2026-05-17T23:59:00').getTime(),
    bookmarked: false,
  },
  {
    id: 9,
    title: 'AI Project Report',
    category: 'AI / ML',
    status: 'inprogress',
    priority: 'Medium',
    deadline: 'May 20, 11:59 PM',
    deadlineMs: new Date('2026-05-20T23:59:00').getTime(),
    bookmarked: true,
  },
  {
    id: 10,
    title: 'CN Presentation',
    category: 'Computer Networks',
    status: 'inprogress',
    priority: 'Low',
    deadline: 'May 25, 11:59 PM',
    deadlineMs: new Date('2026-05-25T23:59:00').getTime(),
    bookmarked: false,
  },
  {
    id: 11,
    title: 'DBMS Mini Project',
    category: 'DBMS',
    status: 'inprogress',
    priority: 'High',
    deadline: 'May 21, 11:59 PM',
    deadlineMs: new Date('2026-05-21T23:59:00').getTime(),
    bookmarked: false,
  },

  // ── Completed ────────────────────────────────────
  {
    id: 12,
    title: 'Maths Problem Set 2',
    category: 'Mathematics',
    status: 'completed',
    priority: 'Medium',
    completedOn: 'Completed on May 10',
    deadlineMs: new Date('2026-05-10T23:59:00').getTime(),
    bookmarked: false,
  },
  {
    id: 13,
    title: 'Resume Update',
    category: 'Personal',
    status: 'completed',
    priority: 'Low',
    completedOn: 'Completed on May 11',
    deadlineMs: new Date('2026-05-11T23:59:00').getTime(),
    bookmarked: false,
  },
  {
    id: 14,
    title: 'Linux Tutorial',
    category: 'Operating System',
    status: 'completed',
    priority: 'Low',
    completedOn: 'Completed on May 12',
    deadlineMs: new Date('2026-05-12T23:59:00').getTime(),
    bookmarked: false,
  },
];

export const TASK_STATS = [
  {
    id: 'total',
    icon: '✔',
    iconBg: '#e8f0e8',
    label: 'Total Tasks',
    value: 14,
    sub: 'All your tasks',
    subColor: '#4a6741',
  },
  {
    id: 'todo',
    icon: '○',
    iconBg: '#fef4e0',
    label: 'To Do',
    value: 7,
    sub: 'Tasks to start',
    subColor: '#b8710a',
  },
  {
    id: 'inprogress',
    icon: '↻',
    iconBg: '#e0ebf5',
    label: 'In Progress',
    value: 4,
    sub: 'In progress',
    subColor: '#2a6496',
  },
  {
    id: 'completed',
    icon: '✓',
    iconBg: '#e3f0e3',
    label: 'Completed',
    value: 3,
    sub: 'Well done!',
    subColor: '#4a6741',
  },
];

// All unique task categories for the filter dropdown
export const TASK_CATEGORIES = [
  'DBMS',
  'Computer Networks',
  'Operating System',
  'Web Development',
  'AI / ML',
  'Mathematics',
  'Personal',
];

export const TASK_PRIORITIES = ['High', 'Medium', 'Low'];

// Maps status id → display config for Kanban columns
export const KANBAN_COLUMNS = [
  {
    id: 'todo',
    label: 'To Do',
    accent: 'var(--color-col-todo)',
    emptyMsg: 'No tasks to do.',
  },
  {
    id: 'inprogress',
    label: 'In Progress',
    accent: 'var(--color-col-inprogress)',
    emptyMsg: 'No tasks in progress.',
  },
  {
    id: 'completed',
    label: 'Completed',
    accent: 'var(--color-col-done)',
    emptyMsg: 'No completed tasks.',
  },
];
