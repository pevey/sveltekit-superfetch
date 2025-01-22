// Reexport your entry components here
import { nanoid } from 'nanoid/non-secure'
import TTLCache from '@isaacs/ttlcache'
import { dev } from '$app/environment'

export interface SuperFetchOptions {
	timeout?: number
	retry?: number
	ttl?: number
	logger?: Logger
	logFormat?: 'text' | 'json' | 'majel'
	logLevel?: 'verbose' | 'limited' | 'silent'
	excludedPaths?: string[]
	limitedPaths?: string[]
}

export interface FetchOptions {
	url: string
	method?: string
	headers?: {}
	body?: any
	key?: string
	ttl?: number
	revalidate?: boolean
	logLevel?: 'verbose' | 'limited' | 'silent'
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
	private logger: Logger = console
	private logFormat: 'text' | 'json' | 'majel' = 'json'
	private logLevel: 'verbose' | 'limited' | 'silent' = dev ? 'limited' : 'silent'
	private excludedPaths: string[] = []
	private limitedPaths: string[] = []
	private ttl: number = 1000
	private cache?: TTLCache<string, any>
	private formatRequest: Function
	private formatResponse: Function

	constructor(options?: SuperFetchOptions) {
		if (options) {
			const { timeout, retry, logger, logFormat, logLevel, excludedPaths, limitedPaths, ttl }: SuperFetchOptions = options
			if (timeout) {
				this.timeout = timeout
			}
			if (retry) {
				this.retry = retry
			}
			if (logger) {
				this.logger = logger
			}
			if (logFormat) {
				this.logFormat = logFormat
			}
			if (logLevel) {
				this.logLevel = logLevel
			}
			if (excludedPaths) {
				this.excludedPaths = excludedPaths
			}
			if (limitedPaths) {
				this.limitedPaths = limitedPaths
			}
			if (ttl) {
				this.ttl = ttl
			}
		}

		switch (this.logFormat) {
			case 'majel':
				this.formatRequest = function (logLevel: string, id: string, options: FetchOptions) {
					let { url, ...rest }: FetchOptions = options
					let request: Request = new Request(url, rest)
					if (logLevel === 'limited') url = new URL(url).pathname // strip out query params
					let entry: MajelFormat = {
						id,
						limited: logLevel === 'limited',
						type: 'request',
						timestamp: Date.now(),
						url
					}
					if (request && logLevel === 'verbose') {
						entry.request = request
					}
					return entry
				}
				this.formatResponse = function (logLevel: string, id: string, options: FetchOptions, response: Response | undefined, error?: Error) {
					let { url, ...rest }: FetchOptions = options
					if (logLevel === 'limited') {
						url = new URL(url).pathname
					} // strip out query params
					let entry: MajelFormat = {
						id,
						limited: logLevel === 'limited',
						type: 'response',
						timestamp: Date.now(),
						url
					}
					if (response && logLevel === 'verbose') {
						entry.response = response
					}
					if (error) {
						entry.error = error
					}
					return entry
				}
				break
			case 'text':
				this.formatRequest = function (logLevel: string, id: string, options: FetchOptions) {
					let { url, ...rest }: FetchOptions = options
					if (logLevel === 'limited') {
						url = new URL(url).pathname // strip out query params
						return `Fetch Request (${id}): ${url}`
					} else {
						return `Fetch Request (${id}): ${JSON.stringify(options)}`
					}
				}
				this.formatResponse = function (logLevel: string, id: string, options: FetchOptions, response: Response | undefined, error?: Error) {
					let { url, ...rest }: FetchOptions = options
					if (logLevel === 'limited') {
						url = new URL(url).pathname // strip out query params
					}
					return error
						? `Fetch Response (${id}): ${JSON.stringify({ url, error: error.message })}`
						: `Fetch Response (${id}): ${JSON.stringify({ url, status: response?.status, statusText: response?.statusText })}`
				}
				break
			default: // json
				this.formatRequest = function (logLevel: string, id: string, options: FetchOptions) {
					let { url, ...rest }: FetchOptions = options
					if (logLevel === 'limited') {
						url = new URL(url).pathname // strip out query params
					}
					let entry: any = {
						id: id,
						type: 'request',
						timestamp: new Date().toISOString(),
						url
					}
					if (logLevel === 'verbose') {
						entry.options = rest
					}
					return entry
				}
				this.formatResponse = function (logLevel: string, id: string, options: FetchOptions, response: Response | undefined, error?: Error) {
					let { url, ...rest }: FetchOptions = options
					if (logLevel === 'limited') {
						options.url = new URL(options.url).pathname // strip out query params
					}
					let entry: any = {
						id: id,
						type: 'response',
						timestamp: new Date().toISOString(),
						url: url
					}
					if (response) {
						;(entry.status = response.status), (entry.statusText = response.statusText)
						if (logLevel === 'verbose') {
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

	public async query(options: FetchOptions): Promise<Response | null> {
		if (!options.url) return null
		let response: Response | null = null
		if (options.key && !options.revalidate) {
			response = await this.getCache(options.key)
			if (response) return response
		}
		const id = nanoid()
		try {
			await this.logRequest(id, options)
		} catch {}
		try {
			response = await this.fetch(id, options)
		} catch {}
		if (!response) return null // an eror occurred and was already logged
		try {
			await this.logResponse(id, options, response)
		} catch {}
		if (options.key) {
			response = await this.setCache(response, options.key, options.ttl)
		}
		return response
	}

	private async fetch(id: string, options: FetchOptions, retry: number = this.retry): Promise<Response | null> {
		const { url, ...rest }: FetchOptions = options
		if (!url) return null
		let response: Response | null = null
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
				this.logResponse(id, options, response, e)
				return response
			}
		}
	}

	private async getCache(key: string): Promise<Response | null> {
		if (!this.cache) return null
		let response: Response | null = null
		try {
			let blob = this.cache.get(key)
			if (blob) {
				response = new Response(blob)
			}
		} catch {}
		return response
	}

	private async setCache(response: Response, key: string, ttl?: number): Promise<Response> {
		if (!response?.body) return response
		if (!this.cache) this.cache = new TTLCache({ ttl: this.ttl })
		ttl = ttl || this.ttl
		try {
			let blob = await response.blob()
			this.cache.set(key, blob, { ttl })
			response = new Response(blob) // create a new response because readable stream on the original body was used up
		} catch {}
		return response
	}

	private async logRequest(id: string, options: FetchOptions): Promise<void> {
		const logLevel = this.getLogLevel(options)
		if (logLevel === 'silent') return
		const entry = this.formatRequest(logLevel, id, options)
		this.logger.info(entry)
	}

	private async logResponse(id: string, options: FetchOptions, response?: Response | null, error?: Error): Promise<void> {
		const logLevel = this.getLogLevel(options)
		if (logLevel === 'silent') return
		const entry = this.formatResponse(logLevel, id, options, response, error)
		if (error) this.logger.error(entry)
		else this.logger.info(entry)
	}

	private getLogLevel(options: FetchOptions): string {
		if (this.logLevel === 'silent' || options.logLevel === 'silent') {
			return 'silent'
		}
		// check excluded paths
		const excluded = this.excludedPaths.find((excluded: string) => options.url.includes(excluded))
		if (excluded) {
			if (options.logLevel && (options.logLevel === 'verbose' || options.logLevel === 'limited')) {
				this.logger.info(
					`The logLevel for this individual query was set to ${options.logLevel}, but the query path is in the class-level excludedPaths array.  Suppressing log entry.`
				)
			}
			return 'silent'
		}
		if (options.logLevel === 'verbose') {
			return 'verbose'
		} else if (options.logLevel === 'limited') {
			return 'limited'
		} else if (this.logLevel === 'verbose') {
			// check limited paths
			if (this.limitedPaths.find((limited: string) => options.url.includes(limited))) {
				return 'limited'
			}
			return 'verbose'
		} else {
			return 'limited'
		}
	}
}
