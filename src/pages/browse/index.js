import { refreshTaskDisplay } from './task-display.js';
import { startPageMarkerObserver } from './markers.js';

/**
 * Добавляет информацию о задаче из хранилища на страницу Jira
 */
function injectTaskInfo() {
  const issueKey = getIssueKeyFromUrl();
  if (!issueKey) {
    return;
  }

  const stalker = document.querySelector('#stalker');
  const pageHeader = stalker ? stalker.querySelector('.aui-page-header') : document.querySelector('.aui-page-header');
  if (!pageHeader) {
    return;
  }

  if (document.querySelector('#tm-jira-task-info') ||
      document.querySelector('#tm-jira-task-form') ||
      document.querySelector('#tm-jira-add-task')) {
    return;
  }

  refreshTaskDisplay();
}

/**
 * Извлекает issue key из URL
 */
function getIssueKeyFromUrl() {
  const match = window.location.pathname.match(/\/browse\/([A-Z]+-\d+)/);
  return match ? match[1] : null;
}

/**
 * Точка входа для интеграции со страницей просмотра задачи
 */
export function initJiraPageIntegration() {
  injectTaskInfo();

  const observer = new MutationObserver(() => {
    injectTaskInfo();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      const oldBlock = document.querySelector('#tm-jira-task-info');
      const oldForm = document.querySelector('#tm-jira-task-form');
      const oldButton = document.querySelector('#tm-jira-add-task');

      if (oldBlock) oldBlock.remove();
      if (oldForm) oldForm.remove();
      if (oldButton) oldButton.remove();

      setTimeout(injectTaskInfo, 100);
    }
  }).observe(document, { subtree: true, childList: true });

  startPageMarkerObserver();
}

