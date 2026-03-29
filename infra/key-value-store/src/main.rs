use std::collections::HashMap;
use std::io::{self, BufRead, Write};

/// In-memory key-value store (starter — add persistence next).
pub struct KvStore {
    data: HashMap<String, String>,
}

impl KvStore {
    fn new() -> Self {
        Self { data: HashMap::new() }
    }

    fn get(&self, key: &str) -> Option<&String> {
        self.data.get(key)
    }

    fn set(&mut self, key: String, value: String) {
        self.data.insert(key, value);
    }

    fn delete(&mut self, key: &str) -> bool {
        self.data.remove(key).is_some()
    }
}

fn main() {
    let mut store = KvStore::new();
    let stdin = io::stdin();
    print!("kvstore> ");
    io::stdout().flush().unwrap();

    for line in stdin.lock().lines() {
        let line = line.unwrap();
        let parts: Vec<&str> = line.trim().splitn(3, ' ').collect();
        match parts.as_slice() {
            ["get", key] => match store.get(key) {
                Some(v) => println!("{v}"),
                None => println!("(nil)"),
            },
            ["set", key, value] => {
                store.set(key.to_string(), value.to_string());
                println!("OK");
            }
            ["del", key] => {
                if store.delete(key) { println!("OK") } else { println!("(nil)") }
            }
            ["quit"] | ["exit"] => break,
            _ => println!("Commands: get <key>, set <key> <value>, del <key>, quit"),
        }
        print!("kvstore> ");
        io::stdout().flush().unwrap();
    }
}

#[cfg(test)]
mod tests {
    use super::KvStore;

    // ========================================================================
    // set / get
    // ========================================================================

    #[test]
    fn set_and_get_basic() {
        let mut store = KvStore::new();
        store.set("name".into(), "Alice".into());
        assert_eq!(store.get("name"), Some(&"Alice".to_string()));
    }

    #[test]
    fn get_missing_key_returns_none() {
        let store = KvStore::new();
        assert_eq!(store.get("missing"), None);
    }

    #[test]
    fn set_overwrites_existing_value() {
        let mut store = KvStore::new();
        store.set("key".into(), "first".into());
        store.set("key".into(), "second".into());
        assert_eq!(store.get("key"), Some(&"second".to_string()));
    }

    #[test]
    fn set_multiple_independent_keys() {
        let mut store = KvStore::new();
        store.set("a".into(), "1".into());
        store.set("b".into(), "2".into());
        store.set("c".into(), "3".into());
        assert_eq!(store.get("a"), Some(&"1".to_string()));
        assert_eq!(store.get("b"), Some(&"2".to_string()));
        assert_eq!(store.get("c"), Some(&"3".to_string()));
    }

    #[test]
    fn set_empty_string_value() {
        let mut store = KvStore::new();
        store.set("key".into(), "".into());
        assert_eq!(store.get("key"), Some(&"".to_string()));
    }

    #[test]
    fn set_empty_string_key() {
        let mut store = KvStore::new();
        store.set("".into(), "value".into());
        assert_eq!(store.get(""), Some(&"value".to_string()));
    }

    #[test]
    fn set_value_with_spaces() {
        let mut store = KvStore::new();
        store.set("greeting".into(), "hello world".into());
        assert_eq!(store.get("greeting"), Some(&"hello world".to_string()));
    }

    #[test]
    fn set_unicode_value() {
        let mut store = KvStore::new();
        store.set("lang".into(), "日本語".into());
        assert_eq!(store.get("lang"), Some(&"日本語".to_string()));
    }

    // ========================================================================
    // delete
    // ========================================================================

    #[test]
    fn delete_existing_key_returns_true() {
        let mut store = KvStore::new();
        store.set("key".into(), "val".into());
        assert!(store.delete("key"));
    }

    #[test]
    fn delete_missing_key_returns_false() {
        let mut store = KvStore::new();
        assert!(!store.delete("nonexistent"));
    }

    #[test]
    fn delete_removes_value() {
        let mut store = KvStore::new();
        store.set("key".into(), "val".into());
        store.delete("key");
        assert_eq!(store.get("key"), None);
    }

    #[test]
    fn delete_does_not_affect_other_keys() {
        let mut store = KvStore::new();
        store.set("a".into(), "1".into());
        store.set("b".into(), "2".into());
        store.delete("a");
        assert_eq!(store.get("a"), None);
        assert_eq!(store.get("b"), Some(&"2".to_string()));
    }

    #[test]
    fn delete_twice_returns_false_second_time() {
        let mut store = KvStore::new();
        store.set("key".into(), "val".into());
        assert!(store.delete("key"));
        assert!(!store.delete("key"));
    }

    // ========================================================================
    // CRUD sequence
    // ========================================================================

    #[test]
    fn set_delete_set_get_cycle() {
        let mut store = KvStore::new();
        store.set("x".into(), "original".into());
        store.delete("x");
        store.set("x".into(), "new".into());
        assert_eq!(store.get("x"), Some(&"new".to_string()));
    }

    #[test]
    fn large_number_of_keys() {
        let mut store = KvStore::new();
        for i in 0..1000 {
            store.set(format!("key{i}"), format!("val{i}"));
        }
        for i in 0..1000 {
            assert_eq!(store.get(&format!("key{i}")), Some(&format!("val{i}")));
        }
    }

    #[test]
    fn delete_all_keys_one_by_one() {
        let mut store = KvStore::new();
        let keys = ["alpha", "beta", "gamma"];
        for k in &keys {
            store.set(k.to_string(), "v".into());
        }
        for k in &keys {
            assert!(store.delete(k));
            assert_eq!(store.get(k), None);
        }
    }

    // ========================================================================
    // Edge cases
    // ========================================================================

    #[test]
    fn key_with_special_chars() {
        let mut store = KvStore::new();
        store.set("user:1:name".into(), "Alice".into());
        assert_eq!(store.get("user:1:name"), Some(&"Alice".to_string()));
    }

    #[test]
    fn numeric_string_values() {
        let mut store = KvStore::new();
        store.set("count".into(), "42".into());
        let val = store.get("count").unwrap();
        let n: u32 = val.parse().unwrap();
        assert_eq!(n, 42);
    }

    #[test]
    fn overwrite_preserves_other_keys() {
        let mut store = KvStore::new();
        store.set("a".into(), "1".into());
        store.set("b".into(), "2".into());
        store.set("a".into(), "99".into());
        assert_eq!(store.get("b"), Some(&"2".to_string()));
        assert_eq!(store.get("a"), Some(&"99".to_string()));
    }

    #[test]
    fn new_store_is_empty() {
        let store = KvStore::new();
        assert_eq!(store.get("anything"), None);
    }
}
