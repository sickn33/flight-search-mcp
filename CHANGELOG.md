# Changelog

## 0.4.9

- Skip Skiplagged requests during its 30-second rate-limit cooldown so other providers can return sooner.
- Expose per-source elapsed time in flight-search coverage.
- Add public-link geographic measurements and the benchmark against the 0.4.8 baseline.

## 0.4.8

- Extend Lastminute search from Italy to the United Kingdom, France and Spain in their supported currencies.
- Derive source locale from the requested market and retain an explicit locale override.
- Verify market-specific seller link handling in the international search benchmark.
