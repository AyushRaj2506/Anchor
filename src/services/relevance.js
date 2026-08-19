/**
 * Relevance filtering algorithm for grounded AI search.
 * Norms and scores resources and tasks based on keyword matches.
 * 
 * @param {string} queryText - The user question
 * @param {Array} resources - User's resources from state
 * @param {Array} tasks - User's tasks from state
 * @returns {Object} Top matching resources and tasks
 */
export function searchKnowledge(queryText, resources = [], tasks = []) {
  if (!queryText || typeof queryText !== 'string') {
    return { resources: [], tasks: [] };
  }

  // Tokenize query into lowercase keywords
  const queryTokens = queryText
    .toLowerCase()
    .replace(/[?.!,;]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2); // Exclude very short words like 'a', 'to', 'in', 'my'

  // Fallback to split word check if user asks a very short question
  const tokensToUse = queryTokens.length > 0 
    ? queryTokens 
    : queryText.toLowerCase().split(/\s+/).filter(Boolean);

  if (tokensToUse.length === 0) {
    return { resources: [], tasks: [] };
  }

  // Score resources
  const scoredResources = resources.map(res => {
    let score = 0;
    
    // Original metadata
    const titleText = (res.title || '').toLowerCase();
    const descText = (res.description || res.notes || '').toLowerCase();
    const catText = (res.category || '').toLowerCase();
    const tagsText = (res.tags || []).join(' ').toLowerCase();
    
    // AI analysis metadata
    const aiSumText = (res.aiSummary || '').toLowerCase();
    const aiImportantText = (res.aiImportantInformation || []).join(' ').toLowerCase();
    const aiCatText = (res.aiCategory || '').toLowerCase();
    const aiTagsText = (res.aiTags || []).join(' ').toLowerCase();

    tokensToUse.forEach(token => {
      // Matches on original fields
      if (titleText.includes(token)) score += 10;
      if (descText.includes(token)) score += 3;
      if (catText.includes(token)) score += 5;
      if (tagsText.includes(token)) score += 4;
      
      // Matches on AI enriched fields
      if (aiSumText.includes(token)) score += 3;
      if (aiImportantText.includes(token)) score += 3;
      if (aiCatText.includes(token)) score += 5;
      if (aiTagsText.includes(token)) score += 4;
    });

    return { resource: res, score };
  })
  .filter(item => item.score > 0)
  .sort((a, b) => b.score - a.score)
  .map(item => item.resource);

  // Score tasks
  const scoredTasks = tasks.map(task => {
    let score = 0;
    const titleText = (task.title || '').toLowerCase();
    const descText = (task.description || '').toLowerCase();
    const catText = (task.category || '').toLowerCase();
    const priorityText = (task.priority || '').toLowerCase();
    const statusText = (task.status || '').toLowerCase();

    tokensToUse.forEach(token => {
      if (titleText.includes(token)) score += 10;
      if (descText.includes(token)) score += 3;
      if (catText.includes(token)) score += 5;
      if (priorityText.includes(token)) score += 2;
      if (statusText.includes(token)) score += 2;
    });

    return { task, score };
  })
  .filter(item => item.score > 0)
  .sort((a, b) => b.score - a.score)
  .map(item => item.task);

  return {
    // Context Limit: send top 8 results to Gemini
    resources: scoredResources.slice(0, 8),
    tasks: scoredTasks.slice(0, 8)
  };
}
