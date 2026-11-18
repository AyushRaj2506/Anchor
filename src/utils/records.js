const string = (value, fallback = '') => typeof value === 'string' ? value : fallback;
const strings = value => (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
  .filter(item => typeof item === 'string' && item.trim()).map(item => item.trim());
const actions = value => Array.isArray(value) ? value.filter(item => typeof item === 'string'
  || item && typeof item.title === 'string').map(item => typeof item === 'string' ? item : {
  ...item, description: string(item.description), deadline: string(item.deadline) || null,
  ...('sourceText' in item ? { sourceText: string(item.sourceText) || null } : {}),
}) : [];

export function resourceRecord(data, id) {
  return {
    ...data, id, title: string(data.title, 'Untitled resource'), category: string(data.category, 'Uncategorized'),
    type: string(data.type, 'Document'), tags: strings(data.tags), aiTags: strings(data.aiTags),
    description: string(data.description), notes: string(data.notes), content: string(data.content),
    contentText: string(data.contentText), aiSummary: string(data.aiSummary),
    aiCategory: string(data.aiCategory), aiDeadline: string(data.aiDeadline),
    sourceUrl: string(data.sourceUrl), url: string(data.url),
    fileName: string(data.fileName), fileType: string(data.fileType),
    fileSize: typeof data.fileSize === 'number' ? data.fileSize : string(data.fileSize),
    emailSender: string(data.emailSender), emailSubject: string(data.emailSubject),
    aiImportantInformation: strings(data.aiImportantInformation), aiActionItems: actions(data.aiActionItems),
    deadlines: actions(data.deadlines).filter(item => typeof item === 'object'),
  };
}

export function taskRecord(data, id) {
  return {
    ...data, id, title: string(data.title, 'Untitled task'), description: string(data.description),
    category: string(data.category, 'General'), deadline: string(data.deadline, 'No deadline'), completedOn: string(data.completedOn),
    status: ['todo', 'inprogress', 'completed'].includes(data.status) ? data.status : 'todo',
    priority: ['High', 'Medium', 'Low'].includes(data.priority) ? data.priority : 'Medium',
    deadlineMs: Number.isFinite(data.deadlineMs) ? data.deadlineMs : null,
  };
}
