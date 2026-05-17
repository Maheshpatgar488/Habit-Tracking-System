self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    console.log('Push event received:', data);

    const options = {
      body: data.body,
      icon: data.icon || '/vite.svg',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '1'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } else {
    console.log('Push event received but no data');
  }
});

self.addEventListener('notificationclick', function(event) {
  console.log('Notification click received.');

  event.notification.close();

  event.waitUntil(
    clients.openWindow('/user')
  );
});
