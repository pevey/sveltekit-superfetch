# sveltekit-superfetch

SvelteKit libary for interacting with APIs with support for optional logging of requests and responses

## Usage

Usage is similar to using the standard fetch API.  No options are required.  The fetcher will default to a timeout of 8 seconds and 3 retries if no values for those options are specified.

(The examples below work with v2.0.0 and above.)

### Creating a New Instance

This is often best done in a lib that creates a singleton that can be imported as needed elsewhere in your project.  If you just want to use the defaults for all options, you can do:

`lib/superfetch.ts`
```ts
import { SuperFetch } from 'sveltekit-superfetch'
export default const superFetch = new SuperFetch() 
```

You can also customize the fetcher.  Example options:

`lib/superfetch.ts`
```ts
import { SuperFetch } from 'sveltekit-superfetch'
export default const superFetch = new SuperFetch({
   retry: 3,
   timeout: 8000, // 8 seconds
   ttl: 1000, // 1 second. Max age of cached responses.  Only individual queries with a 'key' specified in the options will be cached.
   logger: logger, // injected logger instance, default is `console`, must implement info() and error()
   logFormat: 'json', // text or json, default is json
   logLevel: 'verbose' | 'limited' | 'silent' // default is 'limited' in dev mode, 'silent' in prod
   excludedPaths: ['/api/auth'], // an array of strings, fetches to routes containing these strings will not be logged
   limitedPaths: ['/'] // an array of strings, log entries will not contain headers, bodies, cookies, or url params
})
```

Using the root path ('/') in the array of limitedPaths will make all log entries contain only limited information.  This could be useful if you need to trace an error, but your data is sensitive.

### Example fetch with POST method, headers, and body

```ts
import superFetch from '$lib/superFetch'
const response = await superFetch.query({
   url: 'https://example.org', 
   method: 'POST',
   headers: {
      'Content-Type': 'application/json'
   },
   body: JSON.stringify({ key: 'value' })
   // ...any other properties supported in basic fetch request
   // see https://developer.mozilla.org/en-US/docs/Web/API/fetch
})
```

### Example fetch that will be cached server-side with optional ttl override

```ts
import superFetch from '$lib/superFetch'
const response = await superFetch.query({
   url: 'https://example.org/api/product', 
   key: 'products',
   ttl: 10000 // 10 seconds
})
```

Even a cache with a relatively short ttl, such as 1 second, can provide a large performance boost and reduce hits to third-party APIs on high-traffic sites.  Do not attempt to cache request types other than GET.  Do not cache sensitive or dynamic endpoints, such as customer profiles.

### Basic example with no options

``` ts
import superFetch from '$lib/superFetch'
const response = await superFetch.query("https://example.org")
```

If you create a new instance of SuperFetch without passing in a logger instance, it will use console (console.log() and console.error()) by default.
