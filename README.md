# sveltekit-superfetch

This extremely small sveltekit component is a simple fetch wrapper function (superFetch) that adds retry and timeout options.

## Usage

Usage is identical to the basic fetch in Sveltekit, with the exception of two additional configuation options.  
The options are not required, and will default to a timeout of 8 seconds with no retries if no values for the options are specified.

```js

import superFetch from 'sveltekit-superFetch'

// Example with POST method, headers, and body
const response = await superFetch('https://example.org', {
   timeout: 5000,
   retry: 3,
   method: 'POST',
   headers: {
      'Content-Type': 'application/json'
   },
   body: JSON.stringify({ key: 'value' })
   ...other options
})

// Example with no options set that will also work fine.
// This will make a basic GET request with no retries

const response = await superFetch("https://example.org")

```
