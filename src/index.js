import { main } from './pages/dashboard/bootstrap.js';
import { initJiraPageIntegration } from './pages/browse/index.js';

const currentPath = window.location.pathname;

const isIssuePage = /^\/browse\/[A-Z]+-\d+/.test(currentPath);

if (isIssuePage) {
  initJiraPageIntegration();
} else if (currentPath.startsWith('/secure/')) {
  main();
  initJiraPageIntegration();
}

