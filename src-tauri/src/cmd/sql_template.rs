use std::collections::{BTreeMap, BTreeSet};

use minijinja::{AutoEscape, Environment, UndefinedBehavior, Value};
use serde::{Deserialize, Serialize};
use serde_yaml::Value as YamlValue;

/// Soft limit: frontend may ask for confirmation above this.
#[allow(dead_code)]
pub const SOFT_EXPAND_LIMIT: usize = 20;
/// Hard limit: expand fails above this.
pub const HARD_EXPAND_LIMIT: usize = 50;

const VARS_MARKER: &str = "@vars";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeSqlTemplateResult {
  pub has_template: bool,
  pub placeholders: Vec<String>,
  pub provided: BTreeMap<String, Vec<String>>,
  pub missing: Vec<String>,
  pub template_body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpandedStatement {
  pub sql: String,
  pub binding: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpandSqlTemplateResult {
  pub statements: Vec<ExpandedStatement>,
}

/// Leading block comment that contains `@vars`, with YAML after the marker line.
fn split_vars_block(sql: &str) -> Result<(BTreeMap<String, Vec<String>>, String), String> {
  let trimmed = sql.trim_start();
  let lead_ws_len = sql.len() - trimmed.len();
  let lead_ws = &sql[..lead_ws_len];

  if !trimmed.starts_with("/*") {
    return Ok((BTreeMap::new(), sql.to_string()));
  }

  let after_open = &trimmed[2..];
  let Some(close_rel) = after_open.find("*/") else {
    return Ok((BTreeMap::new(), sql.to_string()));
  };
  let comment_body = &after_open[..close_rel];
  let after_comment = &after_open[close_rel + 2..];

  let marker_pos = match comment_body.find(VARS_MARKER) {
    Some(p) => p,
    None => return Ok((BTreeMap::new(), sql.to_string())),
  };

  // YAML starts after the line that contains `@vars`.
  let after_marker = &comment_body[marker_pos + VARS_MARKER.len()..];
  let yaml_src = if let Some(nl) = after_marker.find('\n') {
    after_marker[nl + 1..].trim()
  } else {
    after_marker.trim()
  };

  let provided = if yaml_src.is_empty() {
    BTreeMap::new()
  } else {
    parse_vars_yaml(yaml_src)?
  };

  let template_body = format!("{}{}", lead_ws, after_comment.trim_start());
  Ok((provided, template_body))
}

fn parse_vars_yaml(src: &str) -> Result<BTreeMap<String, Vec<String>>, String> {
  let root: YamlValue =
    serde_yaml::from_str(src).map_err(|e| format!("Invalid @vars YAML: {e}"))?;

  let map = root.as_mapping().ok_or_else(|| {
    "Invalid @vars YAML: root must be a mapping of variable names to values".to_string()
  })?;

  let mut out = BTreeMap::new();
  for (k, v) in map {
    let key = k
      .as_str()
      .ok_or_else(|| "Invalid @vars YAML: keys must be strings".to_string())?
      .to_string();
    if !is_ident(&key) {
      return Err(format!(
        "Invalid @vars key '{key}': use a simple identifier (letters, digits, underscore)"
      ));
    }
    let values = yaml_value_to_strings(&key, v)?;
    if values.is_empty() {
      return Err(format!("@vars '{key}' must not be an empty list"));
    }
    out.insert(key, values);
  }
  Ok(out)
}

fn yaml_value_to_strings(key: &str, v: &YamlValue) -> Result<Vec<String>, String> {
  match v {
    YamlValue::String(s) => Ok(vec![s.clone()]),
    YamlValue::Number(n) => Ok(vec![n.to_string()]),
    YamlValue::Bool(b) => Ok(vec![b.to_string()]),
    YamlValue::Null => Err(format!("@vars '{key}' must not be null")),
    YamlValue::Sequence(seq) => {
      let mut items = Vec::with_capacity(seq.len());
      for (i, item) in seq.iter().enumerate() {
        match item {
          YamlValue::String(s) => {
            if !s.is_empty() {
              items.push(s.clone());
            }
          }
          YamlValue::Number(n) => items.push(n.to_string()),
          YamlValue::Bool(b) => items.push(b.to_string()),
          YamlValue::Null => {
            return Err(format!("@vars '{key}'[{i}] must not be null"));
          }
          _ => {
            return Err(format!(
              "@vars '{key}'[{i}] must be a scalar (string/number/bool)"
            ));
          }
        }
      }
      Ok(items)
    }
    YamlValue::Mapping(_) | YamlValue::Tagged(_) => Err(format!(
      "@vars '{key}' must be a scalar or a list of scalars (no nested maps)"
    )),
  }
}

fn is_ident(s: &str) -> bool {
  let mut chars = s.chars();
  match chars.next() {
    Some(c) if c == '_' || c.is_ascii_alphabetic() => {}
    _ => return false,
  }
  chars.all(|c| c == '_' || c.is_ascii_alphanumeric())
}

/// Reject control-flow / comments so v1 stays variable-interpolation only.
fn reject_control_flow(template: &str) -> Result<(), String> {
  if template.contains("{%") {
    return Err(
      "SQL templates support Jinja variable interpolation ({{ name }}) only; \
       control tags ({% ... %}) are not enabled"
        .to_string(),
    );
  }
  if template.contains("{#") {
    return Err(
      "SQL templates support Jinja variable interpolation ({{ name }}) only; \
       comments ({# ... #}) are not enabled"
        .to_string(),
    );
  }
  Ok(())
}

fn extract_placeholders(template: &str) -> Result<Vec<String>, String> {
  reject_control_flow(template)?;

  let mut names = BTreeSet::new();
  let bytes = template.as_bytes();
  let mut i = 0;
  while i + 1 < bytes.len() {
    if bytes[i] == b'{' && bytes[i + 1] == b'{' {
      let start = i + 2;
      let mut j = start;
      let mut found = false;
      while j + 1 < bytes.len() {
        if bytes[j] == b'}' && bytes[j + 1] == b'}' {
          found = true;
          break;
        }
        j += 1;
      }
      if !found {
        return Err("Unclosed Jinja variable delimiter {{".to_string());
      }
      let inner = template[start..j].trim();
      if inner.is_empty() {
        return Err("Empty Jinja variable {{ }}".to_string());
      }
      if !is_ident(inner) {
        return Err(format!(
          "Unsupported Jinja expression '{{{{ {inner} }}}}': only simple variable names are allowed"
        ));
      }
      names.insert(inner.to_string());
      i = j + 2;
      continue;
    }
    i += 1;
  }

  Ok(names.into_iter().collect())
}

fn has_jinja_vars(template: &str) -> bool {
  template.contains("{{")
}

fn merge_values(
  provided: &BTreeMap<String, Vec<String>>,
  overrides: Option<&BTreeMap<String, Vec<String>>>,
) -> BTreeMap<String, Vec<String>> {
  let mut out = provided.clone();
  if let Some(ov) = overrides {
    for (k, v) in ov {
      if v.is_empty() {
        continue;
      }
      out.insert(k.clone(), v.clone());
    }
  }
  out
}

fn cartesian_product(
  keys: &[String],
  values: &BTreeMap<String, Vec<String>>,
) -> Result<Vec<BTreeMap<String, String>>, String> {
  if keys.is_empty() {
    return Ok(vec![BTreeMap::new()]);
  }

  let mut combos: Vec<BTreeMap<String, String>> = vec![BTreeMap::new()];
  for key in keys {
    let opts = values.get(key).ok_or_else(|| {
      format!("Missing value for template variable '{key}'")
    })?;
    if opts.is_empty() {
      return Err(format!("Variable '{key}' has no values"));
    }
    let mut next = Vec::with_capacity(combos.len() * opts.len());
    for base in &combos {
      for v in opts {
        let mut m = base.clone();
        m.insert(key.clone(), v.clone());
        next.push(m);
      }
    }
    combos = next;
    if combos.len() > HARD_EXPAND_LIMIT {
      return Err(format!(
        "Too many combinations ({}); limit is {HARD_EXPAND_LIMIT}",
        combos.len()
      ));
    }
  }
  Ok(combos)
}

fn make_env() -> Environment<'static> {
  let mut env = Environment::new();
  env.set_auto_escape_callback(|_| AutoEscape::None);
  env.set_undefined_behavior(UndefinedBehavior::Strict);
  env
}

fn render_one(template: &str, binding: &BTreeMap<String, String>) -> Result<String, String> {
  let env = make_env();
  let tmpl = env
    .template_from_str(template)
    .map_err(|e| format!("Invalid SQL template: {e}"))?;

  let mut ctx = BTreeMap::new();
  for (k, v) in binding {
    ctx.insert(k.as_str(), Value::from(v.as_str()));
  }

  tmpl
    .render(ctx)
    .map_err(|e| format!("Failed to expand SQL template: {e}"))
}

pub fn analyze_sql_template_inner(sql: &str) -> Result<AnalyzeSqlTemplateResult, String> {
  let (provided, template_body) = split_vars_block(sql)?;
  // Always reject control-flow tags when present (even without {{ }}).
  reject_control_flow(&template_body)?;
  let placeholders = if has_jinja_vars(&template_body) {
    extract_placeholders(&template_body)?
  } else {
    Vec::new()
  };

  let missing: Vec<String> = placeholders
    .iter()
    .filter(|p| !provided.contains_key(p.as_str()))
    .cloned()
    .collect();

  let has_template = !placeholders.is_empty() || !provided.is_empty();

  Ok(AnalyzeSqlTemplateResult {
    has_template,
    placeholders,
    provided,
    missing,
    template_body,
  })
}

pub fn expand_sql_template_inner(
  sql: &str,
  overrides: Option<&BTreeMap<String, Vec<String>>>,
) -> Result<ExpandSqlTemplateResult, String> {
  let (provided, template_body) = split_vars_block(sql)?;
  reject_control_flow(&template_body)?;
  let placeholders = if has_jinja_vars(&template_body) {
    extract_placeholders(&template_body)?
  } else {
    Vec::new()
  };

  // No template vars: return body as-is (vars block stripped if present).
  if placeholders.is_empty() {
    return Ok(ExpandSqlTemplateResult {
      statements: vec![ExpandedStatement {
        sql: template_body,
        binding: BTreeMap::new(),
      }],
    });
  }

  let merged = merge_values(&provided, overrides);
  for p in &placeholders {
    if !merged.contains_key(p) {
      return Err(format!("Missing value for template variable '{p}'"));
    }
  }

  // Only expand over placeholders used in the template (stable key order).
  let combos = cartesian_product(&placeholders, &merged)?;
  if combos.len() > HARD_EXPAND_LIMIT {
    return Err(format!(
      "Too many combinations ({}); limit is {HARD_EXPAND_LIMIT}",
      combos.len()
    ));
  }

  let mut statements = Vec::with_capacity(combos.len());
  for binding in combos {
    let sql = render_one(&template_body, &binding)?;
    statements.push(ExpandedStatement { sql, binding });
  }

  Ok(ExpandSqlTemplateResult { statements })
}

#[tauri::command]
pub async fn analyze_sql_template(sql: String) -> Result<AnalyzeSqlTemplateResult, String> {
  analyze_sql_template_inner(&sql)
}

#[tauri::command]
pub async fn expand_sql_template(
  sql: String,
  overrides: Option<BTreeMap<String, Vec<String>>>,
) -> Result<ExpandSqlTemplateResult, String> {
  expand_sql_template_inner(&sql, overrides.as_ref())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn no_template_passthrough() {
    let sql = "SELECT 1";
    let a = analyze_sql_template_inner(sql).unwrap();
    assert!(!a.has_template);
    assert!(a.placeholders.is_empty());
    let e = expand_sql_template_inner(sql, None).unwrap();
    assert_eq!(e.statements.len(), 1);
    assert_eq!(e.statements[0].sql, "SELECT 1");
  }

  #[test]
  fn vars_block_and_expand() {
    let sql = r#"/*
@vars
schema: public
table:
  - orders
  - items
*/

SELECT * FROM {{ schema }}.{{ table }}
"#;
    let a = analyze_sql_template_inner(sql).unwrap();
    assert!(a.has_template);
    assert_eq!(a.placeholders, vec!["schema".to_string(), "table".to_string()]);
    assert!(a.missing.is_empty());
    assert_eq!(a.provided.get("table").unwrap().len(), 2);

    let e = expand_sql_template_inner(sql, None).unwrap();
    assert_eq!(e.statements.len(), 2);
    assert!(e.statements[0].sql.contains("public.orders") || e.statements[0].sql.contains("public.items"));
    assert!(!e.statements[0].sql.contains("@vars"));
    assert!(!e.statements[0].sql.contains("{{"));
  }

  #[test]
  fn missing_requires_override() {
    let sql = "SELECT * FROM {{ table }}";
    let a = analyze_sql_template_inner(sql).unwrap();
    assert_eq!(a.missing, vec!["table".to_string()]);
    assert!(expand_sql_template_inner(sql, None).is_err());

    let mut ov = BTreeMap::new();
    ov.insert("table".to_string(), vec!["t1".to_string(), "t2".to_string()]);
    let e = expand_sql_template_inner(sql, Some(&ov)).unwrap();
    assert_eq!(e.statements.len(), 2);
    assert_eq!(e.statements[0].sql.trim(), "SELECT * FROM t1");
    assert_eq!(e.statements[1].sql.trim(), "SELECT * FROM t2");
  }

  #[test]
  fn rejects_control_flow() {
    let sql = "{% for t in tables %}SELECT 1{% endfor %}";
    assert!(analyze_sql_template_inner(sql).is_err());
  }

  #[test]
  fn rejects_expression() {
    let sql = "SELECT {{ a + b }}";
    assert!(analyze_sql_template_inner(sql).is_err());
  }

  #[test]
  fn override_replaces_provided() {
    let sql = r#"/*
@vars
table: old
*/
SELECT {{ table }}
"#;
    let mut ov = BTreeMap::new();
    ov.insert("table".to_string(), vec!["new".to_string()]);
    let e = expand_sql_template_inner(sql, Some(&ov)).unwrap();
    assert_eq!(e.statements[0].sql.trim(), "SELECT new");
  }
}
