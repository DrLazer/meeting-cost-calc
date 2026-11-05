# Meeting Cost 💸

Watch what a meeting is really costing, live, on a car-style odometer.

The home page (`index.html`) makes the case for async working; the calculator lives at `calculator.html`.

Add the job titles in the room, pick a location, hit **GO**. Stop it when the meeting ends to see the total.

- Random meeting on first visit, so you can just hit GO
- UK and US: approximate salaries by role, adjusted by city (every figure is editable), costed in pounds or dollars
- Picks a sensible country from your time zone, or your nearest major city with Near me
- "True cost" mode adds employer costs: NI, pension and overheads in the UK; Social Security, Medicare, health insurance, retirement match and overheads in the US
- Save teams in your browser for quick reuse
- Plan ahead: cost a meeting from its length and jump straight to an estimate report
- Share a meeting via its URL
- Share just the receipt, as a link or a PNG image
- Full meeting report: an itemised receipt with USD and BTC conversions, cost by role, what you'd save with a shorter meeting, yearly cost if it recurs, and what else the money could have bought

Plain HTML, CSS and JS with no build step. Deployed to GitHub Pages on push to `main`.

Run locally: `python3 -m http.server` then open http://localhost:8000.

## Data sources

- UK salaries: rough national estimates, with city multipliers.
- US salaries: rough national estimates informed by Bureau of Labor Statistics May 2024 median wages. City differences follow the 2026 federal GS locality pay rates (OPM).
- US employer costs: 2026 Social Security wage base ($184,500), Medicare 1.45%, and KFF's 2025 Employer Health Benefits Survey for the average employer share of single coverage ($7,885).
- A meeting is recorded in its own country's currency and never converted on save. The report can show other currencies using live Coinbase rates.
