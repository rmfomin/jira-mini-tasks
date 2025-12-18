import { main } from './bootstrap.js';
import { initJiraPageIntegration } from './jira-page-integration.js';

// ESM по умолчанию в strict mode

// Определяем, на какой странице мы находимся
const currentPath = window.location.pathname;

// Проверяем, что это страница просмотра конкретной задачи (например, /browse/UI-5788)
const isIssuePage = /^\/browse\/[A-Z]+-\d+/.test(currentPath);

if (isIssuePage) {
  // Страница просмотра задачи - только интеграция
  initJiraPageIntegration();
} else if (currentPath.startsWith('/secure/')) {
  // Dashboard - туду-лист + интеграция
  main();
  initJiraPageIntegration();
}

