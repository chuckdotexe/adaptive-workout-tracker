(() => {
  const button = document.getElementById('repair');
  const status = document.getElementById('status');
  if (!button || !status) return;

  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'Removing outdated app files…';

    try {
      const appScope = new URL('./', window.location.href).href;
      let workers = 0;
      let cachesCleared = 0;

      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          if (registration.scope === appScope && await registration.unregister()) workers++;
        }
      }

      if ('caches' in window) {
        const names = await window.caches.keys();
        for (const name of names) {
          if (name.startsWith('workout-') && await window.caches.delete(name)) cachesCleared++;
        }
      }

      status.textContent = `Cleared ${cachesCleared} app cache(s) and ${workers} background worker(s). Your saved workouts and GitHub token were not touched. Reloading…`;
      setTimeout(() => window.location.replace(`./?cache-repaired=${Date.now()}`), 400);
    } catch (error) {
      status.textContent = `Could not complete recovery: ${error.message}. You can try again.`;
      button.disabled = false;
    }
  });
})();
