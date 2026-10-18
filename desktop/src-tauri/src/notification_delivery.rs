//! Per-socket notification queues. Media snapshots may be dropped when a phone lags;
//! notifications must not share that bounded broadcast channel.

use serde::Serialize;
use std::collections::{HashMap, HashSet};
use tokio::sync::{Mutex, broadcast, mpsc};
use uuid::Uuid;

pub struct NotificationDelivery {
    clients: Mutex<HashMap<Uuid, mpsc::UnboundedSender<String>>>,
    acknowledgements: broadcast::Sender<(Uuid, String)>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestResult {
    pub connected: usize,
    pub acknowledged: usize,
}

impl Default for NotificationDelivery {
    fn default() -> Self {
        let (acknowledgements, _) = broadcast::channel(128);
        Self {
            clients: Mutex::new(HashMap::new()),
            acknowledgements,
        }
    }
}

impl NotificationDelivery {
    pub async fn register(&self) -> (Uuid, mpsc::UnboundedReceiver<String>) {
        let (sender, receiver) = mpsc::unbounded_channel();
        let id = Uuid::new_v4();
        self.clients.lock().await.insert(id, sender);
        (id, receiver)
    }

    pub async fn unregister(&self, id: Uuid) {
        self.clients.lock().await.remove(&id);
    }

    pub async fn send_all(&self, message: &str) -> HashSet<Uuid> {
        let mut clients = self.clients.lock().await;
        clients.retain(|_, sender| !sender.is_closed());
        clients
            .iter()
            .filter_map(|(id, sender)| sender.send(message.to_owned()).ok().map(|_| *id))
            .collect()
    }

    pub fn acknowledge(&self, client: Uuid, notification_id: String) {
        let _ = self.acknowledgements.send((client, notification_id));
    }

    pub async fn send_test(&self, notification_id: &str, message: &str) -> TestResult {
        let mut acknowledgements = self.acknowledgements.subscribe();
        let recipients = self.send_all(message).await;
        let connected = recipients.len();
        let mut confirmed = HashSet::new();
        let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(4);
        while confirmed.len() < connected {
            let Ok(Ok((client, id))) =
                tokio::time::timeout_at(deadline, acknowledgements.recv()).await
            else {
                break;
            };
            if id == notification_id && recipients.contains(&client) {
                confirmed.insert(client);
            }
        }
        TestResult {
            connected,
            acknowledged: confirmed.len(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn every_registered_phone_gets_the_same_notification() {
        let delivery = NotificationDelivery::default();
        let (first_id, mut first) = delivery.register().await;
        let (second_id, mut second) = delivery.register().await;
        let recipients = delivery.send_all("message").await;
        assert_eq!(recipients, HashSet::from([first_id, second_id]));
        assert_eq!(first.recv().await.as_deref(), Some("message"));
        assert_eq!(second.recv().await.as_deref(), Some("message"));
        delivery.unregister(first_id).await;
        assert_eq!(delivery.send_all("next").await.len(), 1);
    }

    #[tokio::test]
    async fn test_counts_distinct_phone_acknowledgements() {
        let delivery = std::sync::Arc::new(NotificationDelivery::default());
        let (first_id, mut first) = delivery.register().await;
        let (second_id, mut second) = delivery.register().await;
        let sender = delivery.clone();
        let result = tokio::spawn(async move { sender.send_test("test-id", "test").await });
        assert_eq!(first.recv().await.as_deref(), Some("test"));
        assert_eq!(second.recv().await.as_deref(), Some("test"));
        delivery.acknowledge(first_id, "test-id".into());
        delivery.acknowledge(first_id, "test-id".into());
        delivery.acknowledge(second_id, "test-id".into());
        let result = result.await.unwrap();
        assert_eq!(result.connected, 2);
        assert_eq!(result.acknowledged, 2);
    }
}
