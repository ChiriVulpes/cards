import type { Attributes, FunctionComponent } from 'react'

export default function $Component<P extends Attributes = Attributes> (functionComponent: FunctionComponent<P>) {
	return functionComponent
}
