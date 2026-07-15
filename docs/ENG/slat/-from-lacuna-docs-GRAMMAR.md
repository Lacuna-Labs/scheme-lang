<p align="left">
  <img src="../../brand/assets/tri-tone-bar.svg" alt="Lacuna slat — grammar" width="400">
</p>

# Slat — Grammar

*Formal grammar of a slat line.*

---

## BNF

```
<file>       ::= <line> ( LF <line> )*
<line>       ::= <blank> | <shebang> | <comment-line> | <form>
<blank>      ::= <ws>*
<shebang>    ::= ";;;slat" <ws>+ <version>
<version>    ::= <digit>+ "." <digit>+

<comment-line> ::= ";" <not-newline>*
                 | "#|" <not-close-block>* "|#"

<form>       ::= "(" <ws>* <head> <element>* <ws>* ")"
<head>       ::= <symbol>
<element>    ::= <ws>+ ( <keyvalue> | <atom> | <comment> )
<keyvalue>   ::= <keyword> <ws>+ <atom>

<atom>       ::= <string>
               | <symbol>
               | <keyword>
               | <int>
               | <float>
               | <rational>
               | <char>
               | <bool>
               | <nil>
               | <form>
               | <bare-list>
               | <label-def>
               | <label-ref>

<bare-list>  ::= "(" ( <ws>* <atom> )* <ws>* ")"

<string>     ::= '"' <string-char>* '"'
<string-char>::= <printable-non-quote-non-backslash> | "\\" <esc-char>
<esc-char>   ::= "n" | "t" | "r" | '"' | "\\" | <any>

<symbol>     ::= <sym-start> <sym-rest>*
<sym-start>  ::= <letter> | "-" | "+" | "*" | "/" | "?" | "!" | "_" | "."
<sym-rest>   ::= <sym-start> | <digit>

<keyword>    ::= ":" <sym-start> <sym-rest>*

<int>        ::= ( "+" | "-" )? <digit>+
<float>      ::= ( "+" | "-" )? <digit>+ "." <digit>+ ( "e" <int> )?
               | ( "+" | "-" )? <digit>+ "e" <int>
<rational>   ::= <int> "/" <int>

<char>       ::= "#\\" ( <printable> | "space" | "newline" | "tab" | "return" )

<bool>       ::= "#t" | "#f"
<nil>        ::= "nil"

<label-def>  ::= "#" <digit>+ "=" <atom>
<label-ref>  ::= "#" <digit>+ "#"

<comment>    ::= ";" <not-newline>*
               | "#|" <not-close-block>* "|#"

<ws>         ::= " " | "\t"
```

Notes:

- `<not-newline>` = any byte except CR (0x0D) or LF (0x0A).
- `<not-close-block>` = any byte such that `|#` does not begin here. Block comments nest.
- `<any>` in `<esc-char>` is passed through — the reader accepts `"\z"` as literal `z`. This is deliberate: escape flexibility for future forward-compat.
- Number lexing is greedy: `+5` is an int, `-0.5` is a float, `1/3` is a rational. A token that fails all three parses becomes a symbol.

## EBNF (compact form)

```ebnf
file      = { line , LF } ;
line      = form | comment | shebang | blank ;
form      = "(" head { element } ")" ;
head      = symbol ;
element   = keyword atom | atom | comment ;
atom      = string | symbol | keyword | int | float | rational | char | bool | nil | form | list ;
list      = "(" { atom } ")" ;
comment   = ";" { any - newline } | "#|" { any } "|#" ;
shebang   = ";;;slat" WS version ;
version   = digit "." digit ;
```

## Semantics: canonicalization

After parsing, the raw tree is canonicalized into the final dict shape:

1. If the top-level list's first element is a symbol, its name becomes the `_form` value.
2. Keyword-followed-by-atom pairs in the tail fold into dict entries.
3. Any tail atom that is not part of a keyword pair goes into `_positional` (a list).
4. Nested forms recurse.
5. A bare list (no head symbol, no keywords) stays a list.
6. Comments in the tail attach to the enclosing form's `_comment`.

This is the shape callers see. The tokenizer/parser stage is an implementation detail.
