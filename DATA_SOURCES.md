# Data sources

All sources below were fetched on 2026-11-03 while building version 1.0.0.

## Live data (read at call time, no key)

| Data | URL | Terms |
|---|---|---|
| Silver (XAG) and gold (XAU) spot in USD per troy ounce | https://api.gold-api.com/price/XAG and https://api.gold-api.com/price/XAU | https://gold-api.com/terms allows commercial use of the free real-time API and forbids several requests per second, so the Worker caches each answer at the edge for 300 s. |
| FX rates, USD base, about 160 currencies blended from central banks | https://api.frankfurter.dev/v2/rates?base=USD | https://frankfurter.dev: free, no key, commercial use allowed. Cached 3600 s. |

This is the same spot feed goldgramprice.com uses. No key ships in this repo.

## Rules and constants

| Item | Value | Source |
|---|---|---|
| Sterling silver | at least 925/1000 pure silver | 16 CFR 23.5(b)(2), https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-23/section-23.5 (fetched via the eCFR versioner API, 2026-10-01 edition) |
| Coin silver | at least 900/1000 pure silver | 16 CFR 23.5(b)(3), same page |
| Silver hallmark standards | 800, 925, 958.4 (Britannia), 999 | UK Hallmarking Act 1973 Schedule 2, https://www.legislation.gov.uk/ukpga/1973/43/schedule/2 |
| Kennedy half dollar 1965 to 1970 | whole coin 11.5 g containing 4.6 g of silver | Coinage Act of 1965, Pub. L. 89-81 sec. 101(a)(1), https://www.govinfo.gov/content/pkg/STATUTE-79/pdf/STATUTE-79-Pg254.pdf |
| 90% dimes, quarters and halves until 1965 | "900 fine coin silver" | Coinage Act of 1965 sec. 101(b), same PDF |
| Dime, quarter, half dollar gross weight before 1965 | 2.5 g, 6.25 g, 12.5 g at 900 fine | https://en.wikipedia.org/wiki/Roosevelt_dime, https://en.wikipedia.org/wiki/Washington_quarter, https://en.wikipedia.org/wiki/Franklin_half_dollar (Coinage Act of 1873 standard) |
| War nickel 1942 to 1945 | 5.000 g, 35% silver | https://en.wikipedia.org/wiki/Jefferson_nickel |
| Morgan and Peace dollar | 412.5 grains (26.73 g) at 900 fine = 371.25 grains of silver | https://en.wikipedia.org/wiki/Morgan_dollar, https://en.wikipedia.org/wiki/Peace_dollar |
| American Silver Eagle | weighs 31.103 g, .999 fine, inscribed "1 Oz. Fine Silver" | 31 U.S.C. 5112(e), https://www.law.cornell.edu/uscode/text/31/5112 |
| Troy ounce, grain, avoirdupois ounce and pound | 31.1034768 g, 64.79891 mg, 28.349523125 g, 453.59237 g | NIST Handbook 44 (2024) Appendix C |

usmint.gov answered 403 to every scripted request on 2026-11-03 and the Wayback Machine copy answered 429, so the pre-1965 coin weights and the war nickel and silver dollar specifications are cited from Wikipedia, which cites the US Mint and the Coinage Acts. The Kennedy 40% figure and the Silver Eagle specification come straight from the statute text.
