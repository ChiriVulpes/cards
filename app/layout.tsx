import $Wrapper from '@/components/$Wrapper'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
	variable: '--font-inter',
	subsets: ['latin'],
	display: 'swap',
})

export default $Wrapper(({ children }) => {
	return (<html lang="en">
		<body className={inter.variable}>{children}</body>
	</html>)
})
