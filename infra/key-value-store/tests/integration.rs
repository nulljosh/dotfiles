// Integration tests for the key-value store.
// These test the command-line interface behavior by simulating stdin/stdout
// interactions with the compiled binary.

use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Once;

static BUILD: Once = Once::new();

fn binary_path() -> PathBuf {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let bin = manifest.join("target/debug/kvstore");
    BUILD.call_once(|| {
        let status = Command::new("cargo")
            .args(["build", "--quiet"])
            .current_dir(&manifest)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .expect("failed to build kvstore");
        assert!(status.success(), "cargo build failed");
    });
    bin
}

fn run_commands(input: &str) -> String {
    let bin = binary_path();
    let mut child = Command::new(&bin)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("failed to spawn kvstore binary");

    child
        .stdin
        .as_mut()
        .unwrap()
        .write_all(input.as_bytes())
        .unwrap();

    let output = child.wait_with_output().unwrap();
    String::from_utf8(output.stdout).unwrap()
}

/// Strip the "kvstore> " prompts from output, return just the response lines.
fn response_lines(raw: &str) -> Vec<&str> {
    raw.split("kvstore> ")
        .filter(|s| !s.is_empty())
        .map(|s| s.trim())
        .collect()
}

// ============================================================================
// Basic CRUD via CLI
// ============================================================================

#[test]
fn cli_set_then_get() {
    let out = run_commands("set name Alice\nget name\nquit\n");
    let lines = response_lines(&out);
    assert_eq!(lines[0], "OK");
    assert_eq!(lines[1], "Alice");
}

#[test]
fn cli_get_missing_key() {
    let out = run_commands("get nonexistent\nquit\n");
    let lines = response_lines(&out);
    assert_eq!(lines[0], "(nil)");
}

#[test]
fn cli_set_overwrite() {
    let out = run_commands("set key first\nset key second\nget key\nquit\n");
    let lines = response_lines(&out);
    assert_eq!(lines[0], "OK");
    assert_eq!(lines[1], "OK");
    assert_eq!(lines[2], "second");
}

#[test]
fn cli_delete_existing() {
    let out = run_commands("set key val\ndel key\nget key\nquit\n");
    let lines = response_lines(&out);
    assert_eq!(lines[0], "OK");
    assert_eq!(lines[1], "OK");
    assert_eq!(lines[2], "(nil)");
}

#[test]
fn cli_delete_nonexistent() {
    let out = run_commands("del ghost\nquit\n");
    let lines = response_lines(&out);
    assert_eq!(lines[0], "(nil)");
}

#[test]
fn cli_unknown_command_shows_help() {
    let out = run_commands("badcmd\nquit\n");
    let lines = response_lines(&out);
    assert!(lines[0].contains("Commands:"));
}

#[test]
fn cli_exit_command() {
    let out = run_commands("set x 1\nexit\n");
    let lines = response_lines(&out);
    assert_eq!(lines[0], "OK");
}

// ============================================================================
// Value with spaces (splitn(3, ' ') behavior)
// ============================================================================

#[test]
fn cli_set_value_with_spaces() {
    let out = run_commands("set greeting hello world\nget greeting\nquit\n");
    let lines = response_lines(&out);
    assert_eq!(lines[0], "OK");
    assert_eq!(lines[1], "hello world");
}

// ============================================================================
// Multiple keys
// ============================================================================

#[test]
fn cli_multiple_independent_keys() {
    let out = run_commands("set a 1\nset b 2\nset c 3\nget a\nget b\nget c\nquit\n");
    let lines = response_lines(&out);
    assert_eq!(lines[0], "OK");
    assert_eq!(lines[1], "OK");
    assert_eq!(lines[2], "OK");
    assert_eq!(lines[3], "1");
    assert_eq!(lines[4], "2");
    assert_eq!(lines[5], "3");
}

#[test]
fn cli_delete_one_preserves_others() {
    let out = run_commands("set a 1\nset b 2\ndel a\nget a\nget b\nquit\n");
    let lines = response_lines(&out);
    assert_eq!(lines[3], "(nil)");
    assert_eq!(lines[4], "2");
}

// ============================================================================
// Set-delete-set cycle
// ============================================================================

#[test]
fn cli_set_delete_set_cycle() {
    let out = run_commands("set k original\ndel k\nset k new\nget k\nquit\n");
    let lines = response_lines(&out);
    assert_eq!(lines[3], "new");
}

// ============================================================================
// Edge: empty-like inputs
// ============================================================================

#[test]
fn cli_empty_line_shows_help() {
    let out = run_commands("\nquit\n");
    let lines = response_lines(&out);
    assert!(lines[0].contains("Commands:"));
}

// ============================================================================
// Numeric string values
// ============================================================================

#[test]
fn cli_numeric_string_values() {
    let out = run_commands("set count 42\nget count\nquit\n");
    let lines = response_lines(&out);
    assert_eq!(lines[1], "42");
}

// ============================================================================
// Special characters in keys
// ============================================================================

#[test]
fn cli_special_chars_in_key() {
    let out = run_commands("set user:1:name Alice\nget user:1:name\nquit\n");
    let lines = response_lines(&out);
    assert_eq!(lines[0], "OK");
    assert_eq!(lines[1], "Alice");
}

// ============================================================================
// Multiple deletes
// ============================================================================

#[test]
fn cli_double_delete() {
    let out = run_commands("set x 1\ndel x\ndel x\nquit\n");
    let lines = response_lines(&out);
    assert_eq!(lines[1], "OK");    // first del
    assert_eq!(lines[2], "(nil)"); // second del
}
