import type { FunctionComponent, ReactNode } from 'react'

export default function $Wrapper<P extends { children: ReactNode } = { children: ReactNode }> (functionComponent: FunctionComponent<P>) {
	return functionComponent
}
