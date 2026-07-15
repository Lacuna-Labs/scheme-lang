# Slat — grammar

Formal grammar in EBNF. See [SPEC](./SPEC.md) for the informal walkthrough.

```ebnf
slat-file    = { slat-line , newline } , [ slat-line ] ;
slat-line    = whitespace , form , whitespace , [ comment ] ;
form         = "(" , { whitespace , value } , ")" ;
value        = atom | form ;

atom         = symbol | keyword | integer | float | rational
             | string | boolean | nil | char ;

symbol       = symbol-start , { symbol-char } ;
symbol-start = letter | "_" | "-" | "+" | "*" | "/" | "?" | "!" | "<" | ">" | "=" ;
symbol-char  = symbol-start | digit | "." | ":" ;

keyword      = ":" , symbol ;

integer      = [ "-" ] , digit , { digit } ;
float        = integer , "." , digit , { digit } , [ exponent ] ;
exponent     = ( "e" | "E" ) , [ "+" | "-" ] , digit , { digit } ;
rational     = integer , "/" , integer ;

string       = '"' , { string-char } , '"' ;
string-char  = ? any character except '"' or '\\' ? | escape ;
escape       = "\\" , ( '"' | "\\" | "n" | "r" | "t" ) ;

boolean      = "#t" | "#f" ;
nil          = "nil" ;
char         = "#\\" , ( character | char-name ) ;
char-name    = "space" | "newline" | "tab" | "return" ;

whitespace   = { " " | "\t" } ;
newline      = "\n" | "\r\n" ;
comment      = ";" , { any-char-except-newline } ;
```

## Notes

- The reader is single-line: `newline` inside a form is an error.
- Comments run to the end of the line only. Block comments (`#| ... |#`) are single-line as well.
- Keywords stand as `:name` tokens; when they appear inside a form immediately before a value, that key-value pair folds into the canonical dict.
- Structural-sharing labels (`#0=...`, `#0#`) are optional and expanded on read.
