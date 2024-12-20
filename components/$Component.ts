import type { Attributes, FunctionComponent } from 'react'

export default function $Component<P extends object, F extends FunctionComponent<P & Attributes>> (functionComponent: F): F {
	return functionComponent
}
