# Metrics test fixtures

Real responses saved on Nov 15, 2026 and trimmed to the fragments the parsers
read. Text only.

| File | From | Trimmed to |
| --- | --- | --- |
| `ollama-profile.html` | `https://ollama.com/aravhawk` | the model list, svg icons removed |
| `ollama-model-llama4.html` | `https://ollama.com/aravhawk/llama4` | the stats row, svg icons removed |
| `contributions-2022.html` | `https://github.com/users/aravhawk/contributions?from=2022-01-01&to=2022-12-31` | the heading plus the calendar weeks with activity, markup verbatim |
| `contributions-last-year.html` | `https://github.com/users/aravhawk/contributions` | the heading verbatim; tooltips for active days with attributes reduced, plus three quiet days verbatim |
| `npm-range.json` | `https://api.npmjs.org/downloads/range/2026-02-01:2026-11-15/@aravhawk/cc-switch` | the first 14 days |
| `npm-point-last-month.json` | `https://api.npmjs.org/downloads/point/last-month/@aravhawk/cc-switch` | verbatim |
| `github-search-upstream.json` | GitHub search API, the headline merged PR query | the fields the parser reads |

If a source changes its markup, save the new response next to these, trim it
the same way and add a test before changing a parser.
