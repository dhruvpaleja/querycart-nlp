# QueryCart

[Live app](https://querycart-dhruv.vercel.app/) · [GitHub](https://github.com/dhruvpaleja/querycart-nlp) · [Report (PDF)](docs/QueryCart_Mini_Project_Report.pdf) · [Presentation (PPTX)](docs/QueryCart_Presentation.pptx) · [Notebook](Querycart_Walkthrough.ipynb)

An English query interface for a small inventory  
NLP mini-project option · I081 Dhruv Paleja · I053 Manan Shah  
Natural Language Processing 702AI0C009 · Dr Ami Munshi

## Problem and objective

A small-shop operator may need to identify products to reorder or compare inventory value without writing SQL or spreadsheet formulas. QueryCart translates supported English questions into a visible typed query plan and applies that plan to a local inventory CSV.

The objective is a bounded, explainable language interface. The user sees the parsed intent, filters and result. Unsupported or ambiguous constructions are rejected rather than guessed.

## Run

Node.js 22 or later, with no package dependencies or API keys:

```
npm test
npm run evaluate
npm run build
npm start
```

Open http://127.0.0.1:4173. `dist` is a static deployable website. Use `PORT` to choose another port.

## Practical workflow

1. Start with the fictional 24-product inventory or upload an inventory CSV.
2. Ask `Show low stock products`. Low stock means stock is less than or equal to that product's reorder level.
3. Ask `Total inventory value by category` or `Top 5 most expensive products`.
4. Inspect the extracted category/comparison/aggregation slots.
5. Export the result CSV, or export the query plan and result JSON.

Custom CSVs require `sku,name,category,stock,reorder_level,price`. A file may contain up to 2,000 products. Stock and reorder points are non-negative integers. Prices have up to two decimal places. All prices in one file must use one currency; the demo uses INR.

## NLP method

The pipeline normalizes Unicode, case, spacing and terminal punctuation. Complete grammar patterns recognize intents such as list, filter, rank, count and aggregate. Slots carry categories, fields, comparison operators and numbers. Category values are resolved against the loaded table.

A typed intermediate plan separates language understanding from execution. The same plan produces an equivalent parameterized SQL preview and a JavaScript table operation. The browser does not connect to or execute SQL against a database.

Examples:

| Input | Representation |
|---|---|
| Show Electronics under 1000 | category = Electronics; price < 1000 |
| Top 2 cheapest products | sort price ascending; limit 2 |
| Show low stock products | stock <= reorder_level |
| Average price by category | group category; average price |

Anchored grammar patterns require the whole sentence to match. This prevents silently ignoring a second condition such as “or stock above 50”. Unknown categories, reversed ranges, invalid CSV rows and data-changing requests produce visible errors.

Name searches accept literal text. A phrase that resembles an extra numeric condition is rejected unless the entire name is quoted, for example `Find products named "coffee under 500"`. This avoids treating a requested filter as part of a product name.

## Course concepts

CO1: language understanding and an NLP pipeline.  
CO2: token-level normalization and regular-expression grammar patterns.  
CO3: mapping natural-language intent and slots into a structured meaning representation.  
CO4: an applied question-answering interface over structured data.

This is symbolic semantic parsing, not a trained text-to-SQL model. It is intentionally distinct from scientific document search, RAG, sentiment analysis and the projects listed in the exclusion workbook.

## Evaluation

The fictional inventory has 24 products and 288 physical units. `data/evaluation.json` supplies 32 original diagnostic questions: 20 supported queries and 12 unsupported requests. `npm run evaluate` records exact results and rejection outcomes in `public/evaluation.json`.

The evaluation measures intended grammar behavior on project fixtures. It is not an estimate of performance on arbitrary user phrasing. “Anything running out?” and “What costs the least?” are meaningful questions that the current grammar rejects; users can choose an on-screen supported example. Unit tests also cover inclusive thresholds, duplicate SKUs, malformed CSV, quoted fields, empty aggregates and SQL-looking input remaining a parameter.

## Limits

Only the documented English grammar is supported. No forecasts, sales history, dates, supplier selection, write queries, general joins or arbitrary natural-language questions. Unknown currency conversion is never performed. Unicode normalization helps matching but does not translate categories.

The SQL preview is educational; it is not a database execution receipt. CSV results are read-only and the original data is not changed. Price arithmetic uses integer cents for totals; averages are rounded to two decimal places. A total that exceeds JavaScript's exact integer-cent limit is rejected rather than silently rounded. Numeric query thresholds must be finite and no greater than 100,000,000.

Changing a query or beginning an inventory import clears old results and exports. Only the newest pending inventory load may replace the data. If an import fails, the prior inventory remains loaded with an explicit error, and the previous query must be rerun.

Uploaded inventory stays in browser memory until the tab is closed or the demo is restored. No analytics, upload endpoint or paid service is used.

## Viva questions

- **What is semantic parsing?** Converting a sentence into a structured meaning representation that software can execute.
- **Why a typed plan?** It separates understanding from calculation and makes the interpretation inspectable.
- **Why reject unsupported queries?** Returning a wrong answer with a plausible table would be misleading.
- **What is a slot?** A variable part of an intent, such as category, numeric threshold or limit.
- **How is this different from keyword search?** It interprets comparison, aggregation and ordering relationships, not just matching words.
- **What is the main limitation?** Grammar coverage; unseen phrasing may be rejected even when a person understands it.
- **Why use parameters in the SQL preview?** Values are kept separate from SQL syntax.
- **How could it grow?** Annotated paraphrases, a supervised intent classifier, slot tagging, execution-based evaluation and a wider approved query grammar.

## Sources and authorship

The project uses original fictional product data and diagnostic questions. Background: Daniel Jurafsky and James H. Martin, [Speech and Language Processing](https://web.stanford.edu/~jurafsky/slp3/) for language understanding and semantic representations; [SQLite SELECT documentation](https://www.sqlite.org/lang_select.html) for the query operations shown in the preview.

This working prototype was developed with AI assistance for study and adaptation. It must not be represented as independently authored unaided work. Faculty approval of a replacement assessed topic remains separate from this implementation.
