const superFetch = async (url, options) => {
   const { timeout = 8000, retry = 3 } = options
   try {
      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), timeout)
      const response = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(id)
      if (response.status == 401) return false
      if (!response.ok) throw new Error(`Fetch error: ${response.status} ${response.statusText}`)
      return response
   } catch (error) {
      console.error(`Fetch failed (${url}):`, error)
      if (retry > 0) {
         console.error(`Fetch failed (${url}), retrying now... (${retry} retries left)`, error)
         return await superFetch(url, { ...options, retry: retry - 1 })
      }
      throw error
   }
}

export default superFetch