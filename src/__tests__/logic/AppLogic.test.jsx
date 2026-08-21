import { describe, it, expect, vi } from 'vitest';
// We will test the pure logic for deadline extraction and duplicate prevention
// Since the logic is inside App.jsx and tightly coupled to the component state in the current architecture,
// we will simulate the core date parsing logic that is used in handleCreateTasksFromAnalysis.

describe('Application Core Logic', () => {
  it('normalizes deadlines and infers the current year for dates without a year', () => {
    // The logic in App.jsx uses:
    // let dateString = item.deadline;
    // if (!/\d{4}/.test(dateString)) dateString = `${dateString} ${new Date().getFullYear()}`;
    // const d = new Date(dateString);
    
    function parseDeadline(deadline) {
      if (!deadline) return null;
      let dateString = deadline;
      if (!/\d{4}/.test(dateString)) {
        dateString = `${dateString} ${new Date().getFullYear()}`;
      }
      const d = new Date(dateString);
      return isNaN(d.getTime()) ? null : d.getTime();
    }

    const currentYear = new Date().getFullYear();
    const resultMs = parseDeadline('September 5');
    const resultDate = new Date(resultMs);
    
    expect(resultDate.getFullYear()).toBe(currentYear);
    expect(resultDate.getMonth()).toBe(8); // September is 8 (0-indexed)
    expect(resultDate.getDate()).toBe(5);
  });

  it('prevents duplicate tasks based on sourceResourceId and title', () => {
    // The logic in App.jsx:
    // const existingSourceTaskIds = new Set(tasks.filter(t => t.sourceResourceId === resourceId).map(t => t.title.trim().toLowerCase()));
    
    const existingTasks = [
      { id: '1', title: 'Submit DBMS assignment', sourceResourceId: 'res123' },
      { id: '2', title: 'Read chapter 4', sourceResourceId: 'res999' }
    ];
    
    const resourceId = 'res123';
    const actionItems = [
      { title: 'Submit DBMS assignment' },
      { title: 'Complete report' }
    ];

    const existingSourceTaskIds = new Set(
      existingTasks
        .filter(t => t.sourceResourceId === resourceId)
        .map(t => t.title.trim().toLowerCase())
    );

    const newTasksToCreate = actionItems.filter(item => {
      const titleKey = item.title.trim().toLowerCase();
      return !existingSourceTaskIds.has(titleKey);
    });

    expect(newTasksToCreate.length).toBe(1);
    expect(newTasksToCreate[0].title).toBe('Complete report');
  });
});
