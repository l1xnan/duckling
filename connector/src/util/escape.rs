use std::fmt::{self, Write};

use once_cell::sync::Lazy;
use regex::Regex;

#[allow(dead_code)]
pub fn escaped_ident(ident: &str) -> EscapedIdent<'_> {
    EscapedIdent { ident, quote: '"' }
}

#[allow(dead_code)]
pub fn escaped_ident_bt(ident: &str) -> EscapedIdent<'_> {
    EscapedIdent { ident, quote: '`' }
}

pub static VALID_IDENT: Lazy<Regex> = Lazy::new(|| {
    // An ident starting with `a-z_` and containing other characters `a-z0-9_$`
    //
    // We could replace this with pomsky:
    // ^ ([ascii_lower '_'] [ascii_lower ascii_digit '_$']* ) $
    Regex::new(r"^[a-z_][a-z0-9_$]*$").unwrap()
});

pub struct EscapedIdent<'a> {
    ident: &'a str,
    quote: char,
}

impl<'a> fmt::Display for EscapedIdent<'a> {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        if VALID_IDENT.is_match(self.ident) {
            f.write_str(self.ident)
        } else {
            f.write_char(self.quote)?;
            for c in self.ident.chars() {
                if c == self.quote {
                    f.write_char(c)?;
                }
                f.write_char(c)?;
            }
            f.write_char(self.quote)
        }
    }
}
