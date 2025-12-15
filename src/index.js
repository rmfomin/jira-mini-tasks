import { main } from './bootstrap.js';
import { initJiraPageIntegration } from './jira-page-integration.js';

// ESM по умолчанию в strict mode

// Определяем, на какой странице мы находимся
const currentPath = window.location.pathname;

if (currentPath.startsWith('/browse/')) {
  // Страница просмотра задачи
  initJiraPageIntegration();
} else if (currentPath.startsWith('/secure/')) {
  // Dashboard
  main();
}

