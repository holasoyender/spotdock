pub const AUTO: &str = "auto";
pub const ENGLISH: &str = "en-US";
pub const SPANISH: &str = "es-ES";

pub fn valid_preference(value: &str) -> bool {
    matches!(value, AUTO | ENGLISH | SPANISH)
}

pub fn resolve(preference: &str, system: &str) -> &'static str {
    let spanish_system = system.eq_ignore_ascii_case("es")
        || system.to_ascii_lowercase().starts_with("es-")
        || system.to_ascii_lowercase().starts_with("es_");
    match preference {
        SPANISH => SPANISH,
        ENGLISH => ENGLISH,
        _ if spanish_system => SPANISH,
        _ => ENGLISH,
    }
}

#[cfg(windows)]
pub fn system_locale() -> String {
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn GetUserPreferredUILanguages(
            flags: u32,
            language_count: *mut u32,
            languages: *mut u16,
            buffer_length: *mut u32,
        ) -> i32;
    }

    let mut count = 0u32;
    let mut length = 0u32;
    // Passing zero flags requests BCP 47 language names in preference order.
    let measured =
        unsafe { GetUserPreferredUILanguages(0, &mut count, std::ptr::null_mut(), &mut length) };
    if measured == 0 || length == 0 {
        return ENGLISH.into();
    }
    let mut buffer = vec![0u16; length as usize];
    let read =
        unsafe { GetUserPreferredUILanguages(0, &mut count, buffer.as_mut_ptr(), &mut length) };
    if read == 0 {
        return ENGLISH.into();
    }
    buffer
        .split(|unit| *unit == 0)
        .take_while(|language| !language.is_empty())
        .map(String::from_utf16_lossy)
        .find(|language| {
            language.eq_ignore_ascii_case("es")
                || language.to_ascii_lowercase().starts_with("es-")
                || language.eq_ignore_ascii_case("en")
                || language.to_ascii_lowercase().starts_with("en-")
        })
        .unwrap_or_else(|| ENGLISH.into())
}

#[cfg(not(windows))]
pub fn system_locale() -> String {
    ["LC_ALL", "LC_MESSAGES", "LANG"]
        .into_iter()
        .filter_map(|key| std::env::var(key).ok())
        .find(|value| !value.is_empty())
        .unwrap_or_else(|| ENGLISH.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_spanish_and_falls_back_to_english() {
        assert_eq!(resolve(AUTO, "es-ES"), SPANISH);
        assert_eq!(resolve(AUTO, "es-MX"), SPANISH);
        assert_eq!(resolve(AUTO, "fr-FR"), ENGLISH);
        assert_eq!(resolve(ENGLISH, "es-ES"), ENGLISH);
        assert_eq!(resolve(SPANISH, "fr-FR"), SPANISH);
    }

    #[cfg(windows)]
    #[test]
    fn reads_windows_preferred_ui_language() {
        assert!(!system_locale().is_empty());
    }
}
