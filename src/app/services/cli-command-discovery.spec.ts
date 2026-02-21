import { describe, expect, test } from 'bun:test'
import { parseHelpOutput } from './cli-command-discovery'

/**
 * Snapshot of `obsidian help` output from CLI 1.12.2.
 * Used for testing the parser without requiring the actual binary.
 */
const HELP_OUTPUT_SNAPSHOT = `Obsidian CLI v1.12.2

Commands:
  aliases               List aliases in the vault
    file=<name>         - File name
    format=<type>       - Output format (default, json)
  append                Append content to a file
    file=<name>         - File name (defaults to active file)
    content=<text>      - Content to append
    format=<type>       - Output format (default, json)
  backlinks             List backlinks to a file
    file=<name>         - File name (defaults to active file)
    format=<type>       - Output format (default, json)
  base:create           Create a new item in a base
    file=<name>         - Base file name
    format=<type>       - Output format (default, json)
  base:query            Query a base and return results
    file=<name>         - Base file name
    view=<name>         - View name
    format=<type>       - Output format (default, json)
  base:views            List views in the current base file
    file=<name>         - Base file name
    format=<type>       - Output format (default, json)
  bases                 List all base files in vault
    format=<type>       - Output format (default, json)
  bookmark              Add a bookmark
    file=<name>         - File name
  bookmarks             List bookmarks
    format=<type>       - Output format (default, json)
  command               Execute an Obsidian command
    id=<command-id>     - Command ID to execute
  commands              List available command IDs
    format=<type>       - Output format (default, json)
  create                Create or overwrite a file
    file=<name>         - File name
    content=<text>      - File content
    --overwrite         - Overwrite existing file
  daily                 Open today's daily note
  daily:append          Append content to daily note
    content=<text>      - Content to append
    format=<type>       - Output format (default, json)
  daily:path            Get daily note path
    format=<type>       - Output format (default, json)
  daily:prepend         Prepend content to daily note
    content=<text>      - Content to prepend
    format=<type>       - Output format (default, json)
  daily:read            Read daily note contents
    format=<type>       - Output format (default, json)
  deadends              List files with no outgoing links
    format=<type>       - Output format (default, json)
  delete                Delete a file
    file=<name>         - File name (defaults to active file)
    --permanent         - Skip trash
  diff                  List or compare file versions
    file=<name>         - File name
    format=<type>       - Output format (default, json)
  file                  Show file info
    file=<name>         - File name (defaults to active file)
    format=<type>       - Output format (default, json)
  files                 List files in the vault
    folder=<path>       - Folder to list
    format=<type>       - Output format (default, json)
  folder                Show folder info
    folder=<path>       - Folder path
    format=<type>       - Output format (default, json)
  folders               List folders in the vault
    format=<type>       - Output format (default, json)
  help                  Display available commands
  history               List versions from file recovery
    file=<name>         - File name
    format=<type>       - Output format (default, json)
  history:list          List all files with local history
    format=<type>       - Output format (default, json)
  history:open          Open file recovery UI
    file=<name>         - File name
  history:read          Read a local history version
    file=<name>         - File name
    version=<id>        - Version ID
    format=<type>       - Output format (default, json)
  history:restore       Restore a local history version
    file=<name>         - File name
    version=<id>        - Version ID
  hotkey                Get hotkey for a command
    id=<command-id>     - Command ID
    format=<type>       - Output format (default, json)
  hotkeys               List hotkeys for all commands
    format=<type>       - Output format (default, json)
  links                 List outgoing links from a file
    file=<name>         - File name (defaults to active file)
    format=<type>       - Output format (default, json)
  move                  Move or rename a file
    file=<name>         - Source file name (defaults to active file)
    to=<path>           - Destination path
  open                  Open a file
    file=<name>         - File name
    line=<number>       - Line number
  orphans               List files with no incoming links
    format=<type>       - Output format (default, json)
  outline               Show headings for the current file
    file=<name>         - File name (defaults to active file)
    format=<type>       - Output format (default, json)
  plugin                Get plugin info
    id=<plugin-id>      - Plugin ID
    format=<type>       - Output format (default, json)
  plugin:disable        Disable a plugin
    id=<plugin-id>      - Plugin ID
  plugin:enable         Enable a plugin
    id=<plugin-id>      - Plugin ID
  plugin:install        Install a community plugin
    id=<plugin-id>      - Plugin ID
  plugin:reload         Reload a plugin
    id=<plugin-id>      - Plugin ID
  plugin:uninstall      Uninstall a community plugin
    id=<plugin-id>      - Plugin ID
  plugins               List installed plugins
    format=<type>       - Output format (default, json)
  plugins:enabled       List enabled plugins
    format=<type>       - Output format (default, json)
  plugins:restrict      Toggle or check restricted mode
    --on                - Enable restricted mode
    --off               - Disable restricted mode
  prepend               Prepend content after frontmatter
    file=<name>         - File name (defaults to active file)
    content=<text>      - Content to prepend
    format=<type>       - Output format (default, json)
  properties            List properties in the vault
    format=<type>       - Output format (default, json)
  property:read         Read a property value
    file=<name>         - File name (defaults to active file)
    property=<name>     - Property name
    format=<type>       - Output format (default, json)
  property:remove       Remove a property from a file
    file=<name>         - File name (defaults to active file)
    property=<name>     - Property name
  property:set          Set a property on a file
    file=<name>         - File name (defaults to active file)
    property=<name>     - Property name
    value=<text>        - Property value
  publish:add           Publish a file
    file=<name>         - File name (defaults to active file)
    --all               - Publish all changed files
  publish:list          List published files
    format=<type>       - Output format (default, json)
  publish:open          Open file on published site
    file=<name>         - File name (defaults to active file)
  publish:remove        Unpublish a file
    file=<name>         - File name (defaults to active file)
  publish:site          Show publish site info
    format=<type>       - Output format (default, json)
  publish:status        List publish changes
    format=<type>       - Output format (default, json)
  random                Open a random note
  random:read           Read a random note
    format=<type>       - Output format (default, json)
  read                  Read file contents
    file=<name>         - File name (defaults to active file)
    format=<type>       - Output format (default, json)
  recents               List recently opened files
    format=<type>       - Output format (default, json)
  reload                Reload the app window
  rename                Rename a file
    file=<name>         - File name (defaults to active file)
    name=<new-name>     - New file name
  restart               Restart the application
  search                Search vault for text
    query=<text>        - Search query
    format=<type>       - Output format (default, json)
  search:context        Search with matching line context
    query=<text>        - Search query
    format=<type>       - Output format (default, json)
  search:open           Open search view
    query=<text>        - Search query
  snippet:disable       Disable a CSS snippet
    name=<snippet>      - Snippet name
  snippet:enable        Enable a CSS snippet
    name=<snippet>      - Snippet name
  snippets              List installed CSS snippets
    format=<type>       - Output format (default, json)
  snippets:enabled      List enabled CSS snippets
    format=<type>       - Output format (default, json)
  sync                  Pause or resume sync
    --pause             - Pause sync
    --resume            - Resume sync
  sync:deleted          List deleted files in sync
    format=<type>       - Output format (default, json)
  sync:history          List sync version history
    file=<name>         - File name (defaults to active file)
    format=<type>       - Output format (default, json)
  sync:open             Open sync history
    file=<name>         - File name (defaults to active file)
  sync:read             Read a sync version
    file=<name>         - File name (defaults to active file)
    version=<id>        - Version ID
    format=<type>       - Output format (default, json)
  sync:restore          Restore a sync version
    file=<name>         - File name (defaults to active file)
    version=<id>        - Version ID
  sync:status           Show sync status and usage
    format=<type>       - Output format (default, json)
  tab:open              Open a new tab
    file=<name>         - File name
  tabs                  List open tabs
    format=<type>       - Output format (default, json)
  tag                   Get tag info
    tag=<name>          - Tag name
    format=<type>       - Output format (default, json)
  tags                  List tags in the vault
    format=<type>       - Output format (default, json)
  task                  Show or update a task
    file=<name>         - File name
    line=<number>       - Task line number
    --done              - Mark as done
    --undone            - Mark as not done
    format=<type>       - Output format (default, json)
  tasks                 List tasks in the vault
    format=<type>       - Output format (default, json)
  template:insert       Insert template into active file
    template=<name>     - Template name
  template:read         Read template content
    template=<name>     - Template name
    format=<type>       - Output format (default, json)
  templates             List templates
    format=<type>       - Output format (default, json)
  unresolved            List unresolved links in vault
    format=<type>       - Output format (default, json)
  vault                 Show vault info
    format=<type>       - Output format (default, json)
  vaults                List known vaults
    format=<type>       - Output format (default, json)
  version               Show Obsidian version number
  web                   Open URL in web viewer
    url=<address>       - URL to open
  wordcount             Count words and characters
    file=<name>         - File name (defaults to active file)
    format=<type>       - Output format (default, json)
  workspace             Show workspace tree
    format=<type>       - Output format (default, json)
  workspace:delete      Delete a saved workspace
    name=<workspace>    - Workspace name
  workspace:load        Load a saved workspace
    name=<workspace>    - Workspace name
  workspace:save        Save current layout as workspace
    name=<workspace>    - Workspace name
  workspaces            List saved workspaces
    format=<type>       - Output format (default, json)

Developer:
  dev:cdp               Run a Chrome DevTools Protocol command
    method=<name>       - CDP method name
    params=<json>       - CDP parameters (JSON string)
  dev:console           Show captured console messages
    format=<type>       - Output format (default, json)
    --clear             - Clear console messages
  dev:css               Inspect CSS with source locations
    selector=<css>      - CSS selector
    format=<type>       - Output format (default, json)
  dev:debug             Attach/detach Chrome DevTools Protocol debugger
    --attach            - Attach debugger
    --detach            - Detach debugger
  dev:dom               Query DOM elements
    selector=<css>      - CSS selector
    format=<type>       - Output format (default, json)
  dev:errors            Show captured JavaScript errors
    format=<type>       - Output format (default, json)
    --clear             - Clear error log
  dev:mobile            Toggle mobile emulation
    --on                - Enable mobile emulation
    --off               - Disable mobile emulation
  dev:screenshot        Take a screenshot
    file=<name>         - Output file path
    format=<type>       - Output format (default, json, base64)
  devtools              Toggle Electron dev tools
  eval                  Execute JavaScript and return result
    code=<javascript>   - JavaScript to evaluate
    format=<type>       - Output format (default, json)
`

