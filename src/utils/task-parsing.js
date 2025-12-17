/**
 * Извлечь Jira issue key из текста
 */
export function extractJiraKey(text) {
  const match = text.match(/\b([A-Z]+-\d+)\b/);
  return match ? match[1] : null;
}

/**
 * Извлечь дату из текста
 */
export function extractDueDate(text) {
  const match = text.match(/@([a-zа-яё]+)/i);
  if (!match) {
    return null;
  }
  const keyword = match[1].toLowerCase();
  const dateMap = {
    today: 'today',
    tomorrow: 'tomorrow',
    thisweek: 'thisweek',
    nextweek: 'nextweek',
    later: 'later',
    forgotten: 'forgotten',
    сегодня: 'today',
    завтра: 'tomorrow',
    этанеделя: 'thisweek',
    следнеделя: 'nextweek',
    позже: 'later',
    позднее: 'later',
    забыто: 'forgotten',
  };
  const normalizedKey = dateMap[keyword];
  if (!normalizedKey) {
    return null;
  }
  return parseDateKeyword(normalizedKey);
}

/**
 * Преобразовать ключевое слово в дату
 */
export function parseDateKeyword(keyword) {
  const now = new Date();
  const labels = {
    today: 'Сегодня',
    tomorrow: 'Завтра',
    thisweek: 'Эта неделя',
    nextweek: 'След.неделя',
    later: 'Позже',
    forgotten: 'Забыто',
  };
  let targetDate = new Date(now);
  let startDate = null;
  switch (keyword) {
    case 'today':
      break;
    case 'tomorrow':
      targetDate.setDate(now.getDate() + 1);
      break;
    case 'thisweek':
      startDate = new Date(now);
      targetDate.setDate(now.getDate() + (7 - now.getDay()));
      break;
    case 'nextweek':
      startDate = new Date(now);
      startDate.setDate(now.getDate() + (7 - now.getDay()) + 1);
      targetDate.setDate(now.getDate() + (14 - now.getDay()));
      break;
    case 'later':
      targetDate.setDate(now.getDate() + 30);
      break;
    case 'forgotten':
      targetDate.setDate(now.getDate() - 365);
      break;
    default:
      return null;
  }
  return {
    date: targetDate.toISOString().split('T')[0],
    label: labels[keyword],
    startDate: startDate ? startDate.toISOString().split('T')[0] : null,
    type: keyword,
  };
}

/**
 * Загрузить данные задачи из Jira API
 */
export async function fetchJiraIssue(issueKey) {
  try {
    const response = await fetch(`https://jira.theteamsoft.com/rest/api/2/issue/${issueKey}?fields=summary`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (data.errorMessages || data.errors) {
      return { error: true };
    }
    return {
      key: data.key,
      summary: data.fields.summary,
      url: `https://jira.theteamsoft.com/browse/${data.key}`,
    };
  } catch (err) {
    console.error('tpm: Ошибка загрузки Jira issue:', err);
    return { error: true };
  }
}

