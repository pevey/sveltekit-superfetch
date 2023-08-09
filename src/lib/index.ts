import { nanoid } from 'nanoid/non-secure'

export interface SuperFetchOptions {
   timeout?: number
   retry?: number
   debug?: boolean
   logger?: Logger
   logFormat?: 'text' | 'json' | 'majel'
   excludedPaths?: string[]
   limitedPaths?: string[]
}

export interface FetchOptions {
   url: string
   method?: string
   headers?: []
   body?: any
}

export interface Logger {
   info: (message: string) => void
   error: (message: string) => void
}

interface MajelFormat {
   id: string
   limited?: boolean
   type: 'request' | 'response'
   timestamp: number
   url: string
   request?: Request
   response?: Response
   error?: Error
   metadata?: JSON
}

export class SuperFetch {
   private timeout: number = 8000
   private retry: number = 3
   private debug: boolean = false
   private logger: Logger = console
   private logFormat: 'text' | 'json' | 'majel' = 'json'
   private excludedPaths: string[] = []
   private limitedPaths: string[] = []
   private formatRequest: Function
   private formatResponse: Function

   constructor(options?: SuperFetchOptions) {
      if (options) {
         const { timeout, retry, debug, logger, logFormat, excludedPaths, limitedPaths }: SuperFetchOptions = options
         if (timeout) { this.timeout = timeout }
         if (retry) { this.retry = retry }
         if (debug) { this.debug = debug }
         if (logger) { this.logger = logger }
         if (logFormat) { this.logFormat = logFormat }
         // if logger is typeof MajelLogger, logFormat = 'reqres'
         if (this.logFormat === 'majel') { this.debug = true }
         if (excludedPaths) { this.excludedPaths = excludedPaths }
         if (limitedPaths) { this.limitedPaths = limitedPaths }
      }
      switch (this.logFormat) {

         case 'majel':
            this.formatRequest = function (id: string, options: FetchOptions) {
               let { url, ...rest }: FetchOptions = options
               const limited = this.limitedPaths.find((limited: string) => url.includes(limited))
               let request: Request = new Request(url, rest)
               if (limited) url = (new URL(url)).pathname // strip out query params
               let entry: MajelFormat = {
                  id,
                  limited: (limited !== undefined),
                  type: 'request',
                  timestamp: Date.now(),
                  url
               }
               if (request && !limited) {
                  entry.request = request
               }
               return entry
            }
            this.formatResponse = function (id: string, url: string, response: Response|undefined, error?: Error) {
               const limited = this.limitedPaths.find((limited: string) => url.includes(limited))
               if (limited) { url = (new URL(url)).pathname } // strip out query params 
               let entry: MajelFormat = {
                  id,
                  limited: (limited !== undefined),
                  type: 'response',
                  timestamp: Date.now(),
                  url
               }
               if (response && !limited) {
                  entry.response = response
               }
               if (error) {
                  entry.error = error
               }
               return entry
            }
            break;
         
         case 'text':

            this.formatRequest = function (id: string, options: FetchOptions) {
               let { url, ...rest }: FetchOptions = options
               const limited = this.limitedPaths.find((limited: string) => options.url.includes(limited))
               if (limited) {
                  url = (new URL(url)).pathname // strip out query params
                  return `Fetch Request (${id}): ${url}`
               } else {
                  return `Fetch Request (${id}): ${JSON.stringify(options)}`
               }
            }
            this.formatResponse = function (id: string, url: string, response: Response|undefined, error?: Error) {
               const limited = this.limitedPaths.find((limited: string) => url.includes(limited))
               if (limited) { url = (new URL(url)).pathname } // strip out query params
               return (error)?
                  `Fetch Response (${id}): ${JSON.stringify({ url: url, error: error.message })}`:
                  `Fetch Response (${id}): ${JSON.stringify({ url: url, status: response?.status, statusText: response?.statusText })}`
            }
            break;

         default: // json

            this.formatRequest = function (id: string, options: FetchOptions) {
               let { url, ...rest }: FetchOptions = options
               const limited = this.limitedPaths.find((limited: string) => url.includes(limited))
               if (limited) { url = (new URL(url)).pathname } // strip out query params
               let entry: any = {
                  id: id,
                  type: 'request',
                  timestamp: new Date().toISOString(),
                  url: url
               }
               if (!limited) { entry.options = rest }
               return entry
            }
            this.formatResponse = function (id: string, url: string, response: Response|undefined, error?: Error) {
               const limited = this.limitedPaths.find((limited: string) => url.includes(limited))
               if (limited) { url = (new URL(url)).pathname } // strip out query params
               let entry: any = {
                  id: id,
                  //error: error?.message,
                  type: 'response',
                  timestamp: new Date().toISOString(),
                  url: url
               }
               if (response) {
                  entry.status = response.status,
                  entry.statusText = response.statusText
                  if (!limited) {
                     entry.headers = response.headers
                     entry.body = response.body
                  }
               }
               if (error) {
                  //entry.error = error.message
                  entry.error = error
               }
               return entry
            }
      }
   }

   public async query(options: FetchOptions): Promise<Response|null> {
      if (!options.url) return null
      const id = nanoid()
      try { await this.logRequest(id, options) } catch {}
      let response: Response|undefined = undefined
      try { response = await this.fetch(id, options) } catch {}
      if (!response) return null // an eror occurred and was already logged
      try { await this.logResponse(id, options.url, response) } catch {}
      return response
   }

   private async fetch(id: string, options: FetchOptions, retry: number = this.retry): Promise<Response|undefined> {
      const { url, ...rest }: FetchOptions = options
      if (!url) return
      let response: Response|undefined = undefined
      try {
         const controller = new AbortController()
         const id = setTimeout(() => controller.abort(), this.timeout)
         const response = await fetch(url, { ...rest, signal: controller.signal })
         clearTimeout(id)
         return response
      } catch (e: any) {
         if (retry > 0) {
            return await this.fetch(id, options, retry - 1)
         } else {
            this.logResponse(id, url, response, e)
            return response
         }
      }
   } 

   private async logRequest(id: string, options: FetchOptions): Promise<void> {
      if (!this.debug) return
      const excluded = this.excludedPaths.find((excluded: string) => options.url.includes(excluded))
      if (excluded) return
      const limited = this.limitedPaths.find((limited: string) => options.url.includes(limited))
      const entry = this.formatRequest(id, options, limited)
      this.logger.info(entry)
   }

   private async logResponse(id: string, url: string, response: Response|undefined, error?: Error): Promise<void> {
      if (!this.debug) return
      const excluded = this.excludedPaths.find((exclusion: string) => url.includes(exclusion))
      if (excluded) return
      const message = this.formatResponse(id, url, response, error)
      if (error) this.logger.error(message)
      else this.logger.info(message)
   }
}