describe('parseHelpOutput', () => {
    test('parses all known commands from snapshot', () => {
        const commands = parseHelpOutput(HELP_OUTPUT_SNAPSHOT)
        expect(commands.length).toBeGreaterThanOrEqual(100)
    })

    test('parses specific well-known commands', () => {
        const commands = parseHelpOutput(HELP_OUTPUT_SNAPSHOT)
        const names = commands.map((c) => c.command)

        expect(names).toContain('aliases')
        expect(names).toContain('version')
        expect(names).toContain('help')
        expect(names).toContain('files')
        expect(names).toContain('search')
        expect(names).toContain('property:set')
        expect(names).toContain('daily:append')
        expect(names).toContain('plugin:install')
        expect(names).toContain('sync:status')
    })

    test('identifies developer section commands', () => {
        const commands = parseHelpOutput(HELP_OUTPUT_SNAPSHOT)
        const devCommands = commands.filter((c) => c.section === 'developer')
        const devNames = devCommands.map((c) => c.command)

        expect(devNames).toContain('dev:cdp')
        expect(devNames).toContain('dev:console')
        expect(devNames).toContain('dev:css')
        expect(devNames).toContain('dev:debug')
        expect(devNames).toContain('dev:dom')
        expect(devNames).toContain('dev:errors')
        expect(devNames).toContain('dev:mobile')
        expect(devNames).toContain('dev:screenshot')
        expect(devNames).toContain('devtools')
        expect(devNames).toContain('eval')

        // Developer commands should all be in developer section
        for (const cmd of devCommands) {
            expect(cmd.section).toBe('developer')
        }
    })

    test('commands section commands are not in developer section', () => {
        const commands = parseHelpOutput(HELP_OUTPUT_SNAPSHOT)
        const normalCommands = commands.filter((c) => c.section === 'commands')
        const normalNames = normalCommands.map((c) => c.command)

        expect(normalNames).toContain('version')
        expect(normalNames).toContain('files')
        expect(normalNames).toContain('search')
    })

    test('captures descriptions correctly', () => {
        const commands = parseHelpOutput(HELP_OUTPUT_SNAPSHOT)
        const version = commands.find((c) => c.command === 'version')
        expect(version).toBeDefined()
        expect(version!.description).toBe('Show Obsidian version number')

        const eval_ = commands.find((c) => c.command === 'eval')
        expect(eval_).toBeDefined()
        expect(eval_!.description).toBe('Execute JavaScript and return result')
    })

    test('skips parameter sub-lines', () => {
        const commands = parseHelpOutput(HELP_OUTPUT_SNAPSHOT)
        const names = commands.map((c) => c.command)

        // These are parameter names, not commands
        expect(names).not.toContain('file=<name>')
        expect(names).not.toContain('format=<type>')
        expect(names).not.toContain('content=<text>')
        expect(names).not.toContain('--overwrite')
        expect(names).not.toContain('--permanent')
    })

    test('has no duplicate commands', () => {
        const commands = parseHelpOutput(HELP_OUTPUT_SNAPSHOT)
        const names = commands.map((c) => c.command)
        const unique = new Set(names)
        expect(unique.size).toBe(names.length)
    })

    test('returns empty array for empty input', () => {
        expect(parseHelpOutput('')).toEqual([])
    })

    test('returns empty array for input without Commands section', () => {
        expect(parseHelpOutput('Obsidian CLI v1.12.2\n\nNo commands available.')).toEqual([])
    })

    test('returns empty array for malformed input', () => {
        expect(parseHelpOutput('garbage\nrandom\ntext\n')).toEqual([])
    })

    test('handles input with only Commands section (no Developer)', () => {
        const input = `Commands:
  version               Show Obsidian version number
  help                  Display available commands
`
        const commands = parseHelpOutput(input)
        expect(commands.length).toBe(2)
        expect(commands[0]!.section).toBe('commands')
        expect(commands[1]!.section).toBe('commands')
    })

    test('handles input with only Developer section', () => {
        const input = `Developer:
  eval                  Execute JavaScript and return result
`
        const commands = parseHelpOutput(input)
        expect(commands.length).toBe(1)
        expect(commands[0]!.command).toBe('eval')
        expect(commands[0]!.section).toBe('developer')
    })
})
