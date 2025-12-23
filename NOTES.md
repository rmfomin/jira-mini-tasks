// Панель API
// const apiBar = el('div', { className: 'tm-api-bar' });
// apiBar.style.display = 'flex';
// apiBar.style.gap = '8px';
// apiBar.style.margin = '6px 0 10px';

// const btnSearchMy = el('button', { type: 'button', text: 'API: Мои задачи' });
// btnSearchMy.style.padding = '4px 8px';
// btnSearchMy.style.border = '1px solid #3572b0';
// btnSearchMy.style.borderRadius = '6px';
// btnSearchMy.style.background = '#e8f2fd';
// btnSearchMy.style.cursor = 'pointer';
// btnSearchMy.addEventListener('click', () => {
// jiraRequest({
// method: 'POST',
// url: 'https://jira.theteamsoft.com/rest/api/2/search',
// body: {
// jql: 'assignee = currentUser() ORDER BY created DESC',
// maxResults: 10,
// fields: ['key', 'summary', 'status'],
// },
// message: 'tpm: +++ search my issues',
// });
// });

// const btnServerInfo = el('button', { type: 'button', text: 'API: ServerInfo' });
// btnServerInfo.style.padding = '4px 8px';
// btnServerInfo.style.border = '1px solid #3572b0';
// btnServerInfo.style.borderRadius = '6px';
// btnServerInfo.style.background = '#e8f2fd';
// btnServerInfo.style.cursor = 'pointer';
// btnServerInfo.addEventListener('click', () => {
// jiraRequest({ method: 'GET', url: 'https://jira.theteamsoft.com/rest/api/2/serverInfo', message: 'tpm: +++ serverInfo' });
// });

// apiBar.appendChild(btnSearchMy);
// apiBar.appendChild(btnServerInfo);

// Вставка в root
// root.appendChild(apiBar);
