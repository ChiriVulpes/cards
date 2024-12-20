namespace Errors {
	export interface WithCode extends Error {
		code: number
	}

	export function code (code: number, err: unknown): WithCode {
		return Object.assign(
			typeof err === 'string' ? new Error(err)
				: !err || typeof err !== 'object' ? new Error('Unknown error')
					: err instanceof Error ? err
						: Object.assign(new Error('Unknown error'), err),
			{ code },
		)
	}

	export function getCode (err: unknown) {
		const coded = err as WithCode
		if (coded && 'code' in coded && typeof coded.code === 'number' && coded.code >= 200 && coded.code < 600)
			return coded.code

		return 500
	}

	export function getMessage (err: unknown) {
		const pretendError = err as Error
		if (pretendError)
			return pretendError.message
	}

	export function getStack (err: unknown) {
		const pretendError = err as Error
		if (pretendError)
			return pretendError.stack
	}
}

export default Errors
