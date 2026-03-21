const MAX_RECURSION_DEPTH = 5;

/**
 * Expand a custom command alias with argument substitution.
 *
 * @param commandName - The alias name (without leading /)
 * @param args - Array of arguments passed to the command
 * @param aliases - Map of alias names to their expansions
 * @param depth - Current recursion depth (used internally)
 * @returns Object with expanded text or error, or null if not an alias
 */
export function expandCustomCommand(
	commandName: string,
	args: string[],
	aliases: Record<string, string>,
	depth = 0
): {expanded: string; error?: string} | null {
	const expansion = aliases[commandName];

	if (!expansion) {
		return null;
	}

	// Check recursion depth
	if (depth >= MAX_RECURSION_DEPTH) {
		return {
			expanded: "",
			error: `Custom command expansion exceeded maximum depth (${MAX_RECURSION_DEPTH}). Check for circular aliases.`,
		};
	}

	// Check for self-reference (alias name appears in expansion)
	if (expansion.includes(`/${commandName}`) || expansion.includes(`$${commandName}`)) {
		return {
			expanded: "",
			error: `Custom command "${commandName}" references itself.`,
		};
	}

	// Expand placeholders
	let result = expansion;

	// First handle $$ (escaped dollar sign) - use placeholder
	result = result.replace(/\$\$/g, "\x00DOLLAR\x00");

	// Expand $* (all arguments)
	result = result.replace(/\$\*/g, args.join(" "));

	// Expand $1, $2, ..., $99 (positional arguments)
	for (let i = 1; i <= 99; i++) {
		const placeholder = `$${i}`;
		const value = args[i - 1] ?? "";
		result = result.split(placeholder).join(value);
	}

	// Restore escaped dollar signs
	result = result.replace(/\x00DOLLAR\x00/g, "$");

	// Check if the result is another alias that needs expansion
	if (result.startsWith("/")) {
		const nextCmd = result.substring(1).split(" ")[0]?.toLowerCase();
		const nextArgs = result.substring(1).split(" ").slice(1);

		if (nextCmd && aliases[nextCmd] && nextCmd !== commandName) {
			const nested = expandCustomCommand(nextCmd, nextArgs, aliases, depth + 1);

			if (nested?.error) {
				return nested;
			}

			if (nested?.expanded) {
				return {expanded: nested.expanded};
			}
		}
	}

	return {expanded: result};
}

/**
 * Validate a custom commands object.
 *
 * @param aliases - The aliases object to validate
 * @returns Object with valid flag and optional error message
 */
export function validateAliases(aliases: unknown): {
	valid: boolean;
	error?: string;
	result?: Record<string, string>;
} {
	if (aliases === null || aliases === undefined) {
		return {valid: true, result: {}};
	}

	if (typeof aliases !== "object" || Array.isArray(aliases)) {
		return {valid: false, error: "Custom commands must be an object."};
	}

	const result: Record<string, string> = {};
	const obj = aliases as Record<string, unknown>;

	for (const [key, value] of Object.entries(obj)) {
		// Validate key (command name)
		if (typeof key !== "string") {
			return {valid: false, error: "Command names must be strings."};
		}

		if (!key.match(/^[a-zA-Z0-9_-]+$/)) {
			return {
				valid: false,
				error: `Invalid command name "${key}". Use only letters, numbers, underscores, and hyphens.`,
			};
		}

		// Validate value (expansion)
		if (typeof value !== "string") {
			return {valid: false, error: `Expansion for "${key}" must be a string.`};
		}

		if (value.length === 0) {
			return {valid: false, error: `Expansion for "${key}" cannot be empty.`};
		}

		result[key.toLowerCase()] = value;
	}

	return {valid: true, result};
}
