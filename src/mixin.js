// Copies the methods and getters of each source class onto target's prototype.
// Throws if two files define the same name, so nothing is silently overridden.
export function mixin(target, sources) {
	for (const source of sources) {
		for (const key of Reflect.ownKeys(source.prototype)) {
			if (key === "constructor") continue;
			if (Object.prototype.hasOwnProperty.call(target.prototype, key)) {
				throw new Error(`Duplicate method "${String(key)}" in ${source.name}`);
			}
			Object.defineProperty(target.prototype, key, Object.getOwnPropertyDescriptor(source.prototype, key));
		}
	}
}
