# Change Log

## 4.0.0

- Bump Svelte and SvelteKit versions
- Replace shx with rimraf

## 3.0.3

- Upgrade dependencies
- Fix headers typing from [] to {}

## 3.0.2

- Added query option: revalidate If a cache key is passed and revalidate is set to true, this will cause the query to pull fresh data, cache the new data, and update the ttl.

## 3.0.1

- Internal refactoring of cache functions
- Cache will no longer be created on construction of an instance. The cache will be created the first time a query is run that attempts to set a value in the cache.

## 3.0.0

- Added optional caching
- Changed API for logging. Enabled per-fetch opt-in to logging.

## 2.0.2

- Refactored as a class. Export a single instance with your options set and use it throughout your app
- Added options related to logging. See README for usage.

## 1.0.6

### Patch Changes

- Bumped versions on all dependencies to latest
