import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import globals from 'globals'
import obsidianmd from 'eslint-plugin-obsidianmd'

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    // @ts-expect-error - obsidianmd types are incomplete but the config works at runtime
    ...obsidianmd.configs['recommended'],
    eslintConfigPrettier,
    {
        ignores: [
            '**/dist/**',
            '**/node_modules/**',
            'scripts/**',
            'test-vault/**',
            '.cz-config.cjs',
            'prettier.config.cjs',
            'package.json'
        ]
    },
    {
        files: ['**/*.{js,mjs,cjs,ts}'],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser,
                // Tests and build tooling run under the Bun runtime
                Bun: 'readonly',
                // Obsidian global functions
                createDiv: 'readonly',
                createEl: 'readonly',
                createSpan: 'readonly',
                createFragment: 'readonly'
            },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname
            }
        },
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
            ],
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-deprecated': 'off',
            // These are too strict for dynamic plugin APIs
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            // Obsidian methods are dynamically added to prototypes
            '@typescript-eslint/no-unsafe-enum-comparison': 'off',
            'no-prototype-builtins': 'off',
            // Allow confirm for delete confirmations
            'no-alert': 'off',
            // Never disable obsidianmd/* rules here: the community catalog
            // reviewer runs its own ruleset against the git archive, so a
            // local disable only hides the finding until submission.
            // NOTE: brands and acronyms are enforced BOTH ways — listing one
            // forces every prose occurrence to that exact casing.
            'obsidianmd/ui/sentence-case': [
                'error',
                {
                    brands: [
                        'Knowii',
                        'X',
                        'GitHub Sponsors',
                        'Sébastien Dubois',
                        'dSebastien',
                        'Obsidian'
                    ],
                    acronyms: ['API', 'REST', 'MCP', 'CLI', 'CORS', 'URL', 'HTTP', 'AI'],
                    ignoreRegex: [
                        // Single-token literals are values, not sentences.
                        '^\\S+$',
                        // URL paths: acronyms would rewrite /api/ to /API/
                        '/\\S+',
                        // Placeholder examples starting with e.g.
                        '^e\\.g\\.,'
                    ]
                }
            ]
        }
    }
)
