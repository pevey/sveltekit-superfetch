# sveltekit-superfetch

SvelteKit libary for interacting with APIs with support for optional loging of requests and responses

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

You can also customize the fetcher:

`lib/superfetch.ts`
```ts
import { SuperFetch } from 'sveltekit-superfetch'
export default const superFetch = new SuperFetch({
   retry: 3,
   timeout: 8000, // 8 seconds
   debug: true, // whether or not to log requests, default is false
   logger: logger, // injected logger instance, default is `console`, must implement info() and error()
   logFormat: 'json', // text or json, default is json
   excludedPaths: ['/api/auth'], // an array of strings, fetches to routes containing these strings will not be logged
   limitedPaths: [/] // an array of strings, log entries will not contain headers, bodies, cookies, or url params
})
```

Using the root path ('/') in the array of limitedPaths will make all log entries contain only limited information.  This could be useful if you need to trace an error, but your data is sensitive.

### Example Fetch with POST method, headers, and body

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

### Basic example with no options

``` ts
import superFetch from '$lib/superFetch'
const response = await superFetch.query("https://example.org")
```

If you create a new instance of SuperFetch without passing in a logger instance, it will use console (console.log() and console.error()) by default.  HOWEVER, you must set `debug` to true to see the log in the console.
