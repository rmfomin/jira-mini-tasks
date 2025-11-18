/**
 * Обертка для запросов к Jira REST API
 */
export function jiraRequest({ method = 'GET', url, body = null, message = null }) {
  if (!url) {
    console.error('tpm:error', 'URL is required');
    return Promise.resolve(null);
  }

  return fetch(url, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : null,
  })
    .then(async (res) => {
      const text = await res.text();

      if (!res.ok) {
        console.error('tpm:error', res.status, text);
        return null;
      }

      let json = null;
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.warn('tpm: not JSON', text);
        return text;
      }

      if (message) {
        console.log(`tpm message: ${message}`);
      }

      console.log('tpm: json =', json);

      return json;
    })
    .catch((err) => {
      console.error('tpm:error', err);
      return null;
    });
}

