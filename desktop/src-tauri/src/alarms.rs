use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use uuid::Uuid;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Alarm {
    pub id: String,
    pub time: String,
    pub days: Vec<u8>,
    pub title: String,
    pub message: String,
    pub enabled: bool,
    pub tone: String,
    pub dismiss_mode: String,
    pub snooze_minutes: u32,
    pub target_ids: Vec<String>,
    pub updated_at: i64,
    #[serde(default)]
    pub deleted: bool,
}

impl Alarm {
    pub fn validate(&self) -> Result<(), String> {
        let valid_time = self.time.split_once(':').is_some_and(|(hour, minute)| {
            hour.len() == 2
                && minute.len() == 2
                && hour.parse::<u8>().is_ok_and(|value| value < 24)
                && minute.parse::<u8>().is_ok_and(|value| value < 60)
        });
        if Uuid::parse_str(&self.id).is_err()
            || !valid_time
            || self.days.is_empty()
            || self.days.len() > 7
            || self.days.iter().any(|day| *day > 6)
            || self.days.iter().collect::<HashSet<_>>().len() != self.days.len()
            || self.title.chars().count() > 80
            || self.message.chars().count() > 300
            || !["system", "classic", "gentle", "urgent"].contains(&self.tone.as_str())
            || !["tap", "slide"].contains(&self.dismiss_mode.as_str())
            || ![0, 5, 10, 15, 20, 30].contains(&self.snooze_minutes)
            || self.target_ids.len() > 32
            || self
                .target_ids
                .iter()
                .any(|id| Uuid::parse_str(id).is_err())
            || self.updated_at <= 0
        {
            return Err("Invalid alarm".into());
        }
        Ok(())
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Device {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub custom_name: bool,
}

impl Device {
    pub fn from_hello(id: String, name: String) -> Self {
        Self {
            id,
            name,
            custom_name: false,
        }
    }

    pub fn update_hello_name(&mut self, name: String) {
        if !self.custom_name {
            self.name = name;
        }
    }

    pub fn rename(&mut self, name: &str) -> Result<(), String> {
        let name = name.trim();
        if name.is_empty() || name.chars().count() > 80 || name.chars().any(char::is_control) {
            return Err("Invalid device name".into());
        }
        self.name = name.into();
        self.custom_name = true;
        Ok(())
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceStatus {
    pub id: String,
    pub name: String,
    pub connected: bool,
}

pub fn upsert(alarms: &mut Vec<Alarm>, incoming: Alarm) -> Result<bool, String> {
    incoming.validate()?;
    if let Some(old) = alarms.iter_mut().find(|alarm| alarm.id == incoming.id) {
        if old.updated_at >= incoming.updated_at {
            return Ok(false);
        }
        *old = incoming;
    } else {
        if alarms.len() >= 256 {
            return Err("Too many alarms".into());
        }
        alarms.push(incoming);
    }
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_invalid_time_and_stale_changes() {
        let mut alarm = Alarm {
            id: Uuid::new_v4().to_string(),
            time: "07:30".into(),
            days: vec![0, 2],
            title: String::new(),
            message: String::new(),
            enabled: true,
            tone: "system".into(),
            dismiss_mode: "slide".into(),
            snooze_minutes: 10,
            target_ids: vec![],
            updated_at: 1,
            deleted: false,
        };
        let mut list = Vec::new();
        assert_eq!(upsert(&mut list, alarm.clone()).unwrap(), true);
        assert_eq!(upsert(&mut list, alarm.clone()).unwrap(), false);
        alarm.time = "25:00".into();
        assert!(alarm.validate().is_err());
    }

    #[test]
    fn custom_name_survives_reconnection_and_old_devices_still_load() {
        let id = Uuid::new_v4().to_string();
        let mut device: Device = serde_json::from_value(serde_json::json!({
            "id": id, "name": "Android"
        }))
        .unwrap();
        assert!(!device.custom_name);
        device.update_hello_name("Pixel".into());
        assert_eq!(device.name, "Pixel");
        device.rename("  Bedroom dock  ").unwrap();
        device.update_hello_name("Another model".into());
        assert_eq!(device.name, "Bedroom dock");
        assert!(device.custom_name);
        assert!(device.rename("  ").is_err());
    }
}
