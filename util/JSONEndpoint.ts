import ansi from '@/util/ansi'
import Errors from '@/util/Errors'
import type { NextRequest, NextResponse } from 'next/server'

export interface JSONEndpointResponse extends NextResponse {
	extension?: any
}

export default function JSONEndpoint<T> (endpoint: (request: NextRequest, response: JSONEndpointResponse) => Promise<T>) {
	return async (request: NextRequest, response: JSONEndpointResponse) => {
		let data: T | undefined
		try {
			data = await endpoint(request, response)
		}
		catch (err) {
			const code = Errors.getCode(err)
			if (code >= 500)
				console.error(`${ansi.err}${code}${ansi.label}: ${ansi.reset}${Errors.getStack(err)}`)

			return new Response(
				JSON.stringify({ success: false, data: null, error: code >= 500 ? 'Internal server error' : { message: Errors.getMessage(err), ...typeof err === 'object' ? err : {} } }),
				{
					status: code,
					headers: { 'Content-Type': 'application/json' },
				},
			)
		}

		return new Response(
			JSON.stringify({ success: true, data, ...response.extension, error: null }),
			{ headers: { 'Content-Type': 'application/json' } },
		)
	}
}
