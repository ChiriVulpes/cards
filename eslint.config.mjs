import pluginJs from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import 'eslint-plugin-only-warn'
import pluginReact from 'eslint-plugin-react'
import tailwind from 'eslint-plugin-tailwindcss'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/** @type {import('eslint').Linter.Config[]} */
export default [
	{ files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'] },
	{ languageOptions: { globals: { ...globals.browser, ...globals.node } } },
	pluginJs.configs.recommended,
	...tseslint.configs.recommended,
	/** @type {any} */ (pluginReact.configs.flat?.recommended),
	...tailwind.configs['flat/recommended'],

	stylistic.configs.customize({
		indent: 'tab',
		quotes: 'single',
		semi: false,
		jsx: false,
	}),

	{
		settings: {
			tailwindcss: {
				callees: ['s'],
				config: 'tailwind.config.ts',
			},
		},
		rules: {
			'react/react-in-jsx-scope': 'off',
			'@typescript-eslint/no-namespace': 'off',
			'@typescript-eslint/consistent-type-imports': 'warn',
			'@stylistic/spaced-comment': ['warn', 'always', { exceptions: ['/'], markers: ['#region', '#endregion'] }],
			'@stylistic/space-before-function-paren': ['warn', 'always'],
			'@stylistic/quotes': ['warn', 'single'],
			'@stylistic/padded-blocks': ['warn', { blocks: 'never', classes: 'always' }],
		},
	},
]
